/**
 * Aturan validasi lokasi presensi (SRS-013) dan pesan kondisi perangkat (SRS-018, bagian presensi).
 * Murni tanpa efek samping supaya bisa diuji tanpa perangkat.
 */

/** Data laboratorium sesuai kontrak SRS-014: `laboratories/{labId}`. */
export interface Laboratorium {
  id: string;
  nama: string;
  lat: number;
  lng: number;
  radiusMeter: number;
}

export interface Posisi {
  lat: number;
  lng: number;
  /** Perkiraan galat dalam meter; null bila perangkat tidak melaporkannya (mis. web). */
  akurasi: number | null;
}

/** Posisi dengan galat lebih besar dari ini dianggap belum cukup tepat untuk diputuskan. */
export const BATAS_AKURASI_M = 100;

export type HasilLokasi =
  | { jenis: 'dalam_radius'; jarak: number; lab: Laboratorium; akurasi: number | null; posisi: Posisi }
  | { jenis: 'di_luar_radius'; jarak: number; lab: Laboratorium }
  | { jenis: 'kurang_akurat'; akurasi: number }
  | { jenis: 'lab_belum_diatur' }
  | { jenis: 'lab_gagal_dimuat'; pesan: string }
  | { jenis: 'izin_ditolak'; bisaMintaLagi: boolean }
  | { jenis: 'layanan_mati' }
  | { jenis: 'koordinat_tidak_tersedia' };

export type LokasiValid = Extract<HasilLokasi, { jenis: 'dalam_radius' }>;

const JARI_JARI_BUMI_M = 6_371_000;
const rad = (derajat: number) => (derajat * Math.PI) / 180;

/** Jarak permukaan bumi (haversine) antara dua koordinat, dalam meter. */
export function jarakMeter(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * JARI_JARI_BUMI_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Membandingkan posisi perangkat dengan radius laboratorium. */
export function periksaRadius(posisi: Posisi, lab: Laboratorium): HasilLokasi {
  if (!angkaValid(posisi.lat, -90, 90) || !angkaValid(posisi.lng, -180, 180)
    || (posisi.akurasi !== null && !angkaValid(posisi.akurasi, 0, Number.MAX_VALUE))) {
    return { jenis: 'koordinat_tidak_tersedia' };
  }
  if (posisi.akurasi !== null && posisi.akurasi > BATAS_AKURASI_M) {
    return { jenis: 'kurang_akurat', akurasi: posisi.akurasi };
  }
  const jarak = jarakMeter(posisi, lab);
  return jarak <= lab.radiusMeter
    ? { jenis: 'dalam_radius', jarak, lab, akurasi: posisi.akurasi, posisi }
    : { jenis: 'di_luar_radius', jarak, lab };
}

const angkaValid = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;

/** Membaca dokumen laboratorium dari Firestore; null bila datanya tidak lengkap atau tidak masuk akal. */
export function bacaLaboratorium(id: string, data: Record<string, unknown> | undefined): Laboratorium | null {
  if (!data) return null;
  const { nama, lat, lng, radiusMeter } = data;
  if (!angkaValid(lat, -90, 90) || !angkaValid(lng, -180, 180) || !angkaValid(radiusMeter, 1, 10_000)) {
    return null;
  }
  return { id, nama: typeof nama === 'string' && nama.trim() ? nama.trim() : 'Laboratorium', lat, lng, radiusMeter };
}

export const formatMeter = (meter: number): string =>
  meter < 1000 ? `${Math.round(meter)} m` : `${(meter / 1000).toFixed(1).replace('.', ',')} km`;

export function pesanHasilLokasi(hasil: HasilLokasi): string {
  switch (hasil.jenis) {
    case 'dalam_radius':
      return `Kamu berada di ${hasil.lab.nama} (${formatMeter(hasil.jarak)} dari titik lab, radius ${formatMeter(hasil.lab.radiusMeter)}).`;
    case 'di_luar_radius':
      return `Kamu berada ${formatMeter(hasil.jarak)} dari ${hasil.lab.nama}, di luar radius presensi ${formatMeter(hasil.lab.radiusMeter)}. Datang ke laboratorium lalu periksa lagi.`;
    case 'kurang_akurat':
      return `Sinyal lokasi kurang akurat (±${formatMeter(hasil.akurasi)}). Coba dekat jendela atau nyalakan WiFi, lalu periksa lagi.`;
    case 'lab_belum_diatur':
      return 'Lokasi laboratorium untuk sesi ini belum diatur asisten, jadi presensi belum bisa diajukan.';
    case 'lab_gagal_dimuat':
      return hasil.pesan;
    case 'izin_ditolak':
      return hasil.bisaMintaLagi
        ? 'Izin lokasi ditolak. Presensi membutuhkan lokasimu untuk memastikan kamu berada di laboratorium.'
        : 'Izin lokasi ditolak permanen. Aktifkan izin lokasi untuk PRAKTI lewat pengaturan perangkat.';
    case 'layanan_mati':
      return 'Layanan lokasi (GPS) di perangkatmu mati. Nyalakan lokasi, lalu periksa lagi.';
    case 'koordinat_tidak_tersedia':
      return 'Koordinat belum tersedia. Pastikan GPS aktif dan coba periksa lagi beberapa saat.';
  }
}
