import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
  type DocumentReference,
  type Transaction,
} from 'firebase/firestore';

import { auth, db } from '../../services/firebase';
import type {
  Laboratorium,
  LabFormValues,
  LabPraktikumFormValues,
} from './models';
import { validateLab, validateLabPraktikum } from './validation';

const COLLECTION = 'laboratories';
const CLASSES_COLLECTION = 'classes';

/** Pesan ramah untuk kegagalan Firestore pada pengelolaan Lab. */
export function formatLabError(error: unknown): string {
  const code = (error as { code?: string })?.code?.replace('firestore/', '');
  switch (code) {
    case 'permission-denied':
      return 'Akses ditolak. Hanya Aslab pemilik Lab yang dapat mengubah data laboratorium.';
    case 'unavailable':
    case 'deadline-exceeded':
      return 'Tidak dapat terhubung. Periksa koneksi internet lalu coba lagi.';
    case 'unauthenticated':
      return 'Sesi login berakhir. Silakan masuk kembali.';
  }
  if (error instanceof Error && !code) return error.message;
  return 'Terjadi kesalahan pada data laboratorium. Coba lagi.';
}

async function assertAslab(tx: Transaction, uid: string) {
  const userSnap = await tx.get(doc(db, 'users', uid));
  if (userSnap.data()?.role !== 'aslab') {
    throw new Error('Hanya Aslab yang dapat mengelola data laboratorium.');
  }
}

/** Berlangganan daftar ruang fisik laboratorium secara real-time. */
export function subscribeLaboratorium(
  onData: (daftar: Laboratorium[]) => void,
  onError: (error: unknown) => void,
): () => void {
  const q = query(collection(db, COLLECTION), orderBy('nama'));
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Laboratorium, 'id'>) }))),
    onError,
  );
}

/** Berlangganan daftar Lab praktikum (`classes`) milik satu Aslab secara real-time. */
export function subscribeLabMilikAslab(
  aslabUid: string,
  onData: (daftar: (DocumentData & { id: string })[]) => void,
  onError: (error: unknown) => void,
): () => void {
  const q = query(collection(db, CLASSES_COLLECTION), where('aslabUid', '==', aslabUid));
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    onError,
  );
}

