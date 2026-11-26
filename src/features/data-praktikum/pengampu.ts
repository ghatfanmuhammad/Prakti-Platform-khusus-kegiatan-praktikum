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
} from 'firebase/firestore';

import { auth, db } from '../../services/firebase';
import type { Pengampu } from './models';
import { participantId, validId } from './validation';

function pengampuDocId(classId: string, uid: string): string {
  return participantId(classId, uid);
}

function sesiDipegangAsprak(data: DocumentData | undefined, uid: string): boolean {
  if (!data || data.status !== 'dibuka') return false;
  return data.asistenId === uid || data.asprakUid === uid || data.openedByUid === uid;
}

/** Berlangganan daftar Asprak pengampu di satu Lab secara real-time (SRS-023). */
export function subscribePengampuKelas(
  classId: string,
  onData: (daftar: Pengampu[]) => void,
  onError: (error: unknown) => void,
): () => void {
  const q = query(collection(db, 'pengampu'), where('classId', '==', classId));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<Pengampu, 'id'>) }))
        .sort((a, b) => a.nama.localeCompare(b.nama, 'id'));
      onData(items);
    },
    onError,
  );
}

/** Menugaskan satu akun berperan `asprak` ke Lab milik Aslab (SRS-023). */
export async function tambahAsprak(
  classId: string,
  akun: { uid: string; nama: string; kode: string; email?: string | null },
): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('Silakan masuk kembali sebelum menugaskan Asprak.');
  if (!validId(classId) || !validId(akun.uid)) {
    throw new Error('ID Lab atau UID Asprak tidak valid.');
  }

  const nama = akun.nama.trim();
  const kode = akun.kode.trim();
  if (!nama || !kode) throw new Error('Nama dan kode Asprak wajib diisi.');
  if (nama.length > 120) throw new Error('Nama Asprak maksimal 120 karakter.');
  if (kode.length > 40) throw new Error('Kode Asprak maksimal 40 karakter.');

  const id = pengampuDocId(classId, akun.uid);
  const ref = doc(db, 'pengampu', id);

  await runTransaction(db, async (tx) => {
    const [callerSnap, classSnap, targetSnap, existingSnap] = await Promise.all([
      tx.get(doc(db, 'users', user.uid)),
      tx.get(doc(db, 'classes', classId)),
      tx.get(doc(db, 'users', akun.uid)),
      tx.get(ref),
    ]);

    if (callerSnap.data()?.role !== 'aslab') {
      throw new Error('Hanya Aslab yang dapat menugaskan Asprak.');
    }
    if (!classSnap.exists()) {
      throw new Error('Lab tidak ditemukan.');
    }
    if (classSnap.data()?.aslabUid !== user.uid) {
      throw new Error('Anda hanya dapat menugaskan Asprak ke Lab milik Anda sendiri.');
    }
    if (!targetSnap.exists() || targetSnap.data()?.role !== 'asprak') {
      throw new Error('Hanya akun berperan Asprak yang bisa ditugaskan.');
    }
    if (existingSnap.exists()) {
      throw new Error('Asprak sudah ditugaskan di Lab ini.');
    }

    const now = serverTimestamp();
    tx.set(ref, {
      classId,
      uid: akun.uid,
      nama,
      kode,
      email: akun.email?.trim() || null,
      createdAt: now,
      updatedAt: now,
    });
  });

  return id;
}

/** Melepas penugasan Asprak dari Lab (ditolak jika masih ada sesi dibuka). */
export async function hapusAsprak(classId: string, uid: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Silakan masuk kembali sebelum mengubah data.');
  if (!validId(classId) || !validId(uid)) throw new Error('Data Asprak tidak valid.');

  const id = pengampuDocId(classId, uid);
  const openSessionsSnap = await getDocs(
    query(collection(db, 'classes', classId, 'sessions'), where('status', '==', 'dibuka')),
  );
  const openSessionRefs = openSessionsSnap.docs.map((d) => d.ref);

  await runTransaction(db, async (tx) => {
    const [callerSnap, classSnap, existingSnap, ...sessionSnaps] = await Promise.all([
      tx.get(doc(db, 'users', user.uid)),
      tx.get(doc(db, 'classes', classId)),
      tx.get(doc(db, 'pengampu', id)),
      ...openSessionRefs.map((ref) => tx.get(ref)),
    ]);

    if (callerSnap.data()?.role !== 'aslab') {
      throw new Error('Hanya Aslab yang dapat melepas Asprak.');
    }
    if (!classSnap.exists() || classSnap.data()?.aslabUid !== user.uid) {
      throw new Error('Anda hanya dapat mengelola Lab milik Anda sendiri.');
    }
    if (!existingSnap.exists()) {
      throw new Error('Penugasan Asprak sudah tidak ada.');
    }
    if (sessionSnaps.some((s) => s.exists() && sesiDipegangAsprak(s.data(), uid))) {
      throw new Error('Asprak masih memiliki sesi yang dibuka di Lab ini dan tidak dapat dilepas.');
    }

    tx.delete(existingSnap.ref);
  });
}

