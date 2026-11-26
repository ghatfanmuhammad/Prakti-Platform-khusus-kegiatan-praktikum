import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
  type DocumentSnapshot,
  type DocumentData,
  type Transaction,
} from 'firebase/firestore';
import { auth, db } from '../../services/firebase';
import { buatKodeSesi } from '../../utils/code';
import type { FormValues, Kind, PracticumClass, PracticumSession, Schedule } from './models';
import {
  assertScheduleDate,
  assertTransition,
  participantId,
  validId,
  validateForm,
} from './validation';

function context() {
  const user = auth.currentUser;
  if (!user) throw new Error('Silakan masuk kembali sebelum mengubah data.');
  return { db, user };
}
async function requireAccess(tx: Transaction, uid: string, classId: string | null, ownerOnly: boolean) {
  const profile = await tx.get(doc(db, 'users', uid));
  const role = profile.data()?.role;
  if (!classId) {
    if (role !== 'aslab') throw new Error('Hanya Aslab yang dapat mengelola Lab/kelas.');
    return;
  }
  const klass = await tx.get(doc(db, 'classes', classId));
  if (ownerOnly) {
    if (role !== 'aslab' || klass.data()?.aslabUid !== uid) throw new Error('Hanya Aslab pemilik kelas yang dapat mengubah data ini.');
  } else {
    const assignment = await tx.get(doc(db, 'pengampu', `${classId}~${uid}`));
    if (role !== 'asprak' || assignment.data()?.classId !== classId || assignment.data()?.uid !== uid)
      throw new Error('Hanya Asprak yang ditugaskan pada kelas ini yang dapat mengelola kegiatan.');
  }
}
function counter(kind: Exclude<Kind, 'kelas'>) {
  return (
    {
      peserta: 'participantCount',
      jadwal: 'scheduleCount',
      sesi: 'sessionCount',
    } as const
  )[kind];
}
function validRecordId(kind: Kind, id: string) {
  if (kind !== 'peserta') return validId(id);
  const parts = id.split('~');
  return parts.length === 2 && parts.every((part) => validId(part));
}

function targetRef(kind: Exclude<Kind, 'kelas'>, classId: string, id: string) {
  return kind === 'peserta'
    ? doc(db, 'participants', id)
    : doc(db, 'classes', classId, kind === 'jadwal' ? 'schedules' : 'sessions', id);
}

/** All writes are acknowledged by Firestore; no local-only success state. */
export async function saveRecord(
  kind: Kind,
  classId: string | null,
  recordId: string | null,
  input: FormValues,
) {
  const values = validateForm(kind, input);
  if (recordId && !validRecordId(kind, recordId)) {
    throw new Error('ID data tidak valid. Muat ulang daftar.');
  }
  const { db, user } = context();
  const now = serverTimestamp();
  if (kind === 'kelas') {
    const ref = recordId ? doc(db, 'classes', recordId) : doc(collection(db, 'classes'));
    await runTransaction(db, async (tx) => {
      await requireAccess(tx, user.uid, recordId, true);
      const existing = await tx.get(ref);
      if (recordId && !existing.exists())
        throw new Error('Kelas sudah dihapus. Muat ulang daftar.');
      if (recordId) tx.update(ref, { ...values, updatedAt: now });
      else
        tx.set(ref, {
          ...values,
          aslabUid: user.uid,
          participantCount: 0,
          scheduleCount: 0,
          sessionCount: 0,
          createdAt: now,
          updatedAt: now,
        });
    });
    return ref.id;
  }
  if (!classId || !validId(classId)) throw new Error('Pilih kelas terlebih dahulu.');
  const parent = doc(db, 'classes', classId);
  const id =
    recordId ??
    (kind === 'peserta'
      ? participantId(classId, values.uid)
      : doc(collection(parent, kind === 'jadwal' ? 'schedules' : 'sessions')).id);
  const ref = targetRef(kind, classId, id);
  await runTransaction(db, async (tx) => {
    await requireAccess(tx, user.uid, classId, kind === 'peserta');
    const classSnapshot = await tx.get(parent);
    const current = await tx.get(ref);
    if (!classSnapshot.exists()) throw new Error('Kelas sudah dihapus. Muat ulang daftar.');
    if (recordId && !current.exists()) throw new Error('Data sudah dihapus. Muat ulang daftar.');
    if (!recordId && current.exists()) throw new Error('Peserta sudah terdaftar di kelas ini.');
    if (kind === 'peserta') {
      if (id !== participantId(classId, values.uid))
        throw new Error(
          'UID peserta tidak dapat diubah. Hapus peserta lalu tambahkan akun yang baru.',
        );
      const account = await tx.get(doc(db, 'users', values.uid));
      if (account.data()?.role !== 'praktikan')
        throw new Error('UID harus berasal dari akun praktikan yang terdaftar.');
      if (recordId && current.data()?.classId !== classId)
        throw new Error('Peserta tidak terdaftar di kelas ini.');
    }
    if (kind === 'jadwal' && current.exists() && current.data()?.sessionCount > 0) {
      const before = current.data() as Schedule;
      if (
        before.hari !== values.hari ||
        before.mulai !== values.mulai ||
        before.selesai !== values.selesai
      ) {
        throw new Error(
          'Hari dan jam jadwal yang sudah dipakai sesi tidak dapat diubah. Buat jadwal baru.',
        );
      }
    }
    let schedule: DocumentSnapshot<DocumentData> | undefined;
    let oldSchedule: DocumentSnapshot<DocumentData> | undefined;
    if (kind === 'sesi') {
      if (current.exists() && current.data()?.status !== 'belum_dibuka')
        throw new Error('Hanya sesi yang belum dibuka yang dapat diubah.');
      schedule = await tx.get(doc(parent, 'schedules', values.scheduleId));
      if (!schedule.exists()) throw new Error('Jadwal sudah tidak tersedia. Pilih jadwal lain.');
      assertScheduleDate(values.tanggal, schedule.data() as Schedule);
      if (current.exists() && current.data()?.scheduleId !== values.scheduleId) {
        oldSchedule = await tx.get(doc(parent, 'schedules', current.data()!.scheduleId));
        if (!oldSchedule.exists())
          throw new Error('Jadwal sebelumnya tidak ditemukan. Hubungi pengelola.');
      }
    }
    if (!recordId) {
      const field = counter(kind);
      tx.update(parent, {
        [field]: classSnapshot.data()[field] + 1,
        lastChildId: id,
        updatedAt: now,
      });
    }
    if (schedule && (!recordId || oldSchedule)) {
      tx.update(schedule.ref, {
        sessionCount: schedule.data()!.sessionCount + 1,
        lastSessionId: id,
        updatedAt: now,
      });
      if (oldSchedule)
        tx.update(oldSchedule.ref, {
          sessionCount: oldSchedule.data()!.sessionCount - 1,
          lastSessionId: id,
          updatedAt: now,
        });
    }
    if (recordId) tx.update(ref, { ...values, updatedAt: now });
    else
      tx.set(ref, {
        ...values,
        ...(kind === 'peserta'
          ? { classId }
          : kind === 'jadwal'
            ? { sessionCount: 0 }
            : { status: 'belum_dibuka', asistenId: user.uid, topik: null }),
        createdAt: now,
        updatedAt: now,
      });
  });
  return id;
}

