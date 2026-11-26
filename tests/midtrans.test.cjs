const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const path = require('node:path');
const load = require('./helpers/load-typescript.cjs');

const ADAPTERS = { 'firebase-admin/firestore': { FieldValue: { serverTimestamp: () => 'SERVER_TS' } } };
const midtrans = load(path.resolve(__dirname, '../functions/src/midtrans.ts'));
const pembayaran = load(path.resolve(__dirname, '../functions/src/pembayaran.ts'), ADAPTERS);
const KEY = 'SB-Mid-server-TEST';

function tandaTangan(n, key = KEY) {
  return crypto.createHash('sha512').update(n.order_id + n.status_code + n.gross_amount + key).digest('hex');
}

// ---------- SRS-028: fungsi murni ----------

test('verifikasiSignature menerima signature sah dan menolak yang diubah', () => {
  const n = { order_id: 'PRK-1', status_code: '200', gross_amount: '10000.00' };
  assert.equal(midtrans.verifikasiSignature({ ...n, signature_key: tandaTangan(n) }, KEY), true);
  assert.equal(midtrans.verifikasiSignature({ ...n, signature_key: tandaTangan(n).toUpperCase() }, KEY), true);
  assert.equal(midtrans.verifikasiSignature({ ...n, gross_amount: '1.00', signature_key: tandaTangan(n) }, KEY), false);
  assert.equal(midtrans.verifikasiSignature({ ...n, signature_key: tandaTangan(n, 'kunci-lain') }, KEY), false);
  assert.equal(midtrans.verifikasiSignature({ ...n, signature_key: 'pendek' }, KEY), false);
  assert.equal(midtrans.verifikasiSignature({ ...n, signature_key: tandaTangan(n) }, ''), false);
});

test('petakanStatus sesuai SRS-028', () => {
  const kasus = {
    settlement: 'success', capture: 'success', pending: 'pending',
    deny: 'failed', cancel: 'failed', expire: 'failed', failure: 'failed',
    refund: null, authorize: null, partial_refund: null, '': null,
  };
  for (const [status, harap] of Object.entries(kasus)) assert.equal(midtrans.petakanStatus(status), harap, status);
  assert.equal(midtrans.petakanStatus('capture', 'challenge'), 'pending');
  assert.equal(midtrans.petakanStatus('capture', 'deny'), 'failed');
  assert.equal(midtrans.petakanStatus('capture', 'accept'), 'success');
  assert.equal(midtrans.petakanStatus(undefined), null);
});

test('statusBerikut tidak pernah mundur', () => {
  assert.equal(midtrans.statusBerikut('success', 'pending'), 'success');
  assert.equal(midtrans.statusBerikut('success', 'failed'), 'success');
  assert.equal(midtrans.statusBerikut('failed', 'pending'), 'failed');
  assert.equal(midtrans.statusBerikut('pending', 'success'), 'success');
  assert.equal(midtrans.statusBerikut('pending', 'failed'), 'failed');
  assert.equal(midtrans.statusBerikut('failed', 'success'), 'success');
});

test('kegagalan order lama tidak menimpa order baru', () => {
  const denda = { status: 'pending', orderIdTerakhir: 'BARU' };
  assert.equal(midtrans.statusDendaSetelah(denda, 'LAMA', 'failed'), null);
  assert.equal(midtrans.statusDendaSetelah(denda, 'BARU', 'failed'), 'gagal');
  assert.equal(midtrans.statusDendaSetelah(denda, 'LAMA', 'success'), 'lunas');
  assert.equal(midtrans.statusDendaSetelah({ status: 'lunas', orderIdTerakhir: 'BARU' }, 'BARU', 'success'), null);
  assert.equal(midtrans.statusDendaSetelah(denda, 'BARU', 'pending'), null);
});

test('order ID ≤ 50 karakter dan hanya karakter yang diizinkan Midtrans', () => {
  const id = midtrans.buatOrderId(Date.now(), 'a1b2c3d4e5f6!!');
  assert.ok(id.length <= 50);
  assert.match(id, /^[A-Za-z0-9_~.-]+$/);
  const body = midtrans.bodySnap({ orderId: id, nominal: 5000, sesiNama: 'X'.repeat(80) });
  assert.equal(body.transaction_details.gross_amount, 5000);
  assert.equal(body.item_details[0].price * body.item_details[0].quantity, 5000);
  assert.ok(body.item_details[0].name.length <= 50);
  assert.equal(body.callbacks.finish, 'prakti://pembayaran');
});

// ---------- Firestore palsu untuk menguji alur server ----------

