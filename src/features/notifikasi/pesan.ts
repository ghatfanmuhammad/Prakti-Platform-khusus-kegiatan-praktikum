/**
 * [SRS-017] Isi push notification dan pengolahan respons Expo Push API.
 * Modul ini sengaja murni (tanpa Firebase/Expo) agar mudah diuji.
 */
import { formatTanggal } from '../../utils/date';

/** ID channel Android. Harus sama dengan channel yang dibuat saat registrasi. */
export const CHANNEL_ID = 'default';

/** Batas pesan per permintaan ke Expo Push API. */
export const BATAS_PESAN_PER_PERMINTAAN = 100;

export type DataNotifikasi =
  | { jenis: 'sesi_dibuka'; sesiId: string }
  | { jenis: 'jadwal_berubah'; classId: string }
  | { jenis: 'keputusan_izin'; izinId: string };

export interface IsiNotifikasi {
  title: string;
  body: string;
  data: DataNotifikasi;
}

export interface PesanExpo extends IsiNotifikasi {
  to: string;
  sound: 'default';
  channelId: string;
  priority: 'high';
}

/** Ringkasan pengiriman untuk ditampilkan ke asisten. */
export interface HasilKirim {
  /** Jumlah pengguna yang seharusnya menerima. */
  penerima: number;
  terkirim: number;
  /** Pengguna yang belum mengaktifkan notifikasi (tidak punya token). */
  tanpaToken: number;
  gagal: number;
  /** Diisi bila pengiriman gagal total (mis. koneksi terputus). */
  galat?: string;
}

interface SesiRingkas {
  id: string;
  praktikum: string;
  kelas: string;
  tanggal: string;
  mulai: string;
  selesai: string;
  ruang: string;
  modul?: string;
  topik: string | null;
}

export function pesanSesiDibuka(sesi: SesiRingkas): IsiNotifikasi {
  const materi = sesi.topik || sesi.modul;
  return {
    title: 'Sesi praktikum dibuka',
    body:
      `${sesi.praktikum} · Kelas ${sesi.kelas}${materi ? ` (${materi})` : ''} sudah dibuka di ${sesi.ruang}, ` +
      `${sesi.mulai}–${sesi.selesai}. Segera lakukan presensi.`,
    data: { jenis: 'sesi_dibuka', sesiId: sesi.id },
  };
}

interface KelasRingkas {
  id: string;
  namaPraktikum: string;
  kode: string;
}

interface JadwalRingkas {
  hari: string;
  mulai: string;
  selesai: string;
  ruangan: string;
  labId?: string;
}

export function pesanJadwalBerubah(kelas: KelasRingkas, jadwal: JadwalRingkas): IsiNotifikasi {
  return {
    title: 'Jadwal praktikum berubah',
    body:
      `${kelas.namaPraktikum} · Kelas ${kelas.kode} kini dijadwalkan setiap ${jadwal.hari}, ` +
      `${jadwal.mulai}–${jadwal.selesai} di ${jadwal.ruangan}.`,
    data: { jenis: 'jadwal_berubah', classId: kelas.id },
  };
}

export function pesanSesiDijadwalUlang(
  kelas: KelasRingkas,
  sesi: { modul: string; tanggal: string },
  jadwal: JadwalRingkas,
): IsiNotifikasi {
  return {
    title: 'Jadwal sesi berubah',
    body:
      `${kelas.namaPraktikum} · Kelas ${kelas.kode}: sesi "${sesi.modul}" dipindah ke ` +
      `${formatTanggal(sesi.tanggal)}, ${jadwal.mulai}–${jadwal.selesai} di ${jadwal.ruangan}.`,
    data: { jenis: 'jadwal_berubah', classId: kelas.id },
  };
}

export function pesanKeputusanIzin(izin: {
  id: string;
  sesiNama: string;
  status: 'Disetujui' | 'Ditolak';
  reviewedBy: string;
}): IsiNotifikasi {
  const disetujui = izin.status === 'Disetujui';
  return {
    title: disetujui ? 'Izin disetujui' : 'Izin ditolak',
    body: `Pengajuan izin untuk ${izin.sesiNama} ${disetujui ? 'disetujui' : 'ditolak'} oleh ${izin.reviewedBy}.`,
    data: { jenis: 'keputusan_izin', izinId: izin.id },
  };
}

