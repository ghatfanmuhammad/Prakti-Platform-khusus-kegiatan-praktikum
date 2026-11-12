import type { Presensi, Sesi } from '../types';
import { PANJANG_KODE } from './code';
import { formatJam } from './date';
import { cariPresensi, cariSesi } from './selectors';

export type CheckInFailure =
  | 'SESI_TIDAK_DITEMUKAN'
  | 'SESI_BELUM_DIBUKA'
  | 'SESI_DITUTUP'
  | 'SUDAH_PRESENSI'
  | 'KODE_KOSONG'
  | 'KODE_TIDAK_LENGKAP'
  | 'KODE_SALAH';

export type CheckInResult =
  | { ok: true; presensi: Presensi }
  | { ok: false; reason: CheckInFailure; waktuHadir?: string };

interface CheckInData {
  sesi: Sesi[];
  presensi: Presensi[];
}

/**
 * Aturan presensi, murni tanpa efek samping:
 * sesi harus dibuka, satu praktikan hanya sekali per sesi, dan kode harus cocok.
 */
export function evaluateCheckIn(
  data: CheckInData,
  sesiId: string,
  praktikanId: string,
  kode: string,
  now: Date = new Date(),
): CheckInResult {
  const target = cariSesi(data.sesi, sesiId);
  if (!target) return { ok: false, reason: 'SESI_TIDAK_DITEMUKAN' };
  if (target.status === 'belum_dibuka') return { ok: false, reason: 'SESI_BELUM_DIBUKA' };
  if (target.status === 'ditutup') return { ok: false, reason: 'SESI_DITUTUP' };

  const sudah = cariPresensi(data.presensi, sesiId, praktikanId);
  if (sudah) return { ok: false, reason: 'SUDAH_PRESENSI', waktuHadir: sudah.waktuHadir };

  const masukan = kode.trim();
  if (masukan.length === 0) return { ok: false, reason: 'KODE_KOSONG' };
  if (masukan.length < PANJANG_KODE) return { ok: false, reason: 'KODE_TIDAK_LENGKAP' };
  if (masukan !== target.kode) return { ok: false, reason: 'KODE_SALAH' };

  return { ok: true, presensi: { sesiId, praktikanId, waktuHadir: now.toISOString() } };
}

export function pesanGagalPresensi(hasil: Extract<CheckInResult, { ok: false }>): string {
  switch (hasil.reason) {
    case 'SESI_TIDAK_DITEMUKAN':
      return 'Sesi tidak ditemukan';
    case 'SESI_BELUM_DIBUKA':
      return 'Sesi belum dibuka oleh asisten';
    case 'SESI_DITUTUP':
      return 'Sesi sudah ditutup';
    case 'SUDAH_PRESENSI':
      return hasil.waktuHadir
        ? `Kamu sudah presensi pukul ${formatJam(hasil.waktuHadir)}`
        : 'Kamu sudah presensi pada sesi ini';
    case 'KODE_KOSONG':
      return 'Kode sesi wajib diisi';
    case 'KODE_TIDAK_LENGKAP':
      return `Kode sesi terdiri dari ${PANJANG_KODE} angka`;
    case 'KODE_SALAH':
      return 'Kode sesi salah';
  }
}
