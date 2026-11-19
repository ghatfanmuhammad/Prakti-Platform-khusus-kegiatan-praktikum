const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

// Memuat modul TypeScript tanpa perangkat: lokasi.ts tidak punya import.
function load(filename) {
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', compiled)(require, module, module.exports);
  return module.exports;
}

const { BATAS_AKURASI_M, bacaLaboratorium, formatMeter, jarakMeter, periksaRadius, pesanHasilLokasi } = load(
  path.join(__dirname, '../src/features/presensi/lokasi.ts'),
);

const lab = { id: 'lab-1', nama: 'Lab Komputer 1', lat: -6.2, lng: 106.8, radiusMeter: 50 };
// 1 derajat lintang ≈ 111,2 km, jadi 0,0003° ≈ 33 m dan 0,0009° ≈ 100 m.
const geser = (dLat, akurasi = 10) => ({ lat: lab.lat + dLat, lng: lab.lng, akurasi });

test('jarakMeter menghitung jarak haversine dalam meter', () => {
  assert.equal(jarakMeter(lab, lab), 0);
  assert.ok(Math.abs(jarakMeter(lab, geser(0.0009)) - 100) < 1);
  // Jakarta–Bandung sekitar 117 km garis lurus
  const km = jarakMeter({ lat: -6.2088, lng: 106.8456 }, { lat: -6.9175, lng: 107.6191 }) / 1000;
  assert.ok(km > 110 && km < 125, `jarak ${km} km`);
});

test('posisi di dalam radius lolos, di luar radius ditolak beserta jaraknya', () => {
  const dalam = periksaRadius(geser(0.0003), lab);
  assert.equal(dalam.jenis, 'dalam_radius');
  assert.ok(dalam.jarak < 50);

  const luar = periksaRadius(geser(0.0009), lab);
  assert.equal(luar.jenis, 'di_luar_radius');
  assert.ok(Math.abs(luar.jarak - 100) < 1);
});

test('tepat di batas radius masih dianggap di dalam', () => {
  const tepi = { ...lab, radiusMeter: jarakMeter(lab, geser(0.0003)) };
  assert.equal(periksaRadius(geser(0.0003), tepi).jenis, 'dalam_radius');
});

test('akurasi lebih buruk dari batas tidak diputuskan, meski titiknya di dalam radius', () => {
  assert.equal(BATAS_AKURASI_M, 100);
  assert.deepEqual(periksaRadius(geser(0, 150), lab), { jenis: 'kurang_akurat', akurasi: 150 });
  assert.equal(periksaRadius(geser(0, 100), lab).jenis, 'dalam_radius');
  // Web bisa tidak melaporkan akurasi; titik koordinat tetap dinilai.
  assert.equal(periksaRadius(geser(0, null), lab).jenis, 'dalam_radius');
});

test('bacaLaboratorium hanya menerima data koordinat dan radius yang valid', () => {
  assert.deepEqual(bacaLaboratorium('lab-1', { nama: ' Lab 1 ', lat: -6.2, lng: 106.8, radiusMeter: 40 }), {
    id: 'lab-1', nama: 'Lab 1', lat: -6.2, lng: 106.8, radiusMeter: 40,
  });
  assert.equal(bacaLaboratorium('x', undefined), null);
  assert.equal(bacaLaboratorium('x', { lat: '-6.2', lng: 106.8, radiusMeter: 40 }), null);
  assert.equal(bacaLaboratorium('x', { lat: -6.2, lng: 106.8, radiusMeter: 0 }), null);
  assert.equal(bacaLaboratorium('x', { lat: 95, lng: 106.8, radiusMeter: 40 }), null);
  assert.equal(bacaLaboratorium('x', { lat: -6.2, lng: 106.8, radiusMeter: 40 }).nama, 'Laboratorium');
});

test('setiap kondisi lokasi punya pesan yang jelas', () => {
  const semua = [
    periksaRadius(geser(0.0003), lab),
    periksaRadius(geser(0.0009), lab),
    { jenis: 'kurang_akurat', akurasi: 250 },
    { jenis: 'lab_belum_diatur' },
    { jenis: 'lab_gagal_dimuat', pesan: 'Tidak dapat terhubung.' },
    { jenis: 'izin_ditolak', bisaMintaLagi: true },
    { jenis: 'izin_ditolak', bisaMintaLagi: false },
    { jenis: 'layanan_mati' },
    { jenis: 'koordinat_tidak_tersedia' },
  ];
  const pesan = semua.map(pesanHasilLokasi);
  assert.ok(pesan.every((p) => typeof p === 'string' && p.length > 10));
  assert.match(pesan[1], /100 m.*di luar radius presensi 50 m/);
  assert.match(pesan[6], /pengaturan/);
});

test('formatMeter membulatkan meter dan memakai km untuk jarak jauh', () => {
  assert.equal(formatMeter(33.4), '33 m');
  assert.equal(formatMeter(1530), '1,5 km');
});
