import type { Sesi } from '../types';
import { addDays, toDateKey } from '../utils/date';

const hariIni = new Date();

/**
 * Tanggal dibuat relatif terhadap hari ini supaya demo selalu terasa "hari ini",
 * kapan pun aplikasi dijalankan.
 */
export const SESI_AWAL: Sesi[] = [
  {
    id: 'S1',
    praktikum: 'Basis Data',
    kelas: 'A',
    tanggal: toDateKey(addDays(hariIni, -1)),
    mulai: '08:00',
    selesai: '10:00',
    ruang: 'Lab 2',
    asistenId: 'A1',
    status: 'ditutup',
    topik: 'Pengenalan SQL',
    kode: '7315',
  },
  {
    id: 'S2',
    praktikum: 'Pemrograman Mobile',
    kelas: 'B',
    tanggal: toDateKey(hariIni),
    mulai: '10:00',
    selesai: '12:00',
    ruang: 'Lab 1',
    asistenId: 'A1',
    status: 'belum_dibuka',
    topik: null,
    kode: null,
  },
  {
    id: 'S3',
    praktikum: 'Jaringan Komputer',
    kelas: 'A',
    tanggal: toDateKey(hariIni),
    mulai: '13:00',
    selesai: '15:00',
    ruang: 'Lab 3',
    asistenId: 'A2',
    status: 'belum_dibuka',
    topik: null,
    kode: null,
  },
  {
    id: 'S4',
    praktikum: 'Basis Data',
    kelas: 'A',
    tanggal: toDateKey(addDays(hariIni, 7)),
    mulai: '08:00',
    selesai: '10:00',
    ruang: 'Lab 2',
    asistenId: 'A1',
    status: 'belum_dibuka',
    topik: null,
    kode: null,
  },
];