/**
 * Memindahkan Asprak antar-Lab dalam satu transaksi dan mencatatnya di `riwayatPindah` (SRS-023).
 * Ditolak bila Asprak masih memiliki sesi berstatus `dibuka` di Lab asal.
 * Penghapusan dokumen `pengampu` lama mencabut akses ke Lab lama seketika.
 */
export async function pindahAsprak({
  uid,
  dariClassId,
  keClassId,
}: {
  uid: string;
  dariClassId: string;
  keClassId: string;
}): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Silakan masuk kembali sebelum memindahkan Asprak.');
  if (!validId(uid) || !validId(dariClassId) || !validId(keClassId)) {
    throw new Error('ID Asprak atau Lab tidak valid.');
  }
  if (dariClassId === keClassId) {
    throw new Error('Lab tujuan harus berbeda dari Lab asal.');
  }

  const oldId = pengampuDocId(dariClassId, uid);
  const newId = pengampuDocId(keClassId, uid);
  const oldRef = doc(db, 'pengampu', oldId);
  const newRef = doc(db, 'pengampu', newId);
  const fromClassRef = doc(db, 'classes', dariClassId);
  const toClassRef = doc(db, 'classes', keClassId);
  const targetUserRef = doc(db, 'users', uid);
  const historyRef = doc(collection(db, 'riwayatPindah'));

  const openSessionsSnap = await getDocs(
    query(collection(db, 'classes', dariClassId, 'sessions'), where('status', '==', 'dibuka')),
  );
  const openSessionRefs = openSessionsSnap.docs.map((d) => d.ref);

  await runTransaction(db, async (tx) => {
    const [callerSnap, targetSnap, fromClassSnap, toClassSnap, oldSnap, newSnap, ...sessionSnaps] =
      await Promise.all([
        tx.get(doc(db, 'users', user.uid)),
        tx.get(targetUserRef),
        tx.get(fromClassRef),
        tx.get(toClassRef),
        tx.get(oldRef),
        tx.get(newRef),
        ...openSessionRefs.map((ref) => tx.get(ref)),
      ]);

    if (callerSnap.data()?.role !== 'aslab') {
      throw new Error('Hanya Aslab yang dapat memindahkan Asprak.');
    }
    if (!targetSnap.exists() || targetSnap.data()?.role !== 'asprak') {
      throw new Error('Hanya akun berperan Asprak yang bisa dipindahkan.');
    }
    if (!fromClassSnap.exists() || !toClassSnap.exists()) {
      throw new Error('Lab asal atau Lab tujuan tidak ditemukan.');
    }
    if (
      fromClassSnap.data()?.aslabUid !== user.uid ||
      toClassSnap.data()?.aslabUid !== user.uid
    ) {
      throw new Error('Anda hanya dapat memindahkan Asprak antar-Lab milik Anda sendiri.');
    }
    if (!oldSnap.exists()) {
      throw new Error('Asprak tidak ditugaskan di Lab asal.');
    }
    if (newSnap.exists()) {
      throw new Error('Asprak sudah ditugaskan di Lab tujuan.');
    }
    if (sessionSnaps.some((s) => s.exists() && sesiDipegangAsprak(s.data(), uid))) {
      throw new Error('Asprak dengan sesi yang masih dibuka tidak dapat dipindah.');
    }

    const oldData = oldSnap.data();
    const now = serverTimestamp();

    tx.delete(oldRef);
    tx.set(newRef, {
      classId: keClassId,
      uid,
      nama: oldData.nama,
      kode: oldData.kode,
      email: oldData.email ?? null,
      createdAt: now,
      updatedAt: now,
    });
    tx.set(historyRef, {
      jenis: 'asprak',
      uid,
      dariClassId,
      keClassId,
      olehUid: user.uid,
      waktu: now,
    });
  });
}
