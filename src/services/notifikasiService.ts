/**
 * [SRS-017] Penyimpanan token push dan pengiriman push notification lewat Expo Push API.
 *
 * Pengiriman dipanggil SETELAH penulisan Firestore berhasil (transaksi sudah di-commit),
 * sehingga notifikasi hanya terkirim untuk perubahan data yang benar-benar tersimpan.
 * Fungsi kirim tidak pernah melempar galat: kegagalan dikembalikan sebagai HasilKirim.galat
 * supaya perubahan data yang sudah tersimpan tidak dianggap gagal.
 */
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';

import {
  hitungTiket,
  pesanJadwalBerubah,
  pesanSesiDijadwalUlang,
  susunPesan,
  tokenValid,
  type HasilKirim,
  type IsiNotifikasi,
} from '../features/notifikasi/pesan';
import { db } from './firebase';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const BATAS_WAKTU_MS = 10000;

/** Koleksi pushTokens/{uid}: satu token Expo per akun (perangkat terakhir yang login). */
const tokenRef = (uid: string) => doc(db, 'pushTokens', uid);

export async function simpanTokenPerangkat(uid: string, token: string, platform: 'android' | 'ios') {
  await setDoc(tokenRef(uid), { uid, token, platform, updatedAt: serverTimestamp() });
}

/**
 * Dipanggil saat logout agar perangkat ini tidak lagi menerima notifikasi akun tersebut.
 * Hanya menghapus bila token tersimpan masih milik perangkat ini (bukan perangkat lain yang lebih baru).
 */
export async function hapusTokenPerangkat(uid: string, token: string) {
  const ref = tokenRef(uid);
  const snap = await getDoc(ref);
  if (snap.exists() && snap.data().token === token) await deleteDoc(ref);
}

function pesanGalat(err: unknown): string {
  if ((err as { name?: string })?.name === 'AbortError') return 'layanan notifikasi tidak merespons.';
  const code = (err as { code?: string })?.code;
  if (code === 'permission-denied') return 'akses data token ditolak.';
  if (code === 'unavailable' || err instanceof TypeError) return 'periksa koneksi internet.';
  return (err as Error)?.message || 'terjadi kesalahan.';
}

async function kirimKeExpo(tokens: string[], isi: IsiNotifikasi) {
  let terkirim = 0;
  let gagal = 0;
  for (const potongan of susunPesan(tokens, isi)) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), BATAS_WAKTU_MS);
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(potongan),
        signal: controller.signal,
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const pesan = (json as { errors?: { message?: string }[] } | null)?.errors?.[0]?.message;
        throw new Error(pesan || `layanan notifikasi menolak permintaan (HTTP ${res.status}).`);
      }
      const hasil = hitungTiket(json, potongan.length);
      terkirim += hasil.terkirim;
      gagal += hasil.gagal;
      if (hasil.gagal) console.warn('Sebagian push ditolak Expo:', JSON.stringify(json));
    } finally {
      clearTimeout(timer);
    }
  }
  return { terkirim, gagal };
}

/** Mengirim ke sekumpulan akun berdasarkan token yang tersimpan di pushTokens/{uid}. */
export async function kirimKePengguna(uids: string[], isi: IsiNotifikasi): Promise<HasilKirim> {
  const unik = [...new Set(uids)];
  const hasil: HasilKirim = { penerima: unik.length, terkirim: 0, tanpaToken: 0, gagal: 0 };
  if (!unik.length) return hasil;
  try {
    const snaps = await Promise.all(unik.map((uid) => getDoc(tokenRef(uid))));
    const tokens = snaps.map((s) => s.data()?.token).filter(tokenValid);
    hasil.tanpaToken = unik.length - tokens.length;
    const kirim = await kirimKeExpo(tokens, isi);
    hasil.terkirim = Math.min(kirim.terkirim, unik.length);
    hasil.gagal = unik.length - hasil.tanpaToken - hasil.terkirim;
  } catch (err) {
    console.warn('Gagal mengirim push notification:', err);
    hasil.galat = pesanGalat(err);
  }
  return hasil;
}

/** Mengirim ke seluruh praktikan yang terdaftar di kelas (koleksi participants). */
export async function kirimKeKelas(classId: string, isi: IsiNotifikasi): Promise<HasilKirim> {
  try {
    const peserta = await getDocs(query(collection(db, 'participants'), where('classId', '==', classId)));
    return await kirimKePengguna(peserta.docs.map((d) => d.data().uid as string), isi);
  } catch (err) {
    console.warn('Gagal memuat peserta kelas untuk notifikasi:', err);
    return { penerima: 0, terkirim: 0, tanpaToken: 0, gagal: 0, galat: pesanGalat(err) };
  }
}

type Jadwal = { hari: string; mulai: string; selesai: string; ruangan: string };

async function kelasRingkas(classId: string) {
  const snap = await getDoc(doc(db, 'classes', classId));
  if (!snap.exists()) throw new Error('kelas tidak ditemukan.');
  const data = snap.data();
  return { id: classId, namaPraktikum: data.namaPraktikum as string, kode: data.kode as string };
}

/** Jadwal mingguan kelas diubah (hari, jam, atau ruangan). */
export async function kirimJadwalBerubah(classId: string, jadwal: Jadwal): Promise<HasilKirim> {
  try {
    return await kirimKeKelas(classId, pesanJadwalBerubah(await kelasRingkas(classId), jadwal));
  } catch (err) {
    return { penerima: 0, terkirim: 0, tanpaToken: 0, gagal: 0, galat: pesanGalat(err) };
  }
}

/** Satu sesi dipindah ke tanggal atau slot jadwal lain. */
export async function kirimSesiDijadwalUlang(
  classId: string,
  sesi: { modul: string; tanggal: string },
  jadwal: Jadwal,
): Promise<HasilKirim> {
  try {
    return await kirimKeKelas(classId, pesanSesiDijadwalUlang(await kelasRingkas(classId), sesi, jadwal));
  } catch (err) {
    return { penerima: 0, terkirim: 0, tanpaToken: 0, gagal: 0, galat: pesanGalat(err) };
  }
}
