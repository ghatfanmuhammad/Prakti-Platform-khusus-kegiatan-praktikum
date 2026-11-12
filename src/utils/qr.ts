import type { Sesi } from '../types';

const PREFIX = 'PRAKTI';

/** Isi QR presensi: "PRAKTI:<sesiId>:<kode>". */
export function buatIsiQr(sesi: Pick<Sesi, 'id' | 'kode'>): string {
  return `${PREFIX}:${sesi.id}:${sesi.kode ?? ''}`;
}

export interface IsiQr {
  sesiId: string;
  kode: string;
}

/** Membaca isi QR; null bila bukan QR presensi PRAKTI. */
export function bacaIsiQr(data: string): IsiQr | null {
  const bagian = data.trim().split(':');
  if (bagian.length !== 3 || bagian[0] !== PREFIX) return null;
  const [, sesiId, kode] = bagian;
  if (!sesiId || !kode) return null;
  return { sesiId, kode };
}
