/**
 * [SRS-027/SRS-028] Alur client–server–Midtrans untuk pembayaran denda.
 * - buatTransaksi: memesan transaksi secara atomik, baru kemudian memanggil Snap.
 * - terimaNotifikasi: hanya notifikasi bersignature sah + dikonfirmasi Status API yang mengubah status.
 */
import { randomBytes } from 'node:crypto';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';

import {
  MASA_BERLAKU_MENIT,
  idDokumenValid,
  type Denda,
  type Pembayaran,
  type StatusDenda,
} from '../../src/features/pembayaran/kontrak';
import {
  PembayaranError,
  bacaNotifikasi,
  bodySnap,
  buatOrderId,
  petakanStatus,
  putuskanTransaksi,
  statusBerikut,
  statusDendaSetelah,
  verifikasiSignature,
  type KlienMidtrans,
} from './midtrans';

export async function buatTransaksi(
  db: Firestore,
  uid: string | undefined,
  input: unknown,
  midtrans: KlienMidtrans,
  sekarang: () => number = Date.now,
): Promise<{ orderId: string; redirectUrl: string }> {
  if (!uid) throw new PembayaranError('unauthenticated', 'Silakan masuk terlebih dahulu.');
  const data = input as Record<string, unknown> | null;
  if (!data || Object.keys(data).some((k) => k !== 'dendaId') || !idDokumenValid(data.dendaId)) {
    throw new PembayaranError('invalid-argument', 'Permintaan pembayaran tidak valid.');
  }
  const profil = (await db.doc(`users/${uid}`).get()).data();
  if (profil?.role !== 'praktikan') throw new PembayaranError('permission-denied', 'Hanya praktikan yang dapat membayar denda.');

  const dendaRef = db.doc(`denda/${data.dendaId}`);
  const pesanan = await db.runTransaction(async (tx) => {
    const snap = await tx.get(dendaRef);
    const denda = snap.exists ? ({ ...snap.data(), id: snap.id } as Denda) : undefined;
    const terakhir = denda?.orderIdTerakhir
      ? ((await tx.get(db.doc(`pembayaran/${denda.orderIdTerakhir}`))).data() as Pembayaran | undefined)
      : undefined;
    const waktu = sekarang();
    const keputusan = putuskanTransaksi(denda, uid, terakhir, waktu);
    if (keputusan.aksi === 'pakai_ulang') return keputusan;

    const d = denda!;
    const orderId = buatOrderId(waktu, randomBytes(6).toString('hex'));
    const pembayaran: Omit<Pembayaran, 'createdAt' | 'updatedAt' | 'dibayarPada'> = {
      orderId,
      dendaId: d.id,
      praktikanId: uid,
      sesiNama: d.sesiNama,
      tanggalTagihan: d.tanggal,
      // Nominal selalu dari dokumen denda di server, bukan dari aplikasi.
      nominal: d.nominal,
      status: 'pending',
      statusMidtrans: null,
      metode: null,
      redirectUrl: null,
      kedaluwarsaPada: waktu + MASA_BERLAKU_MENIT * 60_000,
    };
    tx.create(db.doc(`pembayaran/${orderId}`), {
      ...pembayaran,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      dibayarPada: null,
    });
    tx.update(dendaRef, { status: 'pending', orderIdTerakhir: orderId, updatedAt: FieldValue.serverTimestamp() });
    return {
      aksi: 'buat' as const,
      orderId,
      nominal: d.nominal,
      sesiNama: d.sesiNama,
      sebelum: { status: d.status, orderIdTerakhir: d.orderIdTerakhir ?? null },
    };
  });

  if (pesanan.aksi === 'pakai_ulang') return { orderId: pesanan.orderId, redirectUrl: pesanan.redirectUrl };

  const pembayaranRef = db.doc(`pembayaran/${pesanan.orderId}`);
  try {
    const snap = await midtrans.buatSnap(bodySnap(pesanan));
    await pembayaranRef.update({ redirectUrl: snap.redirect_url, updatedAt: FieldValue.serverTimestamp() });
    return { orderId: pesanan.orderId, redirectUrl: snap.redirect_url };
  } catch (err) {
    console.error('Snap gagal untuk', pesanan.orderId, err);
    // Batalkan pemesanan agar praktikan dapat mencoba lagi; transaksi Snap tidak pernah terbentuk.
    await db.runTransaction(async (tx) => {
      const sekarangDenda = (await tx.get(dendaRef)).data() as Denda | undefined;
      if (sekarangDenda?.orderIdTerakhir === pesanan.orderId && sekarangDenda.status === 'pending') {
        const kembali: StatusDenda = pesanan.sebelum.status === 'pending' ? 'gagal' : pesanan.sebelum.status;
        tx.update(dendaRef, { status: kembali, orderIdTerakhir: pesanan.sebelum.orderIdTerakhir, updatedAt: FieldValue.serverTimestamp() });
      }
      tx.delete(pembayaranRef);
    }).catch((e) => console.error('Rollback pembayaran gagal', pesanan.orderId, e));
    throw new PembayaranError('unavailable', 'Midtrans tidak dapat dihubungi. Coba lagi beberapa saat.');
  }
}

