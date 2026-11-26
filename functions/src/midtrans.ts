/**
 * [SRS-027/SRS-028] Logika Midtrans Snap (Sandbox) di sisi server.
 * Bagian murni (status, signature, keputusan transaksi) dipisah agar bisa diuji tanpa jaringan.
 * Server key hanya ada di Cloud Functions (secret MIDTRANS_SERVER_KEY), tidak pernah di aplikasi.
 */
import { createHash, timingSafeEqual } from 'node:crypto';

import {
  MASA_BERLAKU_MENIT,
  URL_KEMBALI_APLIKASI,
  type Denda,
  type Pembayaran,
  type StatusDenda,
  type StatusPembayaran,
} from '../../src/features/pembayaran/kontrak';

export const SNAP_URL = 'https://app.sandbox.midtrans.com/snap/v1/transactions';
export const API_URL = 'https://api.sandbox.midtrans.com';
const BATAS_WAKTU_MS = 10000;

export type KodeGalat =
  | 'unauthenticated'
  | 'permission-denied'
  | 'invalid-argument'
  | 'not-found'
  | 'failed-precondition'
  | 'unavailable';

export class PembayaranError extends Error {
  constructor(public code: KodeGalat, message: string) {
    super(message);
  }
}

// ---------- Signature & status (SRS-028) ----------

export interface NotifikasiMidtrans {
  order_id: string;
  status_code: string;
  gross_amount: string;
  signature_key: string;
}

/** Ambil field wajib notifikasi; null bila bentuknya tidak sah. */
export function bacaNotifikasi(body: unknown): NotifikasiMidtrans | null {
  const b = body as Record<string, unknown> | null;
  if (!b || typeof b !== 'object') return null;
  const fields = ['order_id', 'status_code', 'gross_amount', 'signature_key'] as const;
  if (fields.some((f) => typeof b[f] !== 'string' || (b[f] as string).length === 0 || (b[f] as string).length > 256)) {
    return null;
  }
  return {
    order_id: b.order_id as string,
    status_code: b.status_code as string,
    gross_amount: b.gross_amount as string,
    signature_key: b.signature_key as string,
  };
}

/** signature_key = SHA512(order_id + status_code + gross_amount + serverKey), hex. */
export function hitungSignature(n: Omit<NotifikasiMidtrans, 'signature_key'>, serverKey: string): string {
  return createHash('sha512').update(n.order_id + n.status_code + n.gross_amount + serverKey).digest('hex');
}

export function verifikasiSignature(n: NotifikasiMidtrans, serverKey: string): boolean {
  if (!serverKey) return false;
  const harap = Buffer.from(hitungSignature(n, serverKey), 'utf8');
  const terima = Buffer.from(n.signature_key.toLowerCase(), 'utf8');
  return harap.length === terima.length && timingSafeEqual(harap, terima);
}

/**
 * Memetakan transaction_status Midtrans ke status aplikasi. null = status yang tidak mengubah apa pun
 * (mis. refund/authorize), sehingga diabaikan.
 */
export function petakanStatus(transactionStatus: unknown, fraudStatus?: unknown): StatusPembayaran | null {
  switch (typeof transactionStatus === 'string' ? transactionStatus.toLowerCase() : '') {
    case 'settlement':
      return 'success';
    case 'capture':
      // Kartu: challenge masih ditahan FDS, deny berarti gagal.
      if (fraudStatus === 'challenge') return 'pending';
      if (fraudStatus === 'deny') return 'failed';
      return 'success';
    case 'pending':
      return 'pending';
    case 'deny':
    case 'cancel':
    case 'expire':
    case 'failure':
      return 'failed';
    default:
      return null;
  }
}

/**
 * Status tidak pernah mundur: success final; pending tidak menimpa success/failed.
 * failed -> success tetap diterima karena uang benar-benar masuk.
 */
export function statusBerikut(lama: StatusPembayaran, baru: StatusPembayaran): StatusPembayaran {
  if (lama === 'success') return 'success';
  if (baru === 'pending') return lama;
  return baru;
}

/** Status denda setelah pembayaran berubah. null = denda tidak diubah. */
export function statusDendaSetelah(
  denda: Pick<Denda, 'status' | 'orderIdTerakhir'>,
  orderId: string,
  status: StatusPembayaran,
): StatusDenda | null {
  if (status === 'success') return denda.status === 'lunas' ? null : 'lunas';
  // Kegagalan order lama tidak boleh menimpa order yang lebih baru.
  if (status === 'failed' && denda.orderIdTerakhir === orderId && denda.status === 'pending') return 'gagal';
  return null;
}

// ---------- Keputusan membuat transaksi (SRS-027) ----------

