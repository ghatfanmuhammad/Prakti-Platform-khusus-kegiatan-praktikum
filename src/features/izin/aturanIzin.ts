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

/**
 * [SRS-010] Sesi yang ditampilkan di form pengajuan izin, terdekat lebih dulu.
 * - Sesi yang sudah ditutup disembunyikan (izin hanya untuk sesi yang belum berakhir).
 * - Sesi yang sudah dihadiri praktikan disembunyikan.
 * - Sesi yang sudah punya izin Menunggu/Disetujui tetap tampil, tetapi tidak bisa dipilih.
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
  return sesi
    .filter((s) => s.status !== 'ditutup' && !sudahHadir.has(s.id))
    .sort((a, b) => `${a.tanggal} ${a.mulai}`.localeCompare(`${b.tanggal} ${b.mulai}`))
    .map((s) => ({ sesi: s, izinAktif: izinAktifUntukSesi(izinSaya, s.id) }));
}

/** Label sesi yang disimpan di dokumen izin dan ditampilkan ke asisten. */
export function namaSesiIzin(sesi: Sesi): string {
  return `${sesi.praktikum} · Kelas ${sesi.kelas} · ${formatTanggal(sesi.tanggal)}`;
}
