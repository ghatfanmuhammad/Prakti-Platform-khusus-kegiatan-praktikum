/**
 * [SRS-027/SRS-029] Akses aplikasi ke tagihan & pembayaran.
 * Aplikasi hanya MEMBACA denda/pembayaran dan meminta server membuat transaksi.
 * Status pembayaran tidak pernah ditentukan dari hasil redirect di aplikasi.
 */
import { FirebaseError } from 'firebase/app';
import { collection, onSnapshot, query, where, type Timestamp } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import * as WebBrowser from 'expo-web-browser';

import { URL_KEMBALI_APLIKASI, type Denda, type Pembayaran } from '../features/pembayaran/kontrak';
import { app, db } from './firebase';

export interface HasilLangganan<T> {
  daftar: T[];
  dariCache: boolean;
}

const milidetik = (ts: unknown): number => (ts as Timestamp | null | undefined)?.toMillis?.() ?? 0;

export function subscribeDenda(
  praktikanId: string,
  onData: (hasil: HasilLangganan<Denda>) => void,
  onError: (err: unknown) => void,
) {
  const q = query(collection(db, 'denda'), where('praktikanId', '==', praktikanId));
  return onSnapshot(
    q,
    { includeMetadataChanges: true },
    (snap) => {
      const daftar = snap.docs.map((d) => ({ ...(d.data() as Omit<Denda, 'id'>), id: d.id }));
      // Urutkan di klien agar tidak memerlukan indeks gabungan.
      daftar.sort((a, b) => b.tanggal.localeCompare(a.tanggal) || milidetik(b.createdAt) - milidetik(a.createdAt));
      onData({ daftar, dariCache: snap.metadata.fromCache });
    },
    onError,
  );
}

export function subscribePembayaran(
  praktikanId: string,
  onData: (hasil: HasilLangganan<Pembayaran>) => void,
  onError: (err: unknown) => void,
) {
  const q = query(collection(db, 'pembayaran'), where('praktikanId', '==', praktikanId));
  return onSnapshot(
    q,
    { includeMetadataChanges: true },
    (snap) => {
      const daftar = snap.docs.map((d) => d.data() as Pembayaran);
      daftar.sort((a, b) => milidetik(b.createdAt) - milidetik(a.createdAt));
      onData({ daftar, dariCache: snap.metadata.fromCache });
    },
    onError,
  );
}

/**
 * Meminta server membuat transaksi Snap lalu membuka halaman pembayaran Midtrans.
 * Mengembalikan 'kembali' bila Midtrans mengarahkan ke prakti://, 'ditutup' bila browser ditutup.
 * Keduanya hanya menandakan halaman selesai; status asli datang dari Firestore (webhook).
 */
export async function bayarDenda(dendaId: string): Promise<'kembali' | 'ditutup'> {
  const call = httpsCallable<{ dendaId: string }, { orderId: string; redirectUrl: string }>(getFunctions(app), 'buatTransaksi');
  const { redirectUrl } = (await call({ dendaId })).data;
  const hasil = await WebBrowser.openAuthSessionAsync(redirectUrl, URL_KEMBALI_APLIKASI);
  return hasil.type === 'success' ? 'kembali' : 'ditutup';
}

export function formatPembayaranError(err: unknown): string {
  if (err instanceof FirebaseError) {
    const kode = err.code.replace(/^functions\//, '');
    // Pesan dari HttpsError server sudah disanitasi dan berbahasa Indonesia.
    if (['failed-precondition', 'permission-denied', 'not-found', 'invalid-argument', 'unavailable'].includes(kode)) {
      return err.message;
    }
    if (kode === 'unauthenticated') return 'Sesi login berakhir. Silakan masuk lagi.';
    if (kode === 'internal' && err.message !== 'internal') return err.message;
  }
  return 'Server pembayaran tidak dapat dihubungi. Periksa koneksi lalu coba lagi.';
}

export function formatMuatError(err: unknown): string {
  const kode = (err as { code?: string })?.code;
  if (kode === 'permission-denied') return 'Akses data tagihan ditolak.';
  if (kode === 'unavailable') return 'Tidak ada koneksi internet.';
  return 'Data tagihan gagal dimuat.';
}
