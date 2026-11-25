import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

import { auth, db } from '../../services/firebase';
import type { Laboratorium, LabFormValues } from './models';
import { validateLab } from './validation';

const COLLECTION = 'laboratories';

/** Pesan ramah untuk kegagalan Firestore. */
export function formatLabError(error: unknown): string {
  const code = (error as { code?: string })?.code?.replace('firestore/', '');
  switch (code) {
    case 'permission-denied':
      return 'Akses ditolak. Hanya asisten yang dapat mengubah data laboratorium.';
    case 'unavailable':
    case 'deadline-exceeded':
      return 'Tidak dapat terhubung. Periksa koneksi internet lalu coba lagi.';
    case 'unauthenticated':
      return 'Sesi login berakhir. Silakan masuk kembali.';
  }
  if (error instanceof Error && !code) return error.message;
  return 'Terjadi kesalahan pada data laboratorium. Coba lagi.';
}

/** Berlangganan daftar laboratorium secara real-time. Mengembalikan fungsi unsubscribe. */
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

/** Tambah (id null) atau ubah laboratorium. Mengembalikan id dokumen. */
export async function simpanLab(id: string | null, values: LabFormValues): Promise<string> {
  if (!auth.currentUser) throw new Error('Sesi login berakhir. Silakan masuk kembali.');
  const data = validateLab(values);
  if (id) {
    await updateDoc(doc(db, COLLECTION, id), { ...data, updatedAt: serverTimestamp() });
    return id;
  }
  const ref = doc(collection(db, COLLECTION));
  await setDoc(ref, { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  return ref.id;
}

export async function hapusLab(id: string): Promise<void> {
  if (!auth.currentUser) throw new Error('Sesi login berakhir. Silakan masuk kembali.');
  await deleteDoc(doc(db, COLLECTION, id));
}