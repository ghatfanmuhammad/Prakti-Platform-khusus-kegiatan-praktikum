import type { KehadiranPraktikan } from './types';

/** Mengurutkan praktikan dari yang paling awal hadir. */
export function urutkanBerdasarkanWaktuHadir(daftar: KehadiranPraktikan[]): KehadiranPraktikan[] {
  return [...daftar].sort(
    (a, b) => new Date(a.waktuHadir).getTime() - new Date(b.waktuHadir).getTime(),
  );
}

const dua = (n: number) => String(n).padStart(2, '0');

/** Contoh hasil: "08:30" (memakai zona waktu perangkat). */
export function formatJamHadir(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return `${dua(d.getHours())}:${dua(d.getMinutes())}`;
}
