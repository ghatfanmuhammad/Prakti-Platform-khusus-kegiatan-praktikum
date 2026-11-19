const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

// Memuat modul TypeScript tanpa React Native: halamanPresensi hanya mengimpor tipe.
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

const { keadaanPresensi, pesanKeadaanPresensi } = load(
  path.join(__dirname, '../src/features/presensi/halamanPresensi.ts'),
);

const sesi = (status) => ({
  id: 'kls~s1', status, tanggal: '2026-11-20', mulai: '08:00', selesai: '10:00',
  praktikum: 'Basis Data', kelas: 'A', ruang: 'Lab 1', asistenId: 'as-1', topik: null, kode: null,
});
const hadir = (praktikanId, sesiId = 'kls~s1') => ({ sesiId, praktikanId, waktuHadir: '2026-11-20T01:05:00.000Z' });

test('presensi hanya bisa diajukan saat sesi dibuka', () => {
  assert.deepEqual(keadaanPresensi(sesi('dibuka'), [], 'pr-1'), { jenis: 'bisa_presensi' });
  assert.deepEqual(keadaanPresensi(sesi('belum_dibuka'), [], 'pr-1'), { jenis: 'belum_dibuka' });
  assert.deepEqual(keadaanPresensi(sesi('ditutup'), [], 'pr-1'), { jenis: 'ditutup' });
});

test('praktikan yang sudah presensi tidak bisa presensi lagi, termasuk setelah sesi ditutup', () => {
  for (const status of ['dibuka', 'ditutup']) {
    assert.deepEqual(keadaanPresensi(sesi(status), [hadir('pr-1')], 'pr-1'), {
      jenis: 'sudah_presensi',
      waktuHadir: '2026-11-20T01:05:00.000Z',
    });
  }
});

test('presensi praktikan lain atau sesi lain tidak dihitung', () => {
  const presensi = [hadir('pr-2'), hadir('pr-1', 'kls~s2')];
  assert.deepEqual(keadaanPresensi(sesi('dibuka'), presensi, 'pr-1'), { jenis: 'bisa_presensi' });
});

test('setiap keadaan yang menolak presensi punya pesan', () => {
  for (const jenis of ['sudah_presensi', 'belum_dibuka', 'ditutup']) {
    assert.match(pesanKeadaanPresensi({ jenis, waktuHadir: '' }), /\S/);
  }
});
