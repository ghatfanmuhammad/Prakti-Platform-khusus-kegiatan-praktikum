import type { Sesi } from '../../types';
import type { Laboratorium } from './models';

export interface AktivitasLab {
  /** Sesi yang sedang berlangsung (status Dibuka). */
  berlangsung: Sesi[];
  /** Sesi terdekat yang belum dibuka dan belum lewat. Null bila tidak ada. */
  berikutnya: Sesi | null;
}

const normal = (teks: string) => teks.trim().toLowerCase();

/** Sesi milik lab: lewat labId bila ada, kalau tidak lewat kecocokan nama ruangan. */
export function sesiMilikLab(lab: Laboratorium, sesi: Sesi[]): Sesi[] {
  return sesi.filter((s) => (s.labId ? s.labId === lab.id : normal(s.ruang) === normal(lab.nama)));
}

function waktu(tanggal: string, jam: string): number {
  return new Date(`${tanggal}T${jam}:00`).getTime();
}

/**
 * Aktivitas satu laboratorium (SRS-016).
 * - berlangsung: status sesi Dibuka.
 * - berikutnya: sesi Belum Dibuka yang belum selesai, diurutkan dari yang terdekat.
 */
export function aktivitasLab(lab: Laboratorium, sesi: Sesi[], sekarang = Date.now()): AktivitasLab {
  const milik = sesiMilikLab(lab, sesi);
  const berlangsung = milik.filter((s) => s.status === 'dibuka');
  const berikutnya =
    milik
      .filter((s) => s.status === 'belum_dibuka' && waktu(s.tanggal, s.selesai) >= sekarang)
      .sort((a, b) => waktu(a.tanggal, a.mulai) - waktu(b.tanggal, b.mulai))[0] ?? null;
  return { berlangsung, berikutnya };
}