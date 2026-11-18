const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

// Memuat modul TypeScript tanpa Firebase: aturanIzin hanya mengimpor tipe dan utils/date.
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

const { daftarPilihanSesiIzin, izinAktifUntukSesi, namaSesiIzin } = load(
  path.join(__dirname, '../src/features/izin/aturanIzin.ts'),
);

const sesi = (id, status, tanggal = '2026-11-20', mulai = '08:00') => ({
  id, status, tanggal, mulai, selesai: '10:00',
  praktikum: 'Basis Data', kelas: 'A', ruang: 'Lab 1', asistenId: 'as-1', topik: null, kode: null,
});
const izin = (sesiId, status, praktikanId = 'pr-1') => ({
  sesiId, status, praktikanId, praktikanNama: 'Reva', praktikanNim: '123', sesiNama: 'x', alasan: 'Sakit demam tinggi',
});

test('sesi yang sudah ditutup tidak bisa diajukan izin', () => {
  const hasil = daftarPilihanSesiIzin([sesi('s1', 'ditutup'), sesi('s2', 'dibuka')], [], [], 'pr-1');
  assert.deepEqual(hasil.map((p) => p.sesi.id), ['s2']);
});

test('sesi yang sudah dihadiri praktikan disembunyikan, presensi orang lain tidak berpengaruh', () => {
  const presensi = [
    { sesiId: 's1', praktikanId: 'pr-1', waktuHadir: '2026-11-20T08:05:00Z' },
    { sesiId: 's2', praktikanId: 'pr-2', waktuHadir: '2026-11-20T08:05:00Z' },
  ];
  const hasil = daftarPilihanSesiIzin([sesi('s1', 'dibuka'), sesi('s2', 'dibuka')], presensi, [], 'pr-1');
  assert.deepEqual(hasil.map((p) => p.sesi.id), ['s2']);
});

test('izin Menunggu atau Disetujui mengunci sesi, izin Ditolak boleh diajukan ulang', () => {
  const daftar = [sesi('s1', 'belum_dibuka'), sesi('s2', 'belum_dibuka'), sesi('s3', 'belum_dibuka')];
  const izinSaya = [izin('s1', 'Menunggu'), izin('s2', 'Disetujui'), izin('s3', 'Ditolak')];
  const hasil = daftarPilihanSesiIzin(daftar, [], izinSaya, 'pr-1');
  assert.equal(hasil.find((p) => p.sesi.id === 's1').izinAktif.status, 'Menunggu');
  assert.equal(hasil.find((p) => p.sesi.id === 's2').izinAktif.status, 'Disetujui');
  assert.equal(hasil.find((p) => p.sesi.id === 's3').izinAktif, undefined);
});

test('izin praktikan lain tidak mengunci sesi', () => {
  const hasil = daftarPilihanSesiIzin([sesi('s1', 'dibuka')], [], [izin('s1', 'Menunggu', 'pr-2')], 'pr-1');
  assert.equal(hasil[0].izinAktif, undefined);
});

test('ditolak lalu diajukan ulang dan Menunggu: sesi terkunci lagi', () => {
  assert.equal(izinAktifUntukSesi([izin('s1', 'Ditolak'), izin('s1', 'Menunggu')], 's1').status, 'Menunggu');
});

test('sesi diurutkan dari yang terdekat', () => {
  const hasil = daftarPilihanSesiIzin(
    [sesi('b', 'belum_dibuka', '2026-11-21'), sesi('c', 'belum_dibuka', '2026-11-20', '13:00'), sesi('a', 'dibuka', '2026-11-20')],
    [], [], 'pr-1',
  );
  assert.deepEqual(hasil.map((p) => p.sesi.id), ['a', 'c', 'b']);
});

test('nama sesi memuat praktikum, kelas, dan tanggal', () => {
  assert.equal(namaSesiIzin(sesi('s1', 'dibuka', '2026-11-20')), 'Basis Data · Kelas A · Jumat, 20 November');
});
