import type { Presensi } from '../types';
import { combineDateTime } from '../utils/date';
import { SESI_AWAL } from './sesi';

const tanggalS1 = SESI_AWAL[0].tanggal;

const hadirPada = (praktikanId: string, jam: string): Presensi => ({
  sesiId: 'S1',
  praktikanId,
  waktuHadir: combineDateTime(tanggalS1, jam).toISOString(),
});

/** Tiga praktikan sudah hadir di sesi S1 (sudah ditutup), supaya rekap dan riwayat tidak kosong. */
export const PRESENSI_AWAL: Presensi[] = [
  hadirPada('24060124130069', '08:03:12'),
  hadirPada('24060124140171', '08:05:40'),
  hadirPada('24060124120047', '08:07:21'),
];
