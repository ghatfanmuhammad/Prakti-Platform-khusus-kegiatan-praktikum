import type { Timestamp } from 'firebase/firestore';

import type { Role, SessionStatus } from '../../types';
export type Kind = 'kelas' | 'peserta' | 'jadwal' | 'sesi';
export const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'] as const;
export type Day = (typeof DAYS)[number];
export interface Identity {
  uid: string;
  role: Role;
}
interface RecordBase {
  id: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
export interface PracticumClass extends RecordBase {
  aslabUid: string;
  kode: string;
  namaPraktikum: string;
  /** Nama Lab / kelompok praktikum (SRS-020). */
  namaLab?: string;
  /** UID Aslab pemilik Lab (SRS-020). */
  aslabUid?: string;
  /** ID ruang fisik di koleksi `laboratories` (SRS-020). */
  labId?: string;
  /** Batas toleransi keterlambatan dalam menit, 0–120 (SRS-020). */
  toleransiMenit?: number;
  /** Nominal denda keterlambatan dalam rupiah, > 0 (SRS-020). */
  nominalDenda?: number;
  participantCount: number;
  scheduleCount: number;
  sessionCount: number;
}
export interface Participant extends RecordBase {
  classId: string;
  uid: string;
  nama: string;
  nim: string;
}
export interface Pengampu extends RecordBase {
  classId: string;
  uid: string;
  nama: string;
  kode: string;
  email?: string | null;
}
export interface RiwayatPindah {
  id: string;
  jenis: 'praktikan' | 'asprak';
  uid: string;
  dariClassId: string;
  keClassId: string;
  olehUid: string;
  waktu?: Timestamp;
}
export interface Schedule extends RecordBase {
  hari: Day;
  mulai: string;
  selesai: string;
  ruangan: string;
  /** ID laboratorium (SRS-014). Opsional untuk jadwal lama. */
  labId?: string;
  sessionCount: number;
}
export interface PracticumSession extends RecordBase {
  scheduleId: string;
  tanggal: string;
  modul: string;
  keterangan: string;
  status: SessionStatus;
  asistenId: string;
  topik: string | null;
}
export type PracticumRecord = PracticumClass | Participant | Schedule | PracticumSession;
export type FormValues = Record<string, string>;
