import type { PengajuanIzin } from '../../services/izinService';
import type { Presensi, Sesi } from '../../types';
import { formatTanggal } from '../../utils/date';

/** Izin yang masih berlaku untuk sebuah sesi. Izin yang Ditolak boleh diajukan ulang. */
export function izinAktifUntukSesi(
  daftarIzin: PengajuanIzin[],
  sesiId: string,
): PengajuanIzin | undefined {
  return daftarIzin.find((izin) => izin.sesiId === sesiId && izin.status !== 'Ditolak');
}

export interface PilihanSesiIzin {
  sesi: Sesi;
  /** Izin Menunggu/Disetujui yang sudah ada; jika terisi, sesi tidak bisa dipilih. */
  izinAktif?: PengajuanIzin;
}

const kunciWaktu = (s: Sesi) => `${s.tanggal} ${s.mulai}`;

/**
 * [SRS-010] Sesi yang ditampilkan di form pengajuan izin.
 * - Izin bisa diajukan kapan saja, termasuk untuk sesi yang sudah ditutup (izin susulan).
 * - Sesi yang sudah dihadiri praktikan disembunyikan.
 * - Sesi yang sudah punya izin Menunggu/Disetujui tetap tampil, tetapi tidak bisa dipilih.
 * Urutan: sesi yang belum ditutup (terdekat dulu), lalu sesi yang sudah ditutup (terbaru dulu).
 */
export function daftarPilihanSesiIzin(
  sesi: Sesi[],
  presensi: Presensi[],
  daftarIzin: PengajuanIzin[],
  praktikanId: string,
): PilihanSesiIzin[] {
  const sudahHadir = new Set(
    presensi.filter((p) => p.praktikanId === praktikanId).map((p) => p.sesiId),
  );
  const izinSaya = daftarIzin.filter((izin) => izin.praktikanId === praktikanId);
  const tersedia = sesi.filter((s) => !sudahHadir.has(s.id));
  const berjalan = tersedia
    .filter((s) => s.status !== 'ditutup')
    .sort((a, b) => kunciWaktu(a).localeCompare(kunciWaktu(b)));
  const lewat = tersedia
    .filter((s) => s.status === 'ditutup')
    .sort((a, b) => kunciWaktu(b).localeCompare(kunciWaktu(a)));
  return [...berjalan, ...lewat].map((s) => ({ sesi: s, izinAktif: izinAktifUntukSesi(izinSaya, s.id) }));
}

/** Label sesi yang disimpan di dokumen izin dan ditampilkan ke asisten. */
export function namaSesiIzin(sesi: Sesi): string {
  return `${sesi.praktikum} · Kelas ${sesi.kelas} · ${formatTanggal(sesi.tanggal)}`;
}
