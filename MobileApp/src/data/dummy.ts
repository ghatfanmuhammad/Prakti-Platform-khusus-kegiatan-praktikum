// PLACEHOLDER SRS-002: data dummy sementara dari Felicia.
// Kalau PM sudah merge versi resminya, ganti import ke file milik PM.

export type Peran = 'asisten' | 'praktikan';
export type StatusSesi = 'belum_dibuka' | 'dibuka' | 'ditutup';

export type Identitas = {
  id: string;
  peran: Peran;
  nama: string;
  /** NIM untuk praktikan, kode asisten untuk asisten */
  kode: string;
};

export type Jadwal = {
  id: string;
  praktikum: string;
  kelas: string;
  /** format YYYY-MM-DD */
  tanggal: string;
  jamMulai: string;
  jamSelesai: string;
  ruang: string;
  status: StatusSesi;
};

export type Presensi = {
  id: string;
  praktikanId: string;
  jadwalId: string;
  /** format YYYY-MM-DDTHH:mm:ss (waktu lokal) */
  waktuHadir: string;
};

export const ASISTEN: Identitas[] = [
  { id: 'as-01', peran: 'asisten', nama: 'Dimas Prakoso', kode: 'AS-01' },
  { id: 'as-02', peran: 'asisten', nama: 'Salsabila Nur', kode: 'AS-02' },
  { id: 'as-03', peran: 'asisten', nama: 'Bagas Wicaksono', kode: 'AS-03' },
];

export const PRAKTIKAN: Identitas[] = [
  { id: 'pr-01', peran: 'praktikan', nama: 'Anindya Putri', kode: '24060124130011' },
  { id: 'pr-02', peran: 'praktikan', nama: 'Rizky Maulana', kode: '24060124130027' },
  { id: 'pr-03', peran: 'praktikan', nama: 'Citra Lestari', kode: '24060124130034' },
  { id: 'pr-04', peran: 'praktikan', nama: 'Farhan Hidayat', kode: '24060124130048' },
  { id: 'pr-05', peran: 'praktikan', nama: 'Nadia Kusuma', kode: '24060124130056' },
];

export const JADWAL_AWAL: Jadwal[] = [
  { id: 'j-01', praktikum: 'Pemrograman Mobile', kelas: 'A', tanggal: '2026-10-13', jamMulai: '13:00', jamSelesai: '15:00', ruang: 'Lab Komputer 2', status: 'ditutup' },
  { id: 'j-02', praktikum: 'Basis Data', kelas: 'B', tanggal: '2026-10-15', jamMulai: '10:00', jamSelesai: '12:00', ruang: 'Lab Komputer 1', status: 'ditutup' },
  { id: 'j-03', praktikum: 'Jaringan Komputer', kelas: 'A', tanggal: '2026-10-22', jamMulai: '13:00', jamSelesai: '15:00', ruang: 'Lab Jaringan', status: 'dibuka' },
  { id: 'j-04', praktikum: 'Pemrograman Mobile', kelas: 'B', tanggal: '2026-10-27', jamMulai: '09:00', jamSelesai: '11:00', ruang: 'Lab Komputer 2', status: 'belum_dibuka' },
  { id: 'j-05', praktikum: 'Basis Data', kelas: 'A', tanggal: '2026-10-29', jamMulai: '13:00', jamSelesai: '15:00', ruang: 'Lab Komputer 1', status: 'belum_dibuka' },
];

// pr-01 punya 2 riwayat, pr-02 punya 1, sisanya kosong (untuk uji tampilan kosong).
export const PRESENSI_AWAL: Presensi[] = [
  { id: 'p-01', praktikanId: 'pr-01', jadwalId: 'j-01', waktuHadir: '2026-10-13T13:07:00' },
  { id: 'p-02', praktikanId: 'pr-01', jadwalId: 'j-02', waktuHadir: '2026-10-15T10:02:00' },
  { id: 'p-03', praktikanId: 'pr-02', jadwalId: 'j-01', waktuHadir: '2026-10-13T13:15:00' },
];
