import type { Timestamp } from 'firebase/firestore';

export type Role = 'asisten' | 'praktikan';
export type Kind = 'kelas' | 'peserta' | 'jadwal' | 'sesi';
export type SessionStatus = 'belum_dibuka' | 'dibuka' | 'ditutup';
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
  kode: string;
  namaPraktikum: string;
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
export interface Schedule extends RecordBase {
  hari: Day;
  mulai: string;
  selesai: string;
  ruangan: string;
  sessionCount: number;
}
export interface PracticumSession extends RecordBase {
  scheduleId: string;
  tanggal: string;
  modul: string;
  keterangan: string;
  status: SessionStatus;
}
export type PracticumRecord = PracticumClass | Participant | Schedule | PracticumSession;
export type FormValues = Record<string, string>;
