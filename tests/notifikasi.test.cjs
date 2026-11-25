const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

// Memuat modul TypeScript murni (pesan.ts hanya mengimpor utils/date).
function load(filename) {
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  const localRequire = (request) => {
    if (request.startsWith('.')) return load(path.resolve(path.dirname(filename), `${request}.ts`));
    throw new Error(`Unexpected import ${request}`);
  };
  new Function('require', 'module', 'exports', compiled)(localRequire, module, module.exports);
  return module.exports;
}

const pesan = load(path.join(__dirname, '../src/features/notifikasi/pesan.ts'));

const sesi = {
  id: 'kelasA~sesi1',
  praktikum: 'Basis Data',
  kelas: 'A',
  tanggal: '2026-11-19',
  mulai: '08:00',
  selesai: '10:00',
  ruang: 'Lab 1',
  modul: 'Modul 3',
  topik: null,
};

test('pesan sesi dibuka memuat praktikum, kelas, ruang, waktu, dan sesiId', () => {
  const isi = pesan.pesanSesiDibuka(sesi);
  assert.equal(isi.title, 'Sesi praktikum dibuka');
  assert.match(isi.body, /Basis Data · Kelas A \(Modul 3\)/);
  assert.match(isi.body, /Lab 1, 08:00–10:00/);
  assert.deepEqual(isi.data, { jenis: 'sesi_dibuka', sesiId: 'kelasA~sesi1' });
  assert.match(pesan.pesanSesiDibuka({ ...sesi, topik: 'Navigasi' }).body, /\(Navigasi\)/);
});

test('pesan keputusan izin membedakan disetujui dan ditolak', () => {
  const dasar = { id: 'iz1', sesiNama: 'Basis Data A', reviewedBy: 'Kak Dimas' };
  const ok = pesan.pesanKeputusanIzin({ ...dasar, status: 'Disetujui' });
  const tolak = pesan.pesanKeputusanIzin({ ...dasar, status: 'Ditolak' });
  assert.equal(ok.title, 'Izin disetujui');
  assert.equal(tolak.title, 'Izin ditolak');
  assert.match(tolak.body, /ditolak oleh Kak Dimas/);
  assert.deepEqual(ok.data, { jenis: 'keputusan_izin', izinId: 'iz1' });
});

test('perubahan jadwal hanya terdeteksi bila hari, jam, ruangan, atau tanggal sesi berubah', () => {
  const j = { hari: 'Kamis', mulai: '08:00', selesai: '10:00', ruangan: 'Lab 1' };
  assert.equal(pesan.jadwalBerubah(j, { ...j }), false);
  assert.equal(pesan.jadwalBerubah(j, { ...j, ruangan: 'Lab 2' }), true);
  assert.equal(pesan.jadwalBerubah(j, { ...j, mulai: '09:00' }), true);
  const s = { tanggal: '2026-11-19', scheduleId: 'a' };
  assert.equal(pesan.sesiDijadwalUlang(s, { ...s }), false);
  assert.equal(pesan.sesiDijadwalUlang(s, { ...s, tanggal: '2026-11-26' }), true);
  assert.equal(pesan.sesiDijadwalUlang(s, { ...s, scheduleId: 'b' }), true);
});

test('susunPesan membuang token tidak valid/duplikat dan memotong per 100', () => {
  const isi = pesan.pesanSesiDibuka(sesi);
  const tokens = Array.from({ length: 205 }, (_, i) => `ExponentPushToken[t${i}]`);
  const potongan = pesan.susunPesan([...tokens, tokens[0], 'bukan-token', ''], isi);
  assert.deepEqual(potongan.map((p) => p.length), [100, 100, 5]);
  assert.equal(potongan[0][0].channelId, pesan.CHANNEL_ID);
  assert.equal(potongan[0][0].to, 'ExponentPushToken[t0]');
  assert.deepEqual(pesan.susunPesan([], isi), []);
  assert.equal(pesan.tokenValid('ExpoPushToken[abc]'), true);
  assert.equal(pesan.tokenValid('ExponentPushToken[]'), false);
});

test('hitungTiket menghitung tiket ok dan error dari respons Expo', () => {
  const respons = {
    data: [
      { status: 'ok', id: '1' },
      { status: 'error', details: { error: 'DeviceNotRegistered' } },
      { status: 'ok', id: '3' },
    ],
  };
  assert.deepEqual(pesan.hitungTiket(respons, 3), { terkirim: 2, gagal: 1 });
  assert.deepEqual(pesan.hitungTiket({ data: { status: 'ok' } }, 1), { terkirim: 1, gagal: 0 });
  assert.deepEqual(pesan.hitungTiket(null, 2), { terkirim: 0, gagal: 2 });
});

test('ringkasHasil menjelaskan hasil pengiriman ke asisten', () => {
  assert.equal(
    pesan.ringkasHasil({ penerima: 3, terkirim: 3, tanpaToken: 0, gagal: 0 }),
    'Notifikasi terkirim ke 3 praktikan.',
  );
  assert.equal(
    pesan.ringkasHasil({ penerima: 5, terkirim: 2, tanpaToken: 2, gagal: 1 }),
    'Notifikasi terkirim ke 2 dari 5 praktikan (2 belum mengaktifkan notifikasi, 1 gagal).',
  );
  assert.equal(
    pesan.ringkasHasil({ penerima: 0, terkirim: 0, tanpaToken: 0, gagal: 0 }),
    'Belum ada praktikan yang dapat diberi notifikasi.',
  );
  assert.match(
    pesan.ringkasHasil({ penerima: 1, terkirim: 0, tanpaToken: 0, gagal: 0, galat: 'periksa koneksi internet.' }),
    /^Notifikasi gagal dikirim: periksa koneksi/,
  );
});
