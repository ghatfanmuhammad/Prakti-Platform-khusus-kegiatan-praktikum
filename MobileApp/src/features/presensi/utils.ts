import type { CatatanPresensi, KondisiPresensi, StatusSesi } from './types';

const NAMA_BULAN = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

/**
 * Menentukan tampilan presensi.
 * Catatan yang sudah ada diprioritaskan agar presensi ganda tidak mungkin,
 * walaupun sesi sudah ditutup setelahnya.
 */
export function tentukanKondisiPresensi(
  statusSesi: StatusSesi,
  catatan?: CatatanPresensi | null,
): KondisiPresensi {
  if (catatan) return 'sudah_presensi';
  if (statusSesi === 'dibuka') return 'bisa_presensi';
  if (statusSesi === 'belum_dibuka') return 'sesi_belum_dibuka';
  return 'sesi_ditutup';
}

const dua = (n: number) => String(n).padStart(2, '0');

/** Contoh hasil: "22 Oktober 2026, 08:30:15" (memakai zona waktu perangkat). */
export function formatWaktuHadir(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  const tanggal = `${d.getDate()} ${NAMA_BULAN[d.getMonth()]} ${d.getFullYear()}`;
  const jam = `${dua(d.getHours())}:${dua(d.getMinutes())}:${dua(d.getSeconds())}`;
  return `${tanggal}, ${jam}`;
}
