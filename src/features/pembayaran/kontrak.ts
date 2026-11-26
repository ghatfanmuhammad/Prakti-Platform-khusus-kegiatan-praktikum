/**
 * [SRS-027/028/029] Kontrak data denda & pembayaran yang dipakai bersama aplikasi dan Cloud Functions.
 * Modul ini murni (tanpa Firebase/Expo) agar bisa diimpor server dan diuji langsung.
 *
 * denda/{dendaId}
 *   Dibuat server oleh SRS-025 (satu dokumen per kejadian terlambat). ID yang disarankan sama dengan
 *   ID presensi `${classId}~${sessionId}~${praktikanId}` sehingga satu keterlambatan = satu tagihan.
 *
 * pembayaran/{orderId}
 *   Dibuat dan diubah HANYA oleh server (buatTransaksi & midtransNotifikasi). Aplikasi hanya membaca.
 */

export type StatusDenda = 'belum_dibayar' | 'pending' | 'lunas' | 'gagal' | 'dibebaskan';
export type StatusPembayaran = 'pending' | 'success' | 'failed';

export interface Denda {
  id: string;
  praktikanId: string;
  classId: string;
  sessionId: string;
  /** ID catatan presensi terkait (attendance/{id}). */
  attendanceId: string;
  /** Label sesi untuk ditampilkan, mis. "Basis Data · Modul 2". */
  sesiNama: string;
  /** Tanggal sesi, YYYY-MM-DD. */
  tanggal: string;
  menitTerlambat: number;
  /** Rupiah, bilangan bulat. */
  nominal: number;
  status: StatusDenda;
  /** Order Midtrans terakhir yang dibuat untuk denda ini. */
  orderIdTerakhir?: string | null;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Pembayaran {
  orderId: string;
  dendaId: string;
  praktikanId: string;
  sesiNama: string;
  /** Tanggal tagihan (tanggal sesi), YYYY-MM-DD. */
  tanggalTagihan: string;
  nominal: number;
  status: StatusPembayaran;
  /** transaction_status terakhir dari Midtrans yang sudah diverifikasi server (null bila belum ada). */
  statusMidtrans: string | null;
  metode: string | null;
  redirectUrl: string | null;
  /** Epoch ms batas Snap dapat dipakai. */
  kedaluwarsaPada: number;
  createdAt?: unknown;
  updatedAt?: unknown;
  dibayarPada?: unknown;
}

/**
 * Deep link tujuan Midtrans setelah pembayaran (callbacks.finish). Ditetapkan server,
 * bukan dari input aplikasi. Harus cocok dengan `scheme` di app.json.
 */
export const URL_KEMBALI_APLIKASI = 'prakti://pembayaran';

/** Lama transaksi Snap dapat dibayar sebelum kedaluwarsa (menit). */
export const MASA_BERLAKU_MENIT = 60;

/** Denda yang boleh dibuatkan transaksi baru. */
export const DENDA_BISA_DIBAYAR: readonly StatusDenda[] = ['belum_dibayar', 'gagal', 'pending'];

export const LABEL_DENDA: Record<StatusDenda, string> = {
  belum_dibayar: 'Belum dibayar',
  pending: 'Menunggu pembayaran',
  lunas: 'Lunas',
  gagal: 'Gagal',
  dibebaskan: 'Dibebaskan',
};

export const LABEL_PEMBAYARAN: Record<StatusPembayaran, string> = {
  pending: 'Pending',
  success: 'Berhasil',
  failed: 'Gagal',
};

/** Rp10.000 */
export function formatRupiah(nominal: number): string {
  const angka = Math.round(Number.isFinite(nominal) ? nominal : 0);
  return `Rp${angka.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

/** ID dokumen Firestore yang aman (sama dengan aturan idValid di rules, ditambah ~ untuk ID gabungan). */
export function idDokumenValid(id: unknown): id is string {
  return typeof id === 'string' && /^[A-Za-z0-9_~-]{1,400}$/.test(id);
}
