import { doc, getDocFromServer, runTransaction, serverTimestamp, type Timestamp } from 'firebase/firestore';

import { auth, db } from '../../services/firebase';
import type { Sesi } from '../../types';
import type { CheckInResult } from '../../utils/attendanceRules';
import { PANJANG_KODE } from '../../utils/code';

export async function saveAttendance(sesi: Sesi, uid: string, input: string): Promise<CheckInResult> {
  if (auth.currentUser?.uid !== uid || !sesi.classId || !sesi.sessionId) throw new Error('Silakan masuk kembali.');
  const kode = input.trim();
  if (!kode) return { ok: false, reason: 'KODE_KOSONG' };
  if (kode.length !== PANJANG_KODE) return { ok: false, reason: 'KODE_TIDAK_LENGKAP' };

  const target = doc(db, 'attendance', `${sesi.id}~${uid}`);
  const session = doc(db, 'classes', sesi.classId, 'sessions', sesi.sessionId);
  const result = await runTransaction(db, async (tx) => {
    const current = await tx.get(session);
    if (!current.exists()) return { ok: false, reason: 'SESI_TIDAK_DITEMUKAN' } as const;
    if (current.data().status === 'belum_dibuka') return { ok: false, reason: 'SESI_BELUM_DIBUKA' } as const;
    if (current.data().status === 'ditutup') return { ok: false, reason: 'SESI_DITUTUP' } as const;

    const existing = await tx.get(target);
    if (existing.exists()) {
      return {
        ok: false,
        reason: 'SUDAH_PRESENSI',
        waktuHadir: (existing.data().waktuHadir as Timestamp).toDate().toISOString(),
      } as const;
    }
    tx.set(target, {
      classId: sesi.classId,
      sesiId: sesi.id,
      sessionId: sesi.sessionId,
      praktikanId: uid,
      kode,
      waktuHadir: serverTimestamp(),
    });
    return null;
  });
  if (result) return result;

  // The timestamp is written by Firestore after the transaction commits.
  const saved = await getDocFromServer(target);
  const timestamp = saved.data()?.waktuHadir as Timestamp | undefined;
  if (!timestamp) throw new Error('Waktu kehadiran belum dapat dimuat. Buka Riwayat untuk memeriksa presensi.');
  return { ok: true, presensi: { sesiId: sesi.id, praktikanId: uid, waktuHadir: timestamp.toDate().toISOString() } };
}