export async function deleteRecord(kind: Kind, classId: string | null, id: string) {
  const { db, user } = context();
  if (
    !validRecordId(kind, id) ||
    (kind !== 'kelas' && (!classId || !validId(classId)))
  )
    throw new Error('Data tidak valid. Muat ulang daftar.');
  const ref = kind === 'kelas' ? doc(db, 'classes', id) : targetRef(kind, classId!, id);
  await runTransaction(db, async (tx) => {
    await requireAccess(tx, user.uid, kind === 'kelas' ? id : classId, kind === 'kelas' || kind === 'peserta');
    const current = await tx.get(ref);
    if (!current.exists()) throw new Error('Data sudah dihapus. Muat ulang daftar.');
    if (kind === 'kelas') {
      const data = current.data() as PracticumClass;
      if (data.participantCount || data.scheduleCount || data.sessionCount)
        throw new Error('Hapus seluruh peserta, sesi, dan jadwal sebelum menghapus kelas.');
      tx.delete(ref);
      return;
    }
    const parent = doc(db, 'classes', classId!);
    const classSnapshot = await tx.get(parent);
    if (!classSnapshot.exists()) throw new Error('Kelas sudah tidak tersedia.');
    if (kind === 'peserta' && current.data().classId !== classId)
      throw new Error('Peserta tidak terdaftar di kelas ini.');
    if (kind === 'jadwal' && current.data().sessionCount > 0)
      throw new Error('Hapus sesi yang menggunakan jadwal ini terlebih dahulu.');
    // SRS-009/SRS-010 own attendance and permission records. Preserve their sessions.
    if (kind === 'sesi' && current.data().status !== 'belum_dibuka')
      throw new Error(
        'Sesi yang sudah dibuka atau ditutup tidak dapat dihapus agar riwayat tetap terjaga.',
      );
    const schedule =
      kind === 'sesi' ? await tx.get(doc(parent, 'schedules', current.data().scheduleId)) : null;
    if (kind === 'sesi' && !schedule?.exists())
      throw new Error('Jadwal sesi tidak ditemukan. Hubungi pengelola.');
    const field = counter(kind);
    tx.update(parent, {
      [field]: classSnapshot.data()[field] - 1,
      lastChildId: id,
      updatedAt: serverTimestamp(),
    });
    if (schedule)
      tx.update(schedule.ref, {
        sessionCount: schedule.data()!.sessionCount - 1,
        lastSessionId: id,
        updatedAt: serverTimestamp(),
      });
    tx.delete(ref);
  });
}

/** Used by the session-management owner instead of local setState. */
export async function changeSessionStatus(
  classId: string,
  sessionId: string,
  next: 'dibuka' | 'ditutup',
  topik: string | null = null,
) {
  const { db, user } = context();
  if (!validId(classId) || !validId(sessionId)) throw new Error('Sesi tidak valid.');
  const ref = doc(db, 'classes', classId, 'sessions', sessionId);
  const codeRef = doc(db, 'sessionCodes', `${classId}~${sessionId}`);
  const kode = buatKodeSesi();
  await runTransaction(db, async (tx) => {
    await requireAccess(tx, user.uid, classId, false);
    const current = await tx.get(ref);
    if (!current.exists()) throw new Error('Sesi sudah dihapus.');
    const session = current.data() as PracticumSession;
    if (session.asistenId !== user.uid) throw new Error('Sesi ini diampu asisten lain.');
    assertTransition(session.status, next);
    tx.update(ref, {
      status: next,
      ...(next === 'dibuka' ? { topik } : {}),
      updatedAt: serverTimestamp(),
    });
    if (next === 'dibuka') {
      tx.set(codeRef, { classId, sesiId: sessionId, kode });
    } else {
      tx.delete(codeRef);
    }
  });
}
