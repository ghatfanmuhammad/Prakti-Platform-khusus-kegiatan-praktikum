import type { Presensi, StatusSesi } from '@/data/dummy';

export type { StatusSesi };

/** Satu catatan kehadiran praktikan pada satu sesi (memakai tipe data bersama). */
export type CatatanPresensi = Presensi;

/** Kondisi tampilan presensi untuk satu praktikan pada satu sesi. */
export type KondisiPresensi =
  | 'bisa_presensi'
  | 'sudah_presensi'
  | 'sesi_belum_dibuka'
  | 'sesi_ditutup';
