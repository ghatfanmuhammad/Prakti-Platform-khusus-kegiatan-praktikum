/** Status sesi praktikum (SRS-003/004 akan mengubah nilai ini). */
export type StatusSesi = 'belum_dibuka' | 'dibuka' | 'ditutup';

/** Satu catatan kehadiran praktikan pada satu sesi. */
export type CatatanPresensi = {
  sesiId: string;
  praktikanId: string;
  /** Waktu presensi dalam format ISO, contoh: 2026-10-22T08:30:00.000Z */
  waktuHadir: string;
};

/** Kondisi tampilan presensi untuk satu praktikan pada satu sesi. */
export type KondisiPresensi =
  | 'bisa_presensi'
  | 'sudah_presensi'
  | 'sesi_belum_dibuka'
  | 'sesi_ditutup';
