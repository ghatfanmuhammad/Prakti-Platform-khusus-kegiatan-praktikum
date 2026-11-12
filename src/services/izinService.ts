import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';

import { db } from './firebase';

export type StatusIzin = 'Menunggu' | 'Disetujui' | 'Ditolak';

export interface PengajuanIzin {
  id?: string;
  praktikanId: string;
  praktikanNama: string;
  praktikanNim: string;
  sesiId: string;
  sesiNama: string;
  alasan: string;
  status: StatusIzin;
  reviewedBy?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

/**
 * [SRS-010 - Praktikan] Mengajukan permohonan izin
 */
export async function ajukanIzin(data: Omit<PengajuanIzin, 'id' | 'status' | 'createdAt' | 'updatedAt'>) {
  if (!data.alasan || data.alasan.trim().length < 5) {
    throw new Error('Alasan izin terlalu pendek atau tidak boleh kosong.');
  }

  const colRef = collection(db, 'izin');
  return await addDoc(colRef, {
    ...data,
    status: 'Menunggu',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/**
 * [SRS-011 - Asisten] Berlangganan (listen) seluruh daftar permohonan izin secara real-time
 */
export function subscribeDaftarIzin(
  onData: (daftar: PengajuanIzin[]) => void,
  onError: (error: Error) => void,
) {
  const colRef = collection(db, 'izin');
  const q = query(colRef, orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot: any) => {
      const hasil: PengajuanIzin[] = snapshot.docs.map((d: any) => ({
        id: d.id,
        ...(d.data() as Omit<PengajuanIzin, 'id'>),
      }));
      onData(hasil);
    },
    (err: any) => {
      onError(err);
    },
  );
}

/**
 * [SRS-011 - Asisten] Menerima atau menolak permohonan izin
 */
export async function periksaIzin(
  izinId: string,
  status: 'Disetujui' | 'Ditolak',
  asistenNama: string,
) {
  const docRef = doc(db, 'izin', izinId);
  return await updateDoc(docRef, {
    status,
    reviewedBy: asistenNama,
    updatedAt: serverTimestamp(),
  });
}
