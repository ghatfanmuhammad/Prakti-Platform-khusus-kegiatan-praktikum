import type { Timestamp } from 'firebase/firestore';

import type { Koordinat } from '../../utils/geo';

/** Dokumen koleksi `laboratories/{labId}` (SRS-014 & SRS-020). Koordinat memakai lat dan lng. */
export interface Laboratorium {
  id: string;
  nama: string;
  lat: number;
  lng: number;
  /** Radius presensi dalam meter. */
  radiusMeter: number;
  aslabUid?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

/** Nilai form ruang fisik laboratorium. */
export interface LabFormValues {
  nama: string;
  lat: string;
  lng: string;
  radiusMeter: string;
}

/**
 * Lab praktikum (kelompok praktikum per mata kuliah di `classes/{classId}`)
 * digabungkan dengan ruang fisiknya di `laboratories/{labId}` (SRS-020).
 */
export interface LabPraktikum {
  id: string;
  kode: string;
  namaLab: string;
  namaPraktikum: string;
  aslabUid: string;
  labId: string;
  lokasi: string;
  lat: number | null;
  lng: number | null;
  radiusMeter: number | null;
  toleransiMenit: number;
  nominalDenda: number;
  participantCount: number;
  scheduleCount: number;
  sessionCount: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

/** Nilai form Lab & Kebijakan Presensi (semua string karena berasal dari TextInput / CSV). */
export interface LabPraktikumFormValues {
  kode: string;
  namaLab: string;
  namaPraktikum: string;
  lokasi: string;
  lat: string;
  lng: string;
  radiusMeter: string;
  toleransiMenit: string;
  nominalDenda: string;
}

/** Penghubung ke tipe Koordinat (latitude/longitude) yang dipakai geo.ts dan peta. */
export function titikLab(lab: Pick<Laboratorium, 'lat' | 'lng'>): Koordinat {
  return { latitude: lab.lat, longitude: lab.lng };
}

export const RADIUS_MIN = 10;
export const RADIUS_MAX = 1000;
export const RADIUS_DEFAULT = 50;

export const TOLERANSI_MIN = 0;
export const TOLERANSI_MAX = 120;
export const TOLERANSI_DEFAULT = 15;

export const NOMINAL_DENDA_MIN = 1;
export const NOMINAL_DENDA_DEFAULT = 10000;
