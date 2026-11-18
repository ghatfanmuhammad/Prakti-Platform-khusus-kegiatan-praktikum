import { usePrakti } from '../../context/PraktiContext';

export interface StatusPresensi {
  /** true selama data sesi, peserta, atau presensi pertama kali dimuat dari Firestore. */
  loading: boolean;
  /** Pesan error koneksi atau izin akses; null jika semua data berhasil dimuat. */
  error: string | null;
  /** Memasang ulang semua listener data praktikum. */
  retry: () => void;
}

/**
 * Status muat data yang dibutuhkan fitur presensi (SRS-009).
 *
 * `practicum.loading` dan `practicum.error` hanya mencakup data kelas dan sesi,
 * jadi status koleksi `attendance` dan `participants` digabungkan di sini. Tanpa ini,
 * rekap dan riwayat akan tampil kosong ("0 hadir") saat data presensi gagal dimuat.
 * Pada mode demo (`practicum` bernilai null) data selalu tersedia secara lokal.
 */
export function useStatusPresensi(): StatusPresensi {
  const { practicum, retryPracticum } = usePrakti();
  if (!practicum) return { loading: false, error: null, retry: retryPracticum };

  const error = practicum.error ?? practicum.attendance.error ?? practicum.participants.error;
  const loading = !error && (
    practicum.loading || practicum.attendance.loading || practicum.participants.loading
  );
  return { loading, error, retry: retryPracticum };
}
