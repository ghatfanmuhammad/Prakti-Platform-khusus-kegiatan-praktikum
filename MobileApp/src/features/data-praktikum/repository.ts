import { getAuth } from 'firebase/auth';
import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
  type DocumentReference,
  type DocumentSnapshot,
  type DocumentData,
  type Transaction,
} from 'firebase/firestore';
import { getFirebaseServices } from '@/lib/firebase';
import type { FormValues, Kind, PracticumClass, PracticumSession, Schedule } from './models';
import {
  assertScheduleDate,
  assertTransition,
  participantId,
  validId,
  validateForm,
} from './validation';

function context() {
  const { app, db } = getFirebaseServices();
  const user = getAuth(app).currentUser;
  if (!user) throw new Error('Silakan masuk kembali sebelum mengubah data.');
  return { db, user };
}
async function requireAssistant(tx: Transaction, ref: DocumentReference) {
  const profile = await tx.get(ref);
  if (profile.data()?.role !== 'asisten')
    throw new Error('Hanya asisten yang dapat mengelola data praktikum.');
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
function targetRef(kind: Exclude<Kind, 'kelas'>, classId: string, id: string) {
  const { db } = getFirebaseServices();
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
  if (recordId && !validId(recordId, kind === 'peserta' ? 257 : 128)) {
    throw new Error('ID data tidak valid. Muat ulang daftar.');
  }
  const { db, user } = context();
  const now = serverTimestamp();
  if (kind === 'kelas') {
    const ref = recordId ? doc(db, 'classes', recordId) : doc(collection(db, 'classes'));
    await runTransaction(db, async (tx) => {
      await requireAssistant(tx, doc(db, 'users', user.uid));
      const existing = await tx.get(ref);
      if (recordId && !existing.exists())
        throw new Error('Kelas sudah dihapus. Muat ulang daftar.');
      if (recordId) tx.update(ref, { ...values, updatedAt: now });
      else
        tx.set(ref, {
          ...values,
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
    await requireAssistant(tx, doc(db, 'users', user.uid));
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
    // Every child mutation also touches its parent, serializing concurrent deletion.
    const field = counter(kind);
    tx.update(parent, {
      [field]: classSnapshot.data()[field] + (recordId ? 0 : 1),
      updatedAt: now,
    });
    if (schedule && (!recordId || oldSchedule)) {
      tx.update(schedule.ref, {
        sessionCount: schedule.data()!.sessionCount + 1,
        updatedAt: now,
      });
      if (oldSchedule)
        tx.update(oldSchedule.ref, {
          sessionCount: oldSchedule.data()!.sessionCount - 1,
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
            : { status: 'belum_dibuka' }),
        createdAt: now,
        updatedAt: now,
      });
  });
  return id;
}

export async function deleteRecord(kind: Kind, classId: string | null, id: string) {
  const { db, user } = context();
  if (
    !validId(id, kind === 'peserta' ? 257 : 128) ||
    (kind !== 'kelas' && (!classId || !validId(classId)))
  )
    throw new Error('Data tidak valid. Muat ulang daftar.');
  const ref = kind === 'kelas' ? doc(db, 'classes', id) : targetRef(kind, classId!, id);
  await runTransaction(db, async (tx) => {
    await requireAssistant(tx, doc(db, 'users', user.uid));
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
      updatedAt: serverTimestamp(),
    });
    if (schedule)
      tx.update(schedule.ref, {
        sessionCount: schedule.data()!.sessionCount - 1,
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
) {
  const { db, user } = context();
  if (!validId(classId) || !validId(sessionId)) throw new Error('Sesi tidak valid.');
  const ref = doc(db, 'classes', classId, 'sessions', sessionId);
  await runTransaction(db, async (tx) => {
    await requireAssistant(tx, doc(db, 'users', user.uid));
    const current = await tx.get(ref);
    if (!current.exists()) throw new Error('Sesi sudah dihapus.');
    assertTransition((current.data() as PracticumSession).status, next);
    tx.update(ref, { status: next, updatedAt: serverTimestamp() });
  });
}
