// SEMENTARA, ganti dengan data dummy dari chore/setup-project saat sudah di-merge

export type SessionStatus = 'belum_dibuka' | 'dibuka' | 'ditutup';

export interface Session {
  id: string;
  namaPraktikum: string;
  kelas: string;
  waktu: string;
  status: SessionStatus;

  // Field tambahan khusus untuk kelengkapan informasi di halaman detail sesi (opsional)
  ruangan?: string;
  modul?: string;
  keterangan?: string;
}

export const DUMMY_SESSIONS: Session[] = [
  {
    id: 'sesi-01',
    namaPraktikum: 'Algoritma & Struktur Data',
    kelas: 'IF-2A',
    waktu: 'Senin, 08:00 - 10:00 WIB',
    status: 'dibuka',
    ruangan: 'Lab Komputer Dasar 1',
    modul: 'Modul 3: Linked List & Stack',
    keterangan: 'Harap membawa laptop dan menginstal GCC sebelum praktikum dimulai.',
  },
  {
    id: 'sesi-02',
    namaPraktikum: 'Basis Data',
    kelas: 'IF-2B',
    waktu: 'Senin, 10:30 - 12:30 WIB',
    status: 'belum_dibuka',
    ruangan: 'Lab Rekayasa Perangkat Lunak',
    modul: 'Modul 4: Normalisasi Basis Data & DDL',
    keterangan: 'Pastikan PostgreSQL lokal sudah berjalan.',
  },
  {
    id: 'sesi-03',
    namaPraktikum: 'Pemrograman Berorientasi Objek',
    kelas: 'IF-3A',
    waktu: 'Selasa, 13:00 - 15:00 WIB',
    status: 'dibuka',
    ruangan: 'Lab Komputer Dasar 2',
    modul: 'Modul 5: Inheritance & Polymorphism',
    keterangan: 'Wajib mengumpulkan tugas pendahuluan sebelum sesi ditutup.',
  },
  {
    id: 'sesi-04',
    namaPraktikum: 'Jaringan Komputer',
    kelas: 'IF-3C',
    waktu: 'Rabu, 08:00 - 10:00 WIB',
    status: 'ditutup',
    ruangan: 'Lab Jaringan & Sistem Terdistribusi',
    modul: 'Modul 2: Konfigurasi Subnetting & Routing',
    keterangan: 'Sesi telah berakhir. Rekap kehadiran sudah disimpan.',
  },
  {
    id: 'sesi-05',
    namaPraktikum: 'Pengembangan Aplikasi Mobile',
    kelas: 'IF-4A',
    waktu: 'Kamis, 10:00 - 12:00 WIB',
    status: 'belum_dibuka',
    ruangan: 'Lab Multimedia & Mobile',
    modul: 'Modul 1: Pengenalan React Native & Expo',
    keterangan: 'Siapkan emulator atau perangkat fisik dengan Expo Go terinstal.',
  },
  {
    id: 'sesi-06',
    namaPraktikum: 'Sistem Operasi',
    kelas: 'IF-2C',
    waktu: 'Jumat, 08:30 - 10:30 WIB',
    status: 'ditutup',
    ruangan: 'Lab Komputer Dasar 1',
    modul: 'Modul 1: Manajemen Memori & Process Scheduling',
    keterangan: 'Sesi selesai.',
  },
];
