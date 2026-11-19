import type { Presensi, Sesi } from '../../types';

/** Keadaan halaman presensi untuk satu sesi, dilihat dari sisi praktikan (SRS-012). */
export type KeadaanPresensi =
  | { jenis: 'bisa_presensi' }
  | { jenis: 'sudah_presensi'; waktuHadir: string }
  | { jenis: 'belum_dibuka' }
  | { jenis: 'ditutup' };

/**
 * Presensi hanya bisa diajukan saat sesi dibuka dan praktikan belum presensi.
 * Catatan presensi didahulukan agar sesi yang sudah ditutup tetap menampilkan waktu hadir.
 */
export function keadaanPresensi(sesi: Sesi, presensi: Presensi[], praktikanId: string): KeadaanPresensi {
  const catatan = presensi.find((p) => p.sesiId === sesi.id && p.praktikanId === praktikanId);
  if (catatan) return { jenis: 'sudah_presensi', waktuHadir: catatan.waktuHadir };
  if (sesi.status === 'dibuka') return { jenis: 'bisa_presensi' };
  if (sesi.status === 'belum_dibuka') return { jenis: 'belum_dibuka' };
  return { jenis: 'ditutup' };
}

export function pesanKeadaanPresensi(keadaan: Exclude<KeadaanPresensi, { jenis: 'bisa_presensi' }>): string {
  switch (keadaan.jenis) {
    case 'sudah_presensi':
      return 'Kamu sudah presensi pada sesi ini.';
    case 'belum_dibuka':
      return 'Sesi belum dibuka oleh asisten. Presensi bisa diajukan setelah sesi dibuka.';
    case 'ditutup':
      return 'Sesi sudah ditutup, presensi tidak bisa diajukan lagi.';
  }
}
