import type { Timestamp } from 'firebase/firestore';

/** Dokumen koleksi `laboratories/{labId}` (SRS-014). */
export interface Laboratorium {
  id: string;
  nama: string;
  latitude: number;
  longitude: number;
  /** Radius presensi dalam meter. */
  radiusMeter: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

/** Nilai form laboratorium (semua string karena berasal dari TextInput). */
export interface LabFormValues {
  nama: string;
  latitude: string;
  longitude: string;
  radiusMeter: string;
}

export const RADIUS_MIN = 10;
export const RADIUS_MAX = 1000;
export const RADIUS_DEFAULT = 50;