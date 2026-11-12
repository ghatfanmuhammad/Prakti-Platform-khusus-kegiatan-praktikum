import type { CatatanPresensi } from '@/features/presensi';

/** Satu baris rekap: catatan presensi beserta identitas praktikannya. */
export type KehadiranPraktikan = Pick<CatatanPresensi, 'praktikanId' | 'waktuHadir'> & {
  nama: string;
  nim: string;
};