function fakeDb(awal) {
  const data = new Map(Object.entries(structuredClone(awal)));
  const ref = (p) => ({
    path: p,
    get: async () => ({ exists: data.has(p), id: p.split('/').at(-1), data: () => (data.has(p) ? structuredClone(data.get(p)) : undefined) }),
    update: async (u) => {
      if (!data.has(p)) throw new Error(`no doc ${p}`);
      data.set(p, { ...data.get(p), ...u });
    },
  });
  return {
    data,
    doc: ref,
    async runTransaction(fn) {
      const tulis = [];
      const tx = {
        get: (r) => r.get(),
        create: (r, v) => tulis.push(() => {
          if (data.has(r.path)) throw new Error('exists');
          data.set(r.path, v);
        }),
        update: (r, v) => tulis.push(() => data.set(r.path, { ...data.get(r.path), ...v })),
        delete: (r) => tulis.push(() => data.delete(r.path)),
      };
      const hasil = await fn(tx);
      tulis.forEach((w) => w());
      return hasil;
    },
  };
}

const DENDA = {
  praktikanId: 'u1', classId: 'c1', sessionId: 's1', attendanceId: 'c1~s1~u1',
  sesiNama: 'Basis Data · Modul 2', tanggal: '2026-11-20', menitTerlambat: 12, nominal: 10000, status: 'belum_dibayar',
};
const awal = () => ({ 'users/u1': { role: 'praktikan' }, 'users/u2': { role: 'praktikan' }, 'users/a1': { role: 'asisten' }, 'denda/d1': DENDA });

function klien({ gagal = false, status = null } = {}) {
  const panggilan = [];
  return {
    panggilan,
    async buatSnap(body) {
      panggilan.push(body);
      if (gagal) throw new Error('down');
      return { token: 't', redirect_url: `https://app.sandbox.midtrans.com/snap/v3/redirection/${body.transaction_details.order_id}` };
    },
    async cekStatus(orderId) {
      return status && { order_id: orderId, gross_amount: '10000.00', ...status };
    },
  };
}

// ---------- SRS-027 ----------

