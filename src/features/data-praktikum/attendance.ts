import { doc, getDocFromServer, runTransaction, serverTimestamp, type Timestamp } from 'firebase/firestore';

import { auth, db } from '../../services/firebase';
import type { Sesi } from '../../types';
import type { CheckInResult } from '../../utils/attendanceRules';
import { PANJANG_KODE } from '../../utils/code';
import { bacaLaboratorium, periksaRadius, type LokasiValid } from '../presensi/lokasi';

export async function saveAttendance(sesi: Sesi, uid: string, input: string, lokasi: LokasiValid): Promise<CheckInResult> {
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

    if (current.data().status !== 'dibuka') return { ok: false, reason: 'SESI_BELUM_DIBUKA' } as const;
    const schedule = await tx.get(doc(db, 'classes', sesi.classId!, 'schedules', current.data().scheduleId));
    const classSnapshot = await tx.get(doc(db, 'classes', sesi.classId!));
    const labId = schedule.data()?.labId ?? classSnapshot.data()?.labId;
    if (!labId || !lokasi || lokasi.jenis !== 'dalam_radius' || lokasi.lab.id !== labId) {
      throw new Error('Laboratorium berubah atau belum diatur. Periksa lokasi lagi.');
    }
    const labSnapshot = await tx.get(doc(db, 'laboratories', labId));
    const lab = bacaLaboratorium(labId, labSnapshot.data());
    if (!lab || !lokasi.posisi || periksaRadius(lokasi.posisi, lab).jenis !== 'dalam_radius') {
      throw new Error('Posisi berada di luar radius atau belum tervalidasi. Periksa lokasi lagi.');
    }

    const existing = await tx.get(target);
    if (existing.exists()) {
      return {
        ok: false,
        reason: 'SUDAH_PRESENSI',
        waktuHadir: (existing.data().waktuHadir as Timestamp).toDate().toISOString(),
      } as const;
    }
    const waktuHadir = serverTimestamp();
    tx.set(target, {
      classId: sesi.classId,
      sesiId: sesi.id,
      sessionId: sesi.sessionId,
      praktikanId: uid,
      kode,
      waktuHadir,
    });
    // Raw coordinates are private; assistants only read the attendance summary.
    tx.set(doc(db, 'attendanceLocations', target.id), {
      waktuHadir,
      lokasi: { labId, ...lokasi.posisi },
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
