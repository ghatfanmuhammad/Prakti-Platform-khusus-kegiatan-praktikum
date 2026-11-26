import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { HttpsError, onCall, onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { dispatchNotification, NotificationError, notifikasiDendaBaru, notifikasiPembayaran } from './dispatcher';
import { PembayaranError, klienMidtrans } from './midtrans';
import { buatTransaksi as prosesBuatTransaksi, terimaNotifikasi } from './pembayaran';

initializeApp();
const db = getFirestore();
const read = async (path: string) => (await db.doc(path).get()).data();

/** Server key Midtrans Sandbox. Atur dengan: firebase functions:secrets:set MIDTRANS_SERVER_KEY */
const MIDTRANS_SERVER_KEY = defineSecret('MIDTRANS_SERVER_KEY');

export const kirimNotifikasi = onCall(async (request) => {
  try {
    return await dispatchNotification(request.auth?.uid, request.data, {
      read,
      members: async (classId) => {
        const participants = await db.collection('participants').where('classId', '==', classId).get();
        return participants.docs.map((doc) => doc.data().uid).filter((uid): uid is string => typeof uid === 'string');
      },
    });
  } catch (error) {
    if (error instanceof NotificationError) throw new HttpsError(error.code, error.message);
    // Never return database records, tokens, or raw upstream errors to the caller.
    throw new HttpsError('internal', 'Notifikasi gagal diproses server.');
  }
});

// ---------- SRS-027: membuat transaksi Snap ----------
export const buatTransaksi = onCall({ secrets: [MIDTRANS_SERVER_KEY] }, async (request) => {
  try {
    return await prosesBuatTransaksi(db, request.auth?.uid, request.data, klienMidtrans(MIDTRANS_SERVER_KEY.value()));
  } catch (error) {
    if (error instanceof PembayaranError) throw new HttpsError(error.code, error.message);
    console.error('buatTransaksi gagal', error);
    throw new HttpsError('internal', 'Pembayaran gagal diproses server.');
  }
});

// ---------- SRS-028: HTTP notification Midtrans ----------
export const midtransNotifikasi = onRequest({ secrets: [MIDTRANS_SERVER_KEY] }, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method not allowed');
    return;
  }
  try {
    const hasil = await terimaNotifikasi(db, req.body, MIDTRANS_SERVER_KEY.value(), klienMidtrans(MIDTRANS_SERVER_KEY.value()));
    if (hasil.kode !== 200) console.warn('Notifikasi Midtrans ditolak:', hasil.pesan);
    res.status(hasil.kode).send(hasil.pesan);
  } catch (error) {
    if (error instanceof PembayaranError) {
      console.error('Notifikasi Midtrans tidak konsisten:', error.message);
      res.status(400).send('Data transaksi tidak konsisten.');
      return;
    }
    console.error('Notifikasi Midtrans gagal diproses', error);
    // 500 membuat Midtrans mengirim ulang notifikasi.
    res.status(500).send('Gagal memproses notifikasi.');
  }
});

// ---------- SRS-029: push notification dari trigger ----------
export const notifikasiDendaDibuat = onDocumentCreated('denda/{dendaId}', async (event) => {
  await notifikasiDendaBaru(event.params.dendaId, event.data?.data(), { read });
});

export const notifikasiPembayaranBerubah = onDocumentUpdated('pembayaran/{orderId}', async (event) => {
  await notifikasiPembayaran(event.data?.before.data(), event.data?.after.data(), { read });
});