test('buatTransaksi: nominal dari server, pembayaran pending, denda terhubung ke order', async () => {
  const db = fakeDb(awal());
  const m = klien();
  const hasil = await pembayaran.buatTransaksi(db, 'u1', { dendaId: 'd1' }, m, () => 1_000_000);
  assert.match(hasil.redirectUrl, /^https:\/\/app\.sandbox\.midtrans\.com\//);
  assert.equal(m.panggilan[0].transaction_details.gross_amount, 10000);
  const p = db.data.get(`pembayaran/${hasil.orderId}`);
  assert.equal(p.status, 'pending');
  assert.equal(p.nominal, 10000);
  assert.equal(p.praktikanId, 'u1');
  assert.equal(p.redirectUrl, hasil.redirectUrl);
  assert.deepEqual([db.data.get('denda/d1').status, db.data.get('denda/d1').orderIdTerakhir], ['pending', hasil.orderId]);
});

test('buatTransaksi menolak pemanggil yang bukan pemilik, asisten, anonim, dan input berlebih', async () => {
  const db = fakeDb(awal());
  const m = klien();
  await assert.rejects(pembayaran.buatTransaksi(db, 'u2', { dendaId: 'd1' }, m), { code: 'permission-denied' });
  await assert.rejects(pembayaran.buatTransaksi(db, 'a1', { dendaId: 'd1' }, m), { code: 'permission-denied' });
  await assert.rejects(pembayaran.buatTransaksi(db, undefined, { dendaId: 'd1' }, m), { code: 'unauthenticated' });
  await assert.rejects(pembayaran.buatTransaksi(db, 'u1', { dendaId: 'd1', nominal: 1 }, m), { code: 'invalid-argument' });
  await assert.rejects(pembayaran.buatTransaksi(db, 'u1', { dendaId: '../x' }, m), { code: 'invalid-argument' });
  await assert.rejects(pembayaran.buatTransaksi(db, 'u1', { dendaId: 'tidak-ada' }, m), { code: 'not-found' });
  assert.equal(m.panggilan.length, 0);
});

test('buatTransaksi menolak tagihan lunas atau dibebaskan', async () => {
  for (const status of ['lunas', 'dibebaskan']) {
    const db = fakeDb({ ...awal(), 'denda/d1': { ...DENDA, status } });
    await assert.rejects(pembayaran.buatTransaksi(db, 'u1', { dendaId: 'd1' }, klien()), { code: 'failed-precondition' });
  }
});

test('ketukan ulang selama transaksi berlaku memakai tautan yang sama (tidak ada pembayaran ganda)', async () => {
  const db = fakeDb(awal());
  const m = klien();
  const pertama = await pembayaran.buatTransaksi(db, 'u1', { dendaId: 'd1' }, m, () => 1_000_000);
  const kedua = await pembayaran.buatTransaksi(db, 'u1', { dendaId: 'd1' }, m, () => 1_000_000 + 5 * 60_000);
  assert.deepEqual(kedua, pertama);
  assert.equal(m.panggilan.length, 1);
  // Setelah kedaluwarsa, order baru dibuat.
  const ketiga = await pembayaran.buatTransaksi(db, 'u1', { dendaId: 'd1' }, m, () => 1_000_000 + 61 * 60_000);
  assert.notEqual(ketiga.orderId, pertama.orderId);
});

test('Snap gagal: pemesanan dibatalkan sehingga praktikan dapat mencoba lagi', async () => {
  const db = fakeDb(awal());
  await assert.rejects(pembayaran.buatTransaksi(db, 'u1', { dendaId: 'd1' }, klien({ gagal: true })), { code: 'unavailable' });
  assert.equal(db.data.get('denda/d1').status, 'belum_dibayar');
  assert.equal(db.data.get('denda/d1').orderIdTerakhir, null);
  assert.equal([...db.data.keys()].filter((k) => k.startsWith('pembayaran/')).length, 0);
});

// ---------- SRS-028 ----------

async function siapkanOrder() {
  const db = fakeDb(awal());
  const { orderId } = await pembayaran.buatTransaksi(db, 'u1', { dendaId: 'd1' }, klien(), () => 1_000_000);
  return { db, orderId };
}

function notif(orderId, extra = {}) {
  const n = { order_id: orderId, status_code: '200', gross_amount: '10000.00', ...extra };
  return { ...n, signature_key: tandaTangan(n) };
}

test('notifikasi sah + Status API settlement: pembayaran success, denda lunas', async () => {
  const { db, orderId } = await siapkanOrder();
  const hasil = await pembayaran.terimaNotifikasi(db, notif(orderId), KEY, klien({ status: { transaction_status: 'settlement', payment_type: 'qris' } }));
  assert.equal(hasil.kode, 200);
  const p = db.data.get(`pembayaran/${orderId}`);
  assert.deepEqual([p.status, p.statusMidtrans, p.metode, p.dibayarPada], ['success', 'settlement', 'qris', 'SERVER_TS']);
  assert.equal(db.data.get('denda/d1').status, 'lunas');
});

test('signature palsu ditolak dan tidak mengubah apa pun', async () => {
  const { db, orderId } = await siapkanOrder();
  const palsu = { ...notif(orderId), signature_key: 'a'.repeat(128) };
  const hasil = await pembayaran.terimaNotifikasi(db, palsu, KEY, klien({ status: { transaction_status: 'settlement' } }));
  assert.equal(hasil.kode, 403);
  assert.equal(db.data.get(`pembayaran/${orderId}`).status, 'pending');
});

test('isi notifikasi tidak dipercaya: status diambil dari Status API', async () => {
  const { db, orderId } = await siapkanOrder();
  // Notifikasi mengaku settlement, tetapi Midtrans bilang masih pending.
  await pembayaran.terimaNotifikasi(db, notif(orderId, { transaction_status: 'settlement' }), KEY, klien({ status: { transaction_status: 'pending' } }));
  assert.equal(db.data.get(`pembayaran/${orderId}`).status, 'pending');
  assert.equal(db.data.get('denda/d1').status, 'pending');
});

test('idempoten: notifikasi ganda dan pending yang datang terlambat tidak memundurkan status', async () => {
  const { db, orderId } = await siapkanOrder();
  const lunas = klien({ status: { transaction_status: 'settlement' } });
  await pembayaran.terimaNotifikasi(db, notif(orderId), KEY, lunas);
  const setelahLunas = structuredClone(db.data.get(`pembayaran/${orderId}`));
  await pembayaran.terimaNotifikasi(db, notif(orderId), KEY, lunas);
  await pembayaran.terimaNotifikasi(db, notif(orderId, { status_code: '201' }), KEY, klien({ status: { transaction_status: 'pending' } }));
  assert.deepEqual(db.data.get(`pembayaran/${orderId}`), setelahLunas);
  assert.equal(db.data.get('denda/d1').status, 'lunas');
});

test('expire: pembayaran failed dan denda gagal sehingga bisa dibayar ulang', async () => {
  const { db, orderId } = await siapkanOrder();
  await pembayaran.terimaNotifikasi(db, notif(orderId, { status_code: '202' }), KEY, klien({ status: { transaction_status: 'expire' } }));
  assert.equal(db.data.get(`pembayaran/${orderId}`).status, 'failed');
  assert.equal(db.data.get('denda/d1').status, 'gagal');
  const ulang = await pembayaran.buatTransaksi(db, 'u1', { dendaId: 'd1' }, klien(), () => 2_000_000);
  assert.notEqual(ulang.orderId, orderId);
});

test('nominal Status API yang tidak cocok ditolak; order tidak dikenal diabaikan dengan 200', async () => {
  const { db, orderId } = await siapkanOrder();
  await assert.rejects(
    pembayaran.terimaNotifikasi(db, notif(orderId), KEY, klien({ status: { transaction_status: 'settlement', gross_amount: '1.00' } })),
    { code: 'failed-precondition' },
  );
  assert.equal(db.data.get(`pembayaran/${orderId}`).status, 'pending');
  const asing = await pembayaran.terimaNotifikasi(db, notif('ORDER-ASING'), KEY, klien({ status: { transaction_status: 'settlement' } }));
  assert.equal(asing.kode, 200);
  assert.equal((await pembayaran.terimaNotifikasi(db, { order_id: 'x' }, KEY, klien())).kode, 400);
});
