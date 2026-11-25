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
  doc,
  getDocFromServer,
  getDocsFromServer,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';

import {
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
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists() && snap.data().token === token) tx.delete(ref);
  });
}

function pesanGalat(err: unknown): string {
  if ((err as { name?: string })?.name === 'AbortError') return 'layanan notifikasi tidak merespons.';
  const code = (err as { code?: string })?.code;
  if (code === 'permission-denied') return 'akses data token ditolak.';
  if (code === 'unavailable' || err instanceof TypeError) return 'periksa koneksi internet.';
  return (err as Error)?.message || 'terjadi kesalahan.';
}

/** Mengirim hanya token milik UID yang diminta, melanjutkan batch lain jika satu batch gagal. */
export async function kirimKePengguna(uids: string[], isi: IsiNotifikasi): Promise<HasilKirim> {
  const unik = [...new Set(uids.filter((uid) => typeof uid === 'string' && uid.length > 0))];
  const hasil: HasilKirim = { penerima: unik.length, terkirim: 0, tanpaToken: 0, gagal: 0 };
  const pemilik = new Map<string, number>();
  const snaps = await Promise.allSettled(unik.map((uid) => getDocFromServer(tokenRef(uid))));
  snaps.forEach((snap, index) => {
    if (snap.status === 'rejected') {
      hasil.gagal++;
      hasil.galat = pesanGalat(snap.reason);
      return;
    }
    const data = snap.value.data();
    if (!data || data.uid !== unik[index] || !tokenValid(data.token)) hasil.tanpaToken++;
    else pemilik.set(data.token, (pemilik.get(data.token) ?? 0) + 1);
  });
  for (const potongan of susunPesan([...pemilik.keys()], isi)) {
    const jumlah = potongan.reduce((total, pesan) => total + pemilik.get(pesan.to)!, 0);
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
      if (!res.ok) throw new Error(`layanan notifikasi menolak permintaan (HTTP ${res.status}).`);
      const data = json?.data;
      const tiket = Array.isArray(data) ? data : data ? [data] : [];
      const diterima = potongan.reduce((total, pesan, index) =>
        total + (tiket[index]?.status === 'ok' ? pemilik.get(pesan.to)! : 0), 0);
      hasil.terkirim += diterima;
      hasil.gagal += jumlah - diterima;
      const ditolak = tiket.find((tiket: { status?: string }) => tiket?.status === 'error');
      if (ditolak) hasil.galat = ditolak.message || ditolak.details?.error || 'layanan push menolak pesan.';
    } catch (err) {
      hasil.gagal += jumlah;
      hasil.galat = pesanGalat(err);
    } finally {
      clearTimeout(timer);
    }
  }
  return hasil;
}

/** Mengirim ke seluruh praktikan yang terdaftar di kelas (koleksi participants). */
export async function kirimKeKelas(classId: string, isi: IsiNotifikasi): Promise<HasilKirim> {
  try {
    const peserta = await getDocsFromServer(query(collection(db, 'participants'), where('classId', '==', classId)));
    return await kirimKePengguna(peserta.docs.map((d) => d.data().uid as string), isi);
  } catch (err) {
    console.warn('Gagal memuat peserta kelas untuk notifikasi:', err);
    return { penerima: 0, terkirim: 0, tanpaToken: 0, gagal: 0, galat: pesanGalat(err) };
  }
}

type Jadwal = { hari: string; mulai: string; selesai: string; ruangan: string };

async function kelasRingkas(classId: string) {
  const snap = await getDocFromServer(doc(db, 'classes', classId));
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
