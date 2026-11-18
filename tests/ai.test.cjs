const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

// Memuat aiService.ts tanpa Expo; variabel env dibaca saat modul dimuat.
function loadAi(env = {}) {
  const filename = path.resolve(__dirname, '../src/services/aiService.ts');
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  const processStub = { env };
  new Function('require', 'module', 'exports', 'process', compiled)(
    () => { throw new Error('aiService tidak boleh mengimpor modul lain'); },
    module,
    module.exports,
    processStub,
  );
  return module.exports;
}

const ai = loadAi();

test('membaca respons zero-shot Hugging Face dan memilih skor tertinggi', () => {
  const hasil = ai.bacaHasilKlasifikasi([
    { label: 'Keluarga', score: 0.1 },
    { label: 'Sakit', score: 0.82 },
    { label: 'Lainnya', score: 0.08 },
  ]);
  assert.deepEqual(hasil, { kategori: 'Sakit', confidence: 0.82 });
});

test('membaca format zero-shot lama { labels, scores }', () => {
  const hasil = ai.bacaHasilKlasifikasi({
    sequence: 'ban motor bocor di jalan',
    labels: ['Transportasi', 'Lainnya'],
    scores: [0.7, 0.3],
  });
  assert.deepEqual(hasil, { kategori: 'Transportasi', confidence: 0.7 });
});

test('skor persen dinormalisasi ke 0..1 dan respons tanpa kategori ditolak', () => {
  assert.equal(ai.bacaHasilKlasifikasi({ kategori: 'Sakit', score: 92 }).confidence, 0.92);
  assert.throws(() => ai.bacaHasilKlasifikasi({ foo: 1 }), (e) => e.kode === 'respons-tidak-valid');
});

test('body request Hugging Face berisi teks dan semua kategori izin', () => {
  const body = ai.buatBodyRequest('Saya demam sejak kemarin', true);
  assert.equal(body.inputs, 'Saya demam sejak kemarin');
  assert.deepEqual(body.parameters.candidate_labels, [...ai.KATEGORI_IZIN]);
  assert.equal(body.parameters.multi_label, false);
  assert.deepEqual(ai.buatBodyRequest('x', false), { text: 'x' });
});

test('URL Hugging Face terdeteksi otomatis', () => {
  const hf = loadAi({ EXPO_PUBLIC_AI_API_URL: 'https://router.huggingface.co/hf-inference/models/a/b' });
  assert.ok('inputs' in hf.buatBodyRequest('alasan'));
  const lain = loadAi({ EXPO_PUBLIC_AI_API_URL: 'https://contoh.ac.id/predict' });
  assert.deepEqual(lain.buatBodyRequest('alasan'), { text: 'alasan' });
});
