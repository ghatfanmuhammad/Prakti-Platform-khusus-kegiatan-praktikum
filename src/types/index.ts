export type Role = 'aslab' | 'asprak' | 'praktikan';

export type SessionStatus = 'belum_dibuka' | 'dibuka' | 'ditutup';

export interface Asisten {
  id: string;
  nama: string;
}

export interface Praktikan {
  id: string;
  nim: string;
  nama: string;
}

/** Pengguna yang sedang aktif, dipilih lewat layar pemilihan peran. */
export type CurrentUser =
  | { role: 'aslab'; asisten: Asisten }
  | { role: 'asprak'; asisten: Asisten }
  | { role: 'praktikan'; praktikan: Praktikan };

export interface Sesi {
  id: string;
  classId?: string;
  sessionId?: string;
  modul?: string;
  keterangan?: string;
  praktikum: string;
  kelas: string;
  /** Format YYYY-MM-DD. */
  tanggal: string;
  /** Format HH:mm. */
  mulai: string;
  selesai: string;
  ruang: string;
  /** ID laboratorium (koleksi laboratories). Opsional untuk jadwal lama. */
  labId?: string;
  asistenId: string;
  status: SessionStatus;
  topik: string | null;
  /** Kode 4 angka, terisi saat sesi dibuka. */
  kode: string | null;
}

export interface Presensi {
  sesiId: string;
  praktikanId: string;
  /** Waktu kehadiran dalam format ISO 8601. */
  waktuHadir: string;
}