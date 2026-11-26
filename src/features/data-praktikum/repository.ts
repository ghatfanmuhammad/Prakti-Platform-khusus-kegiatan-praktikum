import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  where,
  type DocumentData,
  type DocumentReference,
  type DocumentSnapshot,
  type Transaction,
} from 'firebase/firestore';
import { auth, db } from '../../services/firebase';
import type { Role } from '../../types';
import { buatKodeSesi } from '../../utils/code';
import type { AkunPenggunaRingkas } from '../impor/pencocokan';
import type {
  FormValues,
  Kind,
  PracticumClass,
  PracticumSession,
  RiwayatPindah,
  Schedule,
} from './models';
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

async function requireAslab(tx: Transaction, ref: DocumentReference) {
  const profile = await tx.get(ref);
  if (profile.data()?.role !== 'aslab') {
    throw new Error('Hanya Aslab yang dapat mengelola data praktikum.');
  }
}

async function requireSessionManager(tx: Transaction, ref: DocumentReference) {
  const profile = await tx.get(ref);
  const role = profile.data()?.role;
  if (role !== 'asprak' && role !== 'asisten' && role !== 'aslab') {
    throw new Error('Hanya Asprak atau Aslab yang dapat mengubah status sesi.');
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
    const classPayload: Record<string, unknown> = {
      kode: values.kode,
      namaPraktikum: values.namaPraktikum,
      ...(values.namaLab !== undefined ? { namaLab: values.namaLab } : {}),
      ...(values.labId !== undefined ? { labId: values.labId } : {}),
      ...(values.toleransiMenit !== undefined
        ? { toleransiMenit: Number(values.toleransiMenit) }
        : {}),
      ...(values.nominalDenda !== undefined
        ? { nominalDenda: Number(values.nominalDenda) }
        : {}),
    };
    await runTransaction(db, async (tx) => {
      await requireAslab(tx, doc(db, 'users', user.uid));
      const existing = await tx.get(ref);
      if (recordId && !existing.exists())
        throw new Error('Kelas sudah dihapus. Muat ulang daftar.');
      if (recordId && existing.data()?.aslabUid && existing.data()?.aslabUid !== user.uid)
        throw new Error('Anda hanya dapat mengelola Lab milik Anda sendiri.');
      if (recordId) tx.update(ref, { ...classPayload, updatedAt: now });
      else
        tx.set(ref, {
          ...classPayload,
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
    await requireAslab(tx, doc(db, 'users', user.uid));
    const classSnapshot = await tx.get(parent);
    const current = await tx.get(ref);
    if (!classSnapshot.exists()) throw new Error('Kelas sudah dihapus. Muat ulang daftar.');
    if (classSnapshot.data()?.aslabUid && classSnapshot.data()?.aslabUid !== user.uid)
      throw new Error('Anda hanya dapat mengelola Lab milik Anda sendiri.');
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
    await requireAslab(tx, doc(db, 'users', user.uid));
    const current = await tx.get(ref);
    if (!current.exists()) throw new Error('Data sudah dihapus. Muat ulang daftar.');
    if (kind === 'kelas') {
      const data = current.data() as PracticumClass;
      if (data.aslabUid && data.aslabUid !== user.uid)
        throw new Error('Anda hanya dapat menghapus Lab milik Anda sendiri.');
      if (data.participantCount || data.scheduleCount || data.sessionCount)
        throw new Error('Hapus seluruh peserta, sesi, dan jadwal sebelum menghapus kelas.');
      tx.delete(ref);
      return;
    }
    const parent = doc(db, 'classes', classId!);
    const classSnapshot = await tx.get(parent);
    if (!classSnapshot.exists()) throw new Error('Kelas sudah tidak tersedia.');
    if (classSnapshot.data()?.aslabUid && classSnapshot.data()?.aslabUid !== user.uid)
      throw new Error('Anda hanya dapat mengelola Lab milik Anda sendiri.');
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
    await requireSessionManager(tx, doc(db, 'users', user.uid));
    const current = await tx.get(ref);
    if (!current.exists()) throw new Error('Sesi sudah dihapus.');
    const session = current.data() as PracticumSession;
    if (session.asistenId !== user.uid) throw new Error('Sesi ini diampu asprak lain.');
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

/** Mengambil daftar akun pengguna untuk pencocokan NIM/email/kode oleh Aslab (SRS-022 & SRS-023). */
export async function ambilDaftarAkunPengguna(): Promise<AkunPenggunaRingkas[]> {
  context();
  const snap = await getDocs(collection(db, 'users'));
  return snap.docs.map((item) => {
    const d = item.data();
    return {
      uid: String(d.uid ?? item.id),
      email: String(d.email ?? ''),
      name: String(d.name ?? ''),
      role: (d.role ?? 'praktikan') as Role,
      nimOrCode: String(d.nimOrCode ?? ''),
    };
  });
}

/**
 * Memindahkan satu praktikan antar-Lab dalam satu transaksi atomik dan mencatatnya di `riwayatPindah` (SRS-022).
 * Jadwal dan riwayat presensi di Lab asal tidak ikut dipindah / diubah.
 */
export async function pindahPraktikan({
  uid,
  dariClassId,
  keClassId,
}: {
  uid: string;
  dariClassId: string;
  keClassId: string;
}): Promise<void> {
  const { db, user } = context();
  if (!validId(uid) || !validId(dariClassId) || !validId(keClassId)) {
    throw new Error('ID praktikan atau Lab tidak valid.');
  }
  if (dariClassId === keClassId) {
    throw new Error('Lab tujuan harus berbeda dari Lab asal.');
  }

  const oldId = participantId(dariClassId, uid);
  const newId = participantId(keClassId, uid);
  const oldRef = doc(db, 'participants', oldId);
  const newRef = doc(db, 'participants', newId);
  const fromClassRef = doc(db, 'classes', dariClassId);
  const toClassRef = doc(db, 'classes', keClassId);
  const accountRef = doc(db, 'users', uid);
  const historyRef = doc(collection(db, 'riwayatPindah'));

  await runTransaction(db, async (tx) => {
    await requireAslab(tx, doc(db, 'users', user.uid));

    const [accountSnap, fromClassSnap, toClassSnap, oldSnap, newSnap] = await Promise.all([
      tx.get(accountRef),
      tx.get(fromClassRef),
      tx.get(toClassRef),
      tx.get(oldRef),
      tx.get(newRef),
    ]);

    if (accountSnap.data()?.role !== 'praktikan') {
      throw new Error('Akun yang dipindahkan bukan praktikan.');
    }
    if (!fromClassSnap.exists() || !toClassSnap.exists()) {
      throw new Error('Lab asal atau Lab tujuan tidak ditemukan.');
    }
    if (
      fromClassSnap.data()?.aslabUid !== user.uid ||
      toClassSnap.data()?.aslabUid !== user.uid
    ) {
      throw new Error('Anda hanya dapat memindahkan praktikan antar-Lab milik Anda sendiri.');
    }
    if (!oldSnap.exists()) {
      throw new Error('Praktikan tidak terdaftar di Lab asal.');
    }
    if (newSnap.exists()) {
      throw new Error('Praktikan sudah terdaftar di Lab tujuan.');
    }

    const oldData = oldSnap.data();
    const now = serverTimestamp();

    tx.delete(oldRef);
    tx.set(newRef, {
      classId: keClassId,
      uid,
      nama: oldData.nama,
      nim: oldData.nim,
      createdAt: now,
      updatedAt: now,
    });
    tx.update(fromClassRef, {
      participantCount: Math.max(0, (fromClassSnap.data()?.participantCount ?? 1) - 1),
      lastChildId: oldId,
      updatedAt: now,
    });
    tx.update(toClassRef, {
      participantCount: (toClassSnap.data()?.participantCount ?? 0) + 1,
      lastChildId: newId,
      updatedAt: now,
    });
    tx.set(historyRef, {
      jenis: 'praktikan',
      uid,
      dariClassId,
      keClassId,
      olehUid: user.uid,
      waktu: now,
    });
  });
}

/** Berlangganan riwayat perpindahan (`praktikan` atau `asprak`) milik Aslab secara real-time. */
export function subscribeRiwayatPindah(
  aslabUid: string,
  jenis: 'praktikan' | 'asprak',
  onData: (daftar: RiwayatPindah[]) => void,
  onError: (error: unknown) => void,
): () => void {
  const q = query(collection(db, 'riwayatPindah'), where('olehUid', '==', aslabUid));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<RiwayatPindah, 'id'>) }))
        .filter((item) => item.jenis === jenis)
        .sort((a, b) => (b.waktu?.toMillis?.() ?? 0) - (a.waktu?.toMillis?.() ?? 0));
      onData(items);
    },
    onError,
  );
}
