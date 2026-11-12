import type { Praktikan, Presensi, Sesi } from '../types';

const kunciUrut = (s: Sesi): string => `${s.tanggal} ${s.mulai}`;

export const urutkanSesi = (daftar: Sesi[]): Sesi[] =>
  [...daftar].sort((a, b) => kunciUrut(a).localeCompare(kunciUrut(b)));

export const cariSesi = (daftar: Sesi[], id: string): Sesi | undefined =>
  daftar.find((s) => s.id === id);

export const sesiMilikAsisten = (daftar: Sesi[], asistenId: string): Sesi[] =>
  urutkanSesi(daftar.filter((s) => s.asistenId === asistenId));

/** Sesi yang sedang dibuka, atau sesi terdekat yang belum dibuka. */
export const sesiUtama = (daftar: Sesi[]): Sesi | undefined => {
  const urut = urutkanSesi(daftar);
  return urut.find((s) => s.status === 'dibuka') ?? urut.find((s) => s.status === 'belum_dibuka');
};

export const sesiBerikutnya = (daftar: Sesi[], utama?: Sesi): Sesi | undefined =>
  urutkanSesi(daftar).find((s) => s.status === 'belum_dibuka' && s.id !== utama?.id);

/** Sesi yang paling relevan untuk direkap: yang dibuka, atau yang terakhir ditutup. */
export const sesiUntukRekap = (daftar: Sesi[]): Sesi | undefined => {
  const urut = urutkanSesi(daftar);
  return urut.find((s) => s.status === 'dibuka') ?? [...urut].reverse().find((s) => s.status === 'ditutup');
};

export const presensiSesi = (presensi: Presensi[], sesiId: string): Presensi[] =>
  presensi
    .filter((p) => p.sesiId === sesiId)
    .sort((a, b) => a.waktuHadir.localeCompare(b.waktuHadir));

export const cariPresensi = (
  presensi: Presensi[],
  sesiId: string,
  praktikanId: string,
): Presensi | undefined =>
  presensi.find((p) => p.sesiId === sesiId && p.praktikanId === praktikanId);

export interface RiwayatItem {
  presensi: Presensi;
  sesi: Sesi;
}

/** Riwayat kehadiran satu praktikan, terbaru di atas. */
export const riwayatPraktikan = (
  presensi: Presensi[],
  daftarSesi: Sesi[],
  praktikanId: string,
): RiwayatItem[] =>
  presensi
    .filter((p) => p.praktikanId === praktikanId)
    .flatMap((p) => {
      const sesi = cariSesi(daftarSesi, p.sesiId);
      return sesi ? [{ presensi: p, sesi }] : [];
    })
    .sort((a, b) => b.presensi.waktuHadir.localeCompare(a.presensi.waktuHadir));

export interface RekapSesi {
  hadir: { praktikan: Praktikan; presensi: Presensi }[];
  belumHadir: Praktikan[];
}

export const rekapSesi = (
  presensi: Presensi[],
  sesiId: string,
  daftarPraktikan: Praktikan[],
): RekapSesi => {
  const catatan = presensiSesi(presensi, sesiId);
  const hadir = catatan.flatMap((p) => {
    const praktikan = daftarPraktikan.find((x) => x.id === p.praktikanId);
    return praktikan ? [{ praktikan, presensi: p }] : [];
  });
  const idHadir = new Set(catatan.map((p) => p.praktikanId));
  const belumHadir = daftarPraktikan.filter((x) => !idHadir.has(x.id));
  return { hadir, belumHadir };
};

export interface StatistikKehadiran {
  hadir: number;
  total: number;
  /** 0 sampai 1, atau null bila belum ada sesi selesai. */
  rasio: number | null;
}

/** Kehadiran praktikan pada sesi yang sudah ditutup. */
export const statistikKehadiran = (
  daftarSesi: Sesi[],
  presensi: Presensi[],
  praktikanId: string,
): StatistikKehadiran => {
  const selesai = daftarSesi.filter((s) => s.status === 'ditutup');
  const hadir = selesai.filter((s) => cariPresensi(presensi, s.id, praktikanId)).length;
  return { hadir, total: selesai.length, rasio: selesai.length === 0 ? null : hadir / selesai.length };
};