export interface HasilNotifikasi {
  kode: number;
  pesan: string;
}

export async function terimaNotifikasi(
  db: Firestore,
  body: unknown,
  serverKey: string,
  midtrans: KlienMidtrans,
): Promise<HasilNotifikasi> {
  const n = bacaNotifikasi(body);
  if (!n) return { kode: 400, pesan: 'Notifikasi tidak lengkap.' };
  if (!verifikasiSignature(n, serverKey)) return { kode: 403, pesan: 'Signature tidak valid.' };

  const pembayaranRef = db.doc(`pembayaran/${n.order_id}`);
  if (!idDokumenValid(n.order_id) || !(await pembayaranRef.get()).exists) {
    // Mis. notifikasi uji dari dashboard. Balas 200 agar Midtrans tidak mengulang.
    return { kode: 200, pesan: 'Order tidak dikenal, diabaikan.' };
  }

  // Jangan percaya isi notifikasi: tanyakan ulang status ke Midtrans.
  const status = await midtrans.cekStatus(n.order_id);
  if (!status || status.order_id !== n.order_id) return { kode: 404, pesan: 'Transaksi belum ada di Midtrans.' };
  const baru = petakanStatus(status.transaction_status, status.fraud_status);
  if (!baru) return { kode: 200, pesan: `Status ${status.transaction_status} diabaikan.` };

  await db.runTransaction(async (tx) => {
    const p = (await tx.get(pembayaranRef)).data() as Pembayaran;
    if (Math.round(Number(status.gross_amount)) !== p.nominal) {
      throw new PembayaranError('failed-precondition', `Nominal ${n.order_id} tidak cocok.`);
    }
    const dendaRef = db.doc(`denda/${p.dendaId}`);
    const denda = (await tx.get(dendaRef)).data() as Denda | undefined;

    const akhir = statusBerikut(p.status, baru);
    // statusMidtrans hanya ikut berubah bila statusnya maju; notifikasi usang tidak menimpa apa pun.
    const maju = akhir === baru;
    const perubahan: Record<string, unknown> = {};
    if (akhir !== p.status) perubahan.status = akhir;
    if (maju && p.statusMidtrans !== status.transaction_status) perubahan.statusMidtrans = status.transaction_status;
    if (maju && status.payment_type && p.metode !== status.payment_type) perubahan.metode = status.payment_type;
    if (akhir === 'success' && !p.dibayarPada) perubahan.dibayarPada = FieldValue.serverTimestamp();
    if (Object.keys(perubahan).length > 0) {
      tx.update(pembayaranRef, { ...perubahan, updatedAt: FieldValue.serverTimestamp() });
    }

    const statusDenda = denda ? statusDendaSetelah(denda, n.order_id, akhir) : null;
    if (statusDenda) tx.update(dendaRef, { status: statusDenda, updatedAt: FieldValue.serverTimestamp() });
  });
  return { kode: 200, pesan: 'OK' };
}