/** Tambah (id null) atau ubah ruang fisik laboratorium (`laboratories`). Mengembalikan id dokumen. */
export async function simpanLab(id: string | null, values: LabFormValues): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('Sesi login berakhir. Silakan masuk kembali.');
  const data = validateLab(values);
  if (id) {
    await updateDoc(doc(db, COLLECTION, id), { ...data, updatedAt: serverTimestamp() });
    return id;
  }
  const ref = doc(collection(db, COLLECTION));
  await setDoc(ref, {
    ...data,
    aslabUid: user.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function hapusLab(id: string): Promise<void> {
  if (!auth.currentUser) throw new Error('Sesi login berakhir. Silakan masuk kembali.');
  await deleteDoc(doc(db, COLLECTION, id));
}

export interface SimpanLabPraktikumOptions {
  /** ID ruang fisik yang dipilih (null/undefined berarti buat ruang fisik baru). */
  selectedLabId?: string | null;
}

/**
 * Tambah atau ubah Lab praktikum (`classes/{classId}`) beserta ruang fisiknya (`laboratories/{labId}`)
 * dan kebijakan presensi (`toleransiMenit`, `nominalDenda`) secara atomik (SRS-020).
 */
export async function simpanLabPraktikum(
  id: string | null,
  values: LabPraktikumFormValues,
  options: SimpanLabPraktikumOptions = {},
): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('Sesi login berakhir. Silakan masuk kembali.');
  const data = validateLabPraktikum(values);

  const scheduleSnap = id
    ? await getDocs(collection(db, CLASSES_COLLECTION, id, 'schedules'))
    : null;
  const scheduleRefs: DocumentReference[] = scheduleSnap ? scheduleSnap.docs.map((d) => d.ref) : [];

  const classRef = id ? doc(db, CLASSES_COLLECTION, id) : doc(collection(db, CLASSES_COLLECTION));
  const selectedLabId = options.selectedLabId?.trim() || null;

  await runTransaction(db, async (tx) => {
    await assertAslab(tx, user.uid);

    const existingClass = id ? await tx.get(classRef) : null;
    if (id && !existingClass?.exists()) {
      throw new Error('Lab sudah dihapus. Muat ulang daftar.');
    }
    if (id && existingClass?.data()?.aslabUid !== user.uid) {
      throw new Error('Anda hanya dapat mengelola Lab milik Anda sendiri.');
    }

    const candidateLabRef = selectedLabId ? doc(db, COLLECTION, selectedLabId) : null;
    const candidateLabSnap = candidateLabRef ? await tx.get(candidateLabRef) : null;

    // Baca jadwal sebelum melakukan tulis apa pun (syarat transaksi Firestore).
    const scheduleSnaps = await Promise.all(scheduleRefs.map((ref) => tx.get(ref)));

    const now = serverTimestamp();
    const canEditCandidateLab =
      Boolean(candidateLabSnap?.exists()) &&
      (!candidateLabSnap?.data()?.aslabUid || candidateLabSnap?.data()?.aslabUid === user.uid);

    let finalLabRef: DocumentReference;
    if (candidateLabRef && candidateLabSnap?.exists() && canEditCandidateLab) {
      finalLabRef = candidateLabRef;
      tx.update(finalLabRef, {
        nama: data.lokasi,
        lat: data.lat,
        lng: data.lng,
        radiusMeter: data.radiusMeter,
        updatedAt: now,
      });
    } else if (
      candidateLabRef &&
      candidateLabSnap?.exists() &&
      candidateLabSnap.data()?.nama === data.lokasi &&
      candidateLabSnap.data()?.lat === data.lat &&
      candidateLabSnap.data()?.lng === data.lng &&
      candidateLabSnap.data()?.radiusMeter === data.radiusMeter
    ) {
      // Pakai ruang fisik yang sudah ada tanpa mengubah dokumen milik Aslab lain.
      finalLabRef = candidateLabRef;
    } else {
      finalLabRef = doc(collection(db, COLLECTION));
      tx.set(finalLabRef, {
        nama: data.lokasi,
        lat: data.lat,
        lng: data.lng,
        radiusMeter: data.radiusMeter,
        aslabUid: user.uid,
        createdAt: now,
        updatedAt: now,
      });
    }

    const payload = {
      kode: data.kode,
      namaLab: data.namaLab,
      namaPraktikum: data.namaPraktikum,
      labId: finalLabRef.id,
      toleransiMenit: data.toleransiMenit,
      nominalDenda: data.nominalDenda,
      updatedAt: now,
    };

    if (id) {
      tx.update(classRef, payload);
      for (const sSnap of scheduleSnaps) {
        if (!sSnap.exists()) continue;
        tx.update(sSnap.ref, {
          labId: finalLabRef.id,
          ruangan: data.lokasi,
          updatedAt: now,
        });
      }
    } else {
      tx.set(classRef, {
        ...payload,
        aslabUid: user.uid,
        participantCount: 0,
        scheduleCount: 0,
        sessionCount: 0,
        createdAt: now,
      });
    }
  });

  return classRef.id;
}

/**
 * Menghapus Lab praktikum (`classes/{classId}`) milik Aslab (SRS-020).
 * Ditolak bila masih memiliki peserta atau sesi berjalan/riwayat sesi.
 */
export async function hapusLabPraktikum(id: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Sesi login berakhir. Silakan masuk kembali.');

  const classRef = doc(db, CLASSES_COLLECTION, id);
  const [sessionsSnap, schedulesSnap, pengampuSnap] = await Promise.all([
    getDocs(collection(db, CLASSES_COLLECTION, id, 'sessions')),
    getDocs(collection(db, CLASSES_COLLECTION, id, 'schedules')),
    getDocs(query(collection(db, 'pengampu'), where('classId', '==', id))),
  ]);

  const sessionRefs = sessionsSnap.docs.map((d) => d.ref);
  const scheduleRefs = schedulesSnap.docs.map((d) => d.ref);
  const pengampuRefs = pengampuSnap.docs.map((d) => d.ref);

  // Hapus jadwal kosong dan penugasan pengampu lebih dulu hanya setelah validasi lulus,
  // supaya rules `classes` (scheduleCount == 0) tetap terpenuhi.
  await runTransaction(db, async (tx) => {
    await assertAslab(tx, user.uid);
    const snap = await tx.get(classRef);
    if (!snap.exists()) throw new Error('Lab sudah dihapus. Muat ulang daftar.');
    const classData = snap.data();
    if (classData.aslabUid !== user.uid) {
      throw new Error('Anda hanya dapat menghapus Lab milik Anda sendiri.');
    }
    if ((classData.participantCount ?? 0) > 0) {
      throw new Error('Lab yang masih memiliki peserta tidak dapat dihapus.');
    }

    const sessionSnaps = await Promise.all(sessionRefs.map((ref) => tx.get(ref)));
    if (sessionSnaps.some((s) => s.exists() && s.data()?.status === 'dibuka')) {
      throw new Error('Lab yang masih memiliki sesi berjalan tidak dapat dihapus.');
    }
    if ((classData.sessionCount ?? 0) > 0 || sessionSnaps.some((s) => s.exists())) {
      throw new Error('Lab yang masih memiliki sesi tidak dapat dihapus.');
    }

    const scheduleSnaps = await Promise.all(scheduleRefs.map((ref) => tx.get(ref)));
    const pengampuSnaps = await Promise.all(pengampuRefs.map((ref) => tx.get(ref)));

    for (const p of pengampuSnaps) {
      if (p.exists()) tx.delete(p.ref);
    }
    const existingSchedules = scheduleSnaps.filter((s) => s.exists());
    if (existingSchedules.length === 0 && (classData.scheduleCount ?? 0) === 0) {
      tx.delete(classRef);
    } else {
      // Hapus jadwal satu per satu agar counter scheduleCount turun konsisten di Firestore Rules.
      const first = existingSchedules[0];
      if (first) {
        tx.delete(first.ref);
        tx.update(classRef, {
          scheduleCount: Math.max(0, (classData.scheduleCount ?? 1) - 1),
          lastChildId: first.id,
          updatedAt: serverTimestamp(),
        });
      }
    }
  });

  // Jika masih ada jadwal kosong tersisa, bersihkan lalu hapus kelas.
  const remainingSchedules = await getDocs(collection(db, CLASSES_COLLECTION, id, 'schedules'));
  for (const sched of remainingSchedules.docs) {
    await runTransaction(db, async (tx) => {
      await assertAslab(tx, user.uid);
      const snap = await tx.get(classRef);
      const sSnap = await tx.get(sched.ref);
      if (!snap.exists() || !sSnap.exists()) return;
      tx.delete(sched.ref);
      tx.update(classRef, {
        scheduleCount: Math.max(0, (snap.data().scheduleCount ?? 1) - 1),
        lastChildId: sched.id,
        updatedAt: serverTimestamp(),
      });
    });
  }

  // Hapus dokumen kelas bila sebelumnya belum terhapus karena masih punya jadwal kosong.
  await runTransaction(db, async (tx) => {
    await assertAslab(tx, user.uid);
    const snap = await tx.get(classRef);
    if (!snap.exists()) return;
    const classData = snap.data();
    if (classData.aslabUid !== user.uid) {
      throw new Error('Anda hanya dapat menghapus Lab milik Anda sendiri.');
    }
    if ((classData.participantCount ?? 0) > 0) {
      throw new Error('Lab yang masih memiliki peserta tidak dapat dihapus.');
    }
    if ((classData.sessionCount ?? 0) > 0) {
      throw new Error('Lab yang masih memiliki sesi tidak dapat dihapus.');
    }
    tx.delete(classRef);
  });
}
