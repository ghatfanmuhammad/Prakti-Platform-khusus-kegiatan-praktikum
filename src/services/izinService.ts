import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
  type FirestoreError,
  type QuerySnapshot,
} from 'firebase/firestore';

import { db } from './firebase';

export type StatusIzin = 'Menunggu' | 'Disetujui' | 'Ditolak';

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
  createdAt?: unknown;
  updatedAt?: unknown;
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

/**
 * [SRS-010 - Praktikan] Mengajukan permohonan izin
 */
export async function ajukanIzin(data: Omit<PengajuanIzin, 'id' | 'status' | 'reviewedBy' | 'reviewedByUid' | 'createdAt' | 'updatedAt'>) {
  if (!data.alasan || data.alasan.trim().length < 5) {
    throw new Error('Alasan izin terlalu pendek atau tidak boleh kosong.');
  }

  const colRef = collection(db, 'izin');
  return await addDoc(colRef, {
    ...data,
    alasan: data.alasan.trim(),
    status: 'Menunggu',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/**
 * [SRS-011 - Asisten] Berlangganan (listen) seluruh daftar permohonan izin secara real-time
 */
export function subscribeDaftarIzin(
  onData: (hasil: DaftarIzinSnapshot) => void,
  onError: (error: FirestoreError) => void,
) {
  const q = query(collection(db, 'izin'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, { includeMetadataChanges: true }, (s) => onData(mapSnapshot(s)), onError);
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
  await runTransaction(db, async (tx) => {
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
  });
}
