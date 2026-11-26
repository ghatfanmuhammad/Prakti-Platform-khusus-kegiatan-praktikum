const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const load = require('./helpers/load-typescript.cjs');

const pesan = load(path.resolve(__dirname, '../src/features/notifikasi/pesan.ts'));
const kontrak = load(path.resolve(__dirname, '../src/features/pembayaran/kontrak.ts'));
const dispatcher = load(path.resolve(__dirname, '../functions/src/dispatcher.ts'));
const aksi = load(path.resolve(__dirname, '../src/features/notifikasi/aksi.ts'), {
  '../../services/izinService': {},
  '../../services/notifikasiService': {},
  '../data-praktikum/repository': {},
  '../data-praktikum/validation': {},
});

test('formatRupiah memakai pemisah ribuan titik', () => {
  assert.equal(kontrak.formatRupiah(10000), 'Rp10.000');
  assert.equal(kontrak.formatRupiah(1250000), 'Rp1.250.000');
  assert.equal(kontrak.formatRupiah(500), 'Rp500');
});

test('jenis notifikasi hanya dikirim saat status berubah', () => {
  const j = pesan.jenisNotifikasiPembayaran;
  assert.equal(j({ status: 'pending', statusMidtrans: null }, { status: 'success', statusMidtrans: 'settlement' }), 'pembayaran_berhasil');
  assert.equal(j({ status: 'pending', statusMidtrans: 'pending' }, { status: 'failed', statusMidtrans: 'expire' }), 'pembayaran_gagal');
  assert.equal(j({ status: 'pending', statusMidtrans: null }, { status: 'pending', statusMidtrans: 'pending' }), 'pembayaran_tertunda');
  // Pengisian redirectUrl setelah order dibuat dan notifikasi ganda tidak memicu apa pun.
  assert.equal(j({ status: 'pending', statusMidtrans: null }, { status: 'pending', statusMidtrans: null }), null);
  assert.equal(j({ status: 'success', statusMidtrans: 'settlement' }, { status: 'success', statusMidtrans: 'settlement' }), null);
});

test('mengetuk notifikasi membuka layar yang sesuai', () => {
  assert.deepEqual(aksi.ruteNotifikasi({ jenis: 'denda_baru', dendaId: 'd1' }), { name: 'Tagihan' });
  assert.deepEqual(aksi.ruteNotifikasi({ jenis: 'pembayaran_gagal', orderId: 'o' }), { name: 'Tagihan' });
  assert.deepEqual(aksi.ruteNotifikasi({ jenis: 'pembayaran_tertunda', orderId: 'o' }), { name: 'Tagihan' });
  assert.deepEqual(aksi.ruteNotifikasi({ jenis: 'pembayaran_berhasil', orderId: 'o' }), { name: 'RiwayatPembayaran' });
  assert.deepEqual(aksi.ruteNotifikasi({ jenis: 'sesi_dibuka', sesiId: 'c~s' }), { name: 'Presensi', params: { sesiId: 'c~s' } });
  assert.equal(aksi.ruteNotifikasi({ jenis: 'tidak_dikenal' }), null);
  assert.equal(aksi.ruteNotifikasi(undefined), null);
});

async function denganFetch(fn) {
  const terkirim = [];
  const sebelum = global.fetch;
  global.fetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    terkirim.push(...body);
    return { ok: true, json: async () => ({ data: body.map(() => ({ status: 'ok' })) }) };
  };
  try {
    await fn();
  } finally {
    global.fetch = sebelum;
  }
  return terkirim;
}

const read = async (p) => {
  const uid = p.split('/').at(-1);
  return { uid, token: `ExpoPushToken[${uid}]` };
};

test('trigger denda baru mengirim hanya ke pemilik denda', async () => {
  const terkirim = await denganFetch(() => dispatcher.notifikasiDendaBaru('d1', {
    praktikanId: 'u1', sesiNama: 'Basis Data · Modul 2', menitTerlambat: 12, nominal: 10000, status: 'belum_dibayar',
  }, { read }));
  assert.equal(terkirim.length, 1);
  assert.equal(terkirim[0].to, 'ExpoPushToken[u1]');
  assert.equal(terkirim[0].title, 'Tagihan denda baru');
  assert.match(terkirim[0].body, /Rp10\.000/);
  assert.deepEqual(terkirim[0].data, { jenis: 'denda_baru', dendaId: 'd1' });
  // Denda yang dibebaskan sejak awal tidak dinotifikasi.
  const bebas = await denganFetch(() => dispatcher.notifikasiDendaBaru('d2', { praktikanId: 'u1', status: 'dibebaskan' }, { read }));
  assert.equal(bebas.length, 0);
});

test('trigger pembayaran mengirim berhasil/gagal ke pemilik saja, sekali per transisi', async () => {
  const dasar = { orderId: 'PRK-1', praktikanId: 'u1', sesiNama: 'Basis Data', nominal: 10000 };
  const berhasil = await denganFetch(() => dispatcher.notifikasiPembayaran(
    { ...dasar, status: 'pending', statusMidtrans: null }, { ...dasar, status: 'success', statusMidtrans: 'settlement' }, { read }));
  assert.equal(berhasil.length, 1);
  assert.equal(berhasil[0].to, 'ExpoPushToken[u1]');
  assert.deepEqual(berhasil[0].data, { jenis: 'pembayaran_berhasil', orderId: 'PRK-1' });
  const gagal = await denganFetch(() => dispatcher.notifikasiPembayaran(
    { ...dasar, status: 'pending', statusMidtrans: null }, { ...dasar, status: 'failed', statusMidtrans: 'expire' }, { read }));
  assert.equal(gagal[0].title, 'Pembayaran gagal');
  const tanpaUbah = await denganFetch(() => dispatcher.notifikasiPembayaran(
    { ...dasar, status: 'pending', statusMidtrans: null }, { ...dasar, status: 'pending', statusMidtrans: null, redirectUrl: 'x' }, { read }));
  assert.equal(tanpaUbah.length, 0);
});
