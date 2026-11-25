/** Client access is limited to its own token. Dispatch runs on the authenticated server. */
import { doc, runTransaction, serverTimestamp, setDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import type { HasilKirim } from '../features/notifikasi/pesan';
import type { PermintaanNotifikasi } from '../features/notifikasi/permintaan';
import { app, db } from './firebase';

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

async function kirim(input: PermintaanNotifikasi): Promise<HasilKirim> {
  try {
    const call = httpsCallable<PermintaanNotifikasi, HasilKirim>(getFunctions(app), 'kirimNotifikasi');
    return (await call(input)).data;
  } catch {
    return { penerima: 0, terkirim: 0, tanpaToken: 0, gagal: 0,
      galat: 'Server notifikasi tidak dapat dihubungi atau akses ditolak. Perubahan data tetap tersimpan.' };
  }
}

export const kirimSesiDibuka = (classId: string, sessionId: string) => kirim({ jenis: 'sesi_dibuka', classId, sessionId });
export const kirimJadwalBerubah = (classId: string, scheduleId: string) => kirim({ jenis: 'jadwal_berubah', classId, scheduleId });
export const kirimSesiDijadwalUlang = (classId: string, sessionId: string) => kirim({ jenis: 'sesi_dijadwal_ulang', classId, sessionId });
export const kirimKeputusanIzin = (izinId: string) => kirim({ jenis: 'keputusan_izin', izinId });
