import type { Timestamp } from 'firebase/firestore';

import type { Koordinat } from '../../utils/geo';

/** Dokumen koleksi `laboratories/{labId}` (SRS-014). Koordinat memakai lat dan lng, sama dengan modul presensi. */
export interface Laboratorium {
  id: string;
  nama: string;
  lat: number;
  lng: number;
  /** Radius presensi dalam meter. */
  radiusMeter: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

/** Nilai form laboratorium (semua string karena berasal dari TextInput). */
export interface LabFormValues {
  nama: string;
  lat: string;
  lng: string;
  radiusMeter: string;
}

/** Penghubung ke tipe Koordinat (latitude/longitude) yang dipakai geo.ts dan peta. */
export function titikLab(lab: Pick<Laboratorium, 'lat' | 'lng'>): Koordinat {
  return { latitude: lab.lat, longitude: lab.lng };
}

export const RADIUS_MIN = 10;
export const RADIUS_MAX = 1000;
export const RADIUS_DEFAULT = 50;