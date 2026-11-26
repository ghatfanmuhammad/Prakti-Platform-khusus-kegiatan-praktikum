import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  type FirestoreError,
  type QuerySnapshot,
} from 'firebase/firestore';

import { formatAiError, klasifikasiAlasan } from './aiService';
import { db } from './firebase';

export type StatusIzin = 'Menunggu' | 'Disetujui' | 'Ditolak';
export type StatusAI = 'berhasil' | 'gagal';

/** Batas panjang alasan izin (karakter). */
export const ALASAN_MIN = 10;
export const ALASAN_MAX = 500;

export interface PengajuanIzin {
  id?: string;
  praktikanId: string;
  praktikanNama: string;
  praktikanNim: string;
  sesiId: string;
  sesiNama: string;
  alasan: string;
  status: StatusIzin;
  /** Nama asisten yang meninjau (untuk ditampilkan). */
  reviewedBy?: string;
  /** UID asisten yang meninjau (dicek oleh Security Rules). */
  reviewedByUid?: string;
  /** Prediksi kategori alasan dari model AI (informasi pendukung, bukan keputusan). */
  kategoriAI?: string | null;
  /** Tingkat keyakinan prediksi 0..1. */
  confidenceAI?: number | null;
  statusAI?: StatusAI;
  /** Pesan singkat bila klasifikasi AI gagal. */
  pesanAI?: string | null;
  diklasifikasiPada?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
}

type FieldAI = Pick<PengajuanIzin, 'kategoriAI' | 'confidenceAI' | 'statusAI' | 'pesanAI'> & {
  diklasifikasiPada: ReturnType<typeof serverTimestamp>;
};

/**
 * Menjalankan klasifikasi AI dan SELALU mengembalikan field untuk disimpan,
 * termasuk saat AI gagal, supaya pengajuan izin tidak terhambat oleh layanan AI.
 */
async function jalankanKlasifikasi(alasan: string): Promise<FieldAI> {
  try {
    const hasil = await klasifikasiAlasan(alasan);
    return {
      kategoriAI: hasil.kategori,
      confidenceAI: hasil.confidence,
      statusAI: 'berhasil',
      pesanAI: null,
      diklasifikasiPada: serverTimestamp(),
    };
  } catch (err) {
    console.warn('Klasifikasi AI gagal:', err);
    return {
      kategoriAI: null,
      confidenceAI: null,
      statusAI: 'gagal',
      pesanAI: formatAiError(err),
      diklasifikasiPada: serverTimestamp(),
    };
  }
}

/** Validasi alasan izin. Mengembalikan pesan error, atau null bila valid. */
export function validasiAlasan(alasan: string): string | null {
  const teks = alasan.trim();
  if (!teks) return 'Alasan izin wajib diisi.';
  if (teks.length < ALASAN_MIN) return `Alasan izin terlalu pendek (minimal ${ALASAN_MIN} karakter).`;
  if (teks.length > ALASAN_MAX) return `Alasan izin terlalu panjang (maksimal ${ALASAN_MAX} karakter).`;
  return null;
}

export interface DaftarIzinSnapshot {
  daftar: PengajuanIzin[];
  /** true bila data diambil dari cache lokal karena perangkat sedang offline. */
  dariCache: boolean;
}

/** Pesan galat Firestore yang ramah pengguna. */
export function formatIzinError(err: unknown): string {
  const code = (err as FirestoreError | undefined)?.code;
  switch (code) {
    case 'permission-denied':
      return 'Anda tidak memiliki akses ke data izin ini.';
    case 'unavailable':
    case 'deadline-exceeded':
      return 'Gagal terhubung ke server. Periksa koneksi internet Anda.';
    case 'failed-precondition':
      return 'Pengajuan ini sudah diputuskan sebelumnya.';
    case 'not-found':
      return 'Pengajuan izin tidak ditemukan.';
    default:
      return (err as Error | undefined)?.message || 'Terjadi kesalahan. Silakan coba lagi.';
  }
}

function mapSnapshot(snapshot: QuerySnapshot): DaftarIzinSnapshot {
  return {
    daftar: snapshot.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<PengajuanIzin, 'id'>),
    })),
    dariCache: snapshot.metadata.fromCache,
  };
}

export type DataPengajuanIzin = Pick<
  PengajuanIzin,
  'praktikanId' | 'praktikanNama' | 'praktikanNim' | 'sesiId' | 'sesiNama' | 'alasan'
>;

/**
 * [SRS-010 - Praktikan] Mengajukan permohonan izin.
 * Alasan dikirim dulu ke AI untuk prediksi kategori, lalu disimpan bersama pengajuan.
 * Status tetap 'Menunggu' apa pun hasil AI; keputusan hanya oleh asisten.
 * Mengembalikan hasil AI agar UI bisa memberi tahu praktikan bila AI gagal.
 */
export async function ajukanIzin(data: DataPengajuanIzin) {
  const pesanValidasi = validasiAlasan(data.alasan ?? '');
  if (pesanValidasi) throw new Error(pesanValidasi);
  if (!data.sesiId) throw new Error('Pilih sesi yang ingin diajukan izinnya.');

  const alasan = data.alasan.trim();
  const fieldAI = await jalankanKlasifikasi(alasan);

  const ref = await addDoc(collection(db, 'izin'), {
    praktikanId: data.praktikanId,
    praktikanNama: data.praktikanNama,
    praktikanNim: data.praktikanNim,
    sesiId: data.sesiId,
    sesiNama: data.sesiNama,
    alasan,
    status: 'Menunggu',
    ...fieldAI,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return { id: ref.id, statusAI: fieldAI.statusAI, pesanAI: fieldAI.pesanAI };
}

/**
 * [Asisten] Mengulang klasifikasi AI, mis. saat layanan AI sebelumnya tidak merespons.
 * Hanya memperbarui field AI; status keputusan izin tidak disentuh.
 */
export async function klasifikasiUlangIzin(izinId: string, alasan: string): Promise<FieldAI> {
  const fieldAI = await jalankanKlasifikasi(alasan);
  await updateDoc(doc(db, 'izin', izinId), { ...fieldAI });
  return fieldAI;
}

/**
 * [SRS-011 - Asisten] Berlangganan (listen) seluruh daftar permohonan izin secara real-time
 */
export function subscribeDaftarIzin(
  sesiIds: string[],
  onData: (hasil: DaftarIzinSnapshot) => void,
  onError: (error: FirestoreError) => void,
) {
  const ids = [...new Set(sesiIds)];
  const results = new Map<string, DaftarIzinSnapshot>();
  if (!ids.length) { onData({ daftar: [], dariCache: false }); return () => {}; }
  const stops = ids.map((id) => onSnapshot(query(collection(db, 'izin'), where('sesiId', '==', id)), { includeMetadataChanges: true }, (snapshot) => {
    results.set(id, mapSnapshot(snapshot));
    if (results.size === ids.length) onData({ daftar: [...results.values()].flatMap((s) => s.daftar), dariCache: [...results.values()].some((s) => s.dariCache) });
  }, onError));
  return () => stops.forEach((stop) => stop());
}

/**
 * [SRS-010/011 - Praktikan] Berlangganan izin milik praktikan sendiri secara real-time,
 * sehingga keputusan asisten langsung terlihat oleh praktikan.
 * Filter `praktikanId` wajib ada karena Security Rules hanya mengizinkan praktikan membaca izinnya sendiri.
 */
export function subscribeIzinPraktikan(
  praktikanId: string,
  onData: (hasil: DaftarIzinSnapshot) => void,
  onError: (error: FirestoreError) => void,
) {
  const q = query(collection(db, 'izin'), where('praktikanId', '==', praktikanId));
  return onSnapshot(
    q,
    { includeMetadataChanges: true },
    (s) => {
      const hasil = mapSnapshot(s);
      // Urutkan di klien agar tidak perlu composite index (praktikanId + createdAt)
      hasil.daftar.sort((a, b) => waktuMs(b.createdAt) - waktuMs(a.createdAt));
      onData(hasil);
    },
    onError,
  );
}

function waktuMs(ts: unknown): number {
  const t = ts as { toMillis?: () => number } | null | undefined;
  return t?.toMillis ? t.toMillis() : Number.MAX_SAFE_INTEGER; // yang belum tersinkron dianggap terbaru
}

/**
 * [SRS-011 - Asisten] Menerima atau menolak permohonan izin.
 * Memakai transaksi supaya izin yang sudah diputuskan (mis. oleh asisten lain) tidak tertimpa.
 */
export async function periksaIzin(
  izinId: string,
  status: 'Disetujui' | 'Ditolak',
  asisten: { uid: string; nama: string },
) {
  const docRef = doc(db, 'izin', izinId);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(docRef);
    if (!snap.exists()) {
      throw Object.assign(new Error('Pengajuan izin tidak ditemukan.'), { code: 'not-found' });
    }
    if (snap.data().status !== 'Menunggu') {
      throw Object.assign(new Error('Pengajuan ini sudah diputuskan sebelumnya.'), {
        code: 'failed-precondition',
      });
    }
    tx.update(docRef, {
      status,
      reviewedBy: asisten.nama,
      reviewedByUid: asisten.uid,
      updatedAt: serverTimestamp(),
    });
    return { id: izinId, praktikanId: snap.data().praktikanId as string, sesiNama: snap.data().sesiNama as string, status, reviewedBy: asisten.nama };
  });
}