export type KeputusanTransaksi =
  | { aksi: 'pakai_ulang'; orderId: string; redirectUrl: string }
  | { aksi: 'buat' };

/**
 * Memeriksa tagihan milik pemanggil dan belum lunas. Bila transaksi terakhir masih berlaku,
 * tautan yang sama dipakai ulang agar tidak terjadi dua pembayaran untuk satu denda.
 */
export function putuskanTransaksi(
  denda: Denda | undefined,
  uid: string,
  terakhir: Pembayaran | undefined,
  sekarang: number,
): KeputusanTransaksi {
  if (!denda) throw new PembayaranError('not-found', 'Tagihan tidak ditemukan.');
  if (denda.praktikanId !== uid) throw new PembayaranError('permission-denied', 'Tagihan ini bukan milikmu.');
  if (denda.status === 'lunas') throw new PembayaranError('failed-precondition', 'Tagihan sudah lunas.');
  if (denda.status === 'dibebaskan') throw new PembayaranError('failed-precondition', 'Tagihan ini dibebaskan dari denda.');
  if (!Number.isInteger(denda.nominal) || denda.nominal <= 0) {
    throw new PembayaranError('failed-precondition', 'Nominal tagihan tidak valid.');
  }
  if (denda.status === 'pending' && terakhir?.status === 'pending' && sekarang < terakhir.kedaluwarsaPada) {
    if (!terakhir.redirectUrl) {
      throw new PembayaranError('failed-precondition', 'Transaksi sedang disiapkan. Coba lagi sebentar.');
    }
    // Sisakan 1 menit agar praktikan tidak membuka halaman yang hampir kedaluwarsa.
    if (sekarang < terakhir.kedaluwarsaPada - 60_000) {
      return { aksi: 'pakai_ulang', orderId: terakhir.orderId, redirectUrl: terakhir.redirectUrl };
    }
  }
  return { aksi: 'buat' };
}

/** Order ID unik ≤ 50 karakter, hanya huruf, angka, dan '-'. */
export function buatOrderId(sekarang: number, acak: string): string {
  return `PRK-${sekarang.toString(36).toUpperCase()}-${acak.replace(/[^A-Za-z0-9]/g, '').slice(0, 12).toUpperCase()}`;
}

export function bodySnap(p: { orderId: string; nominal: number; sesiNama: string }) {
  return {
    transaction_details: { order_id: p.orderId, gross_amount: p.nominal },
    item_details: [{ id: 'DENDA', price: p.nominal, quantity: 1, name: `Denda terlambat ${p.sesiNama}`.slice(0, 50) }],
    callbacks: { finish: URL_KEMBALI_APLIKASI },
    expiry: { unit: 'minute', duration: MASA_BERLAKU_MENIT },
  };
}

// ---------- Klien HTTP Midtrans ----------

export interface StatusTransaksi {
  order_id: string;
  transaction_status: string;
  fraud_status?: string;
  gross_amount: string;
  payment_type?: string;
}

export interface KlienMidtrans {
  buatSnap(body: ReturnType<typeof bodySnap>): Promise<{ token: string; redirect_url: string }>;
  /** null bila transaksi belum ada di Midtrans (HTTP 404). */
  cekStatus(orderId: string): Promise<StatusTransaksi | null>;
}

export function klienMidtrans(serverKey: string, fetchFn: typeof fetch = fetch): KlienMidtrans {
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Authorization: `Basic ${Buffer.from(`${serverKey}:`).toString('base64')}`,
  };

  async function panggil(url: string, init: RequestInit) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), BATAS_WAKTU_MS);
    try {
      const res = await fetchFn(url, { ...init, headers, signal: controller.signal });
      return { res, json: (await res.json().catch(() => null)) as Record<string, unknown> | null };
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    async buatSnap(body) {
      const { res, json } = await panggil(SNAP_URL, { method: 'POST', body: JSON.stringify(body) });
      if (!res.ok || typeof json?.token !== 'string' || typeof json?.redirect_url !== 'string') {
        throw new Error(`Snap menolak permintaan (HTTP ${res.status}).`);
      }
      return { token: json.token, redirect_url: json.redirect_url };
    },
    async cekStatus(orderId) {
      const { res, json } = await panggil(`${API_URL}/v2/${encodeURIComponent(orderId)}/status`, { method: 'GET' });
      // Status API bisa membalas HTTP 200 dengan status_code "404" di badan respons.
      if (res.status === 404 || json?.status_code === '404') return null;
      if (!res.ok || !json || typeof json.transaction_status !== 'string' || typeof json.order_id !== 'string') {
        throw new Error(`Status API gagal (HTTP ${res.status}).`);
      }
      return json as unknown as StatusTransaksi;
    },
  };
}