/** Apakah jadwal berubah dari sisi praktikan (hari, jam, atau ruangan). */
export function jadwalBerubah(sebelum: JadwalRingkas, sesudah: JadwalRingkas): boolean {
  return (
    sebelum.hari !== sesudah.hari ||
    sebelum.mulai !== sesudah.mulai ||
    sebelum.selesai !== sesudah.selesai ||
    sebelum.ruangan !== sesudah.ruangan ||
    (sebelum.labId ?? '') !== (sesudah.labId ?? '')
  );
}

/** Apakah sesi dipindah ke tanggal atau jadwal (slot waktu) lain. */
export function sesiDijadwalUlang(
  sebelum: { tanggal: string; scheduleId: string },
  sesudah: { tanggal: string; scheduleId: string },
): boolean {
  return sebelum.tanggal !== sesudah.tanggal || sebelum.scheduleId !== sesudah.scheduleId;
}

/** Token Expo push yang sah, mis. ExponentPushToken[xxxx]. */
export function tokenValid(token: unknown): token is string {
  return typeof token === 'string' && /^Expo(nent)?PushToken\[[^\]]{1,200}\]$/.test(token);
}

/** Satu pesan per token (duplikat dibuang), dipotong per 100 sesuai batas Expo. */
export function susunPesan(tokens: string[], isi: IsiNotifikasi): PesanExpo[][] {
  const unik = [...new Set(tokens.filter(tokenValid))];
  const pesan = unik.map<PesanExpo>((to) => ({
    to,
    ...isi,
    sound: 'default',
    channelId: CHANNEL_ID,
    priority: 'high',
  }));
  const potongan: PesanExpo[][] = [];
  for (let i = 0; i < pesan.length; i += BATAS_PESAN_PER_PERMINTAAN) {
    potongan.push(pesan.slice(i, i + BATAS_PESAN_PER_PERMINTAAN));
  }
  return potongan;
}

type Tiket = { status?: string; message?: string; details?: { error?: string } };

/**
 * Menghitung tiket dari respons Expo. Tiket 'ok' berarti Expo menerima pesan;
 * tiket 'error' (mis. DeviceNotRegistered) dihitung gagal.
 */
export function hitungTiket(respons: unknown, jumlahPesan: number): { terkirim: number; gagal: number } {
  const data = (respons as { data?: unknown } | null)?.data;
  const tiket: Tiket[] = Array.isArray(data) ? data : data ? [data as Tiket] : [];
  const terkirim = tiket.slice(0, jumlahPesan).filter((t) => t?.status === 'ok').length;
  return { terkirim, gagal: jumlahPesan - terkirim };
}

/** Kalimat ringkas hasil pengiriman untuk toast asisten. */
export function ringkasHasil(hasil: HasilKirim, sebutan = 'praktikan'): string {
  if (hasil.galat) return hasil.terkirim > 0
    ? `Expo menerima ${hasil.terkirim} notifikasi; sebagian gagal: ${hasil.galat}`
    : `Notifikasi gagal dikirim: ${hasil.galat}`;
  if (hasil.penerima === 0) return `Belum ada ${sebutan} yang dapat diberi notifikasi.`;
  if (hasil.terkirim === hasil.penerima) {
    return hasil.penerima === 1
      ? `Notifikasi terkirim ke ${sebutan}.`
      : `Notifikasi terkirim ke ${hasil.penerima} ${sebutan}.`;
  }
  const catatan = [
    hasil.tanpaToken ? `${hasil.tanpaToken} belum mengaktifkan notifikasi` : null,
    hasil.gagal ? `${hasil.gagal} gagal` : null,
  ].filter(Boolean);
  return `Notifikasi terkirim ke ${hasil.terkirim} dari ${hasil.penerima} ${sebutan} (${catatan.join(', ')}).`;
}
