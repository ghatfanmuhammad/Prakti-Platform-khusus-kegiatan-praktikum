const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const AI_DIR = path.resolve(__dirname, '../src/services');
const MODEL_PATH = path.join(AI_DIR, 'ai/model-edom.json');

// Memuat modul TypeScript tanpa Expo/Firebase. Import relatif .ts dan .json diselesaikan manual.
function load(filename) {
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  const localRequire = (request) => {
    if (!request.startsWith('.')) throw new Error(`Unexpected import ${request}`);
    const target = path.resolve(path.dirname(filename), request);
    if (request.endsWith('.json')) return JSON.parse(fs.readFileSync(target, 'utf8'));
    return load(`${target}.ts`);
  };
  new Function('require', 'module', 'exports', compiled)(localRequire, module, module.exports);
  return module.exports;
}

const { createSentimentClassifier } = load(path.join(AI_DIR, 'ai/sentiment.ts'));

// Model mini buatan: cukup untuk menguji alur hitung tanpa file model asli.
const modelMini = {
  schema_version: 1,
  status: 'research_baseline',
  algorithm: 'LinearSVC',
  labels: ['negatif', 'netral', 'positif'],
  aliases: { gak: 'tidak' },
  vocabulary: { bagus: 0, tidak: 1, 'tidak bagus': 2 },
  idf: [1, 1, 1],
  weights: [
    [-1, 1, 3],
    [0, 0, 0],
    [1, -1, -3],
  ],
  bias: [0, 0.1, 0],
  preprocessing: 'unicode_nfkd_ascii_words_unigram_bigram_sublinear_tf_l2_v1',
};

test('model mini: unigram, bigram, dan alias kata ikut dihitung', () => {
  const classify = createSentimentClassifier(modelMini);
  assert.equal(classify('Praktikumnya BAGUS!').label, 'positif');
  // "gak" → "tidak", lalu bigram "tidak bagus" membalik sentimen
  assert.equal(classify('gak bagus').label, 'negatif');
});

test('model mini: teks kosong atau tanpa kata dikenal menghasilkan label null', () => {
  const classify = createSentimentClassifier(modelMini);
  assert.equal(classify('').status, 'empty_input');
  assert.equal(classify('').label, null);
  assert.equal(classify('xyz qwerty').status, 'unknown_vocabulary');
});

test('format model yang tidak didukung ditolak', () => {
  assert.throws(() => createSentimentClassifier({ ...modelMini, schema_version: 2 }));
});

const adaModel = fs.existsSync(MODEL_PATH);
const lewati = adaModel ? false : 'src/services/ai/model-edom.json belum ada';

test('model EDOM: memprediksi sentimen alasan izin', { skip: lewati }, async () => {
  const ai = load(path.join(AI_DIR, 'aiService.ts'));
  const contoh = [
    'Penjelasan asisten sangat jelas dan mudah dipahami, terima kasih',
    'gak paham materinya',
  ];
  const hasil = await Promise.all(contoh.map((t) => ai.klasifikasiAlasan(t)));
  assert.equal(hasil[0].kategori, 'positif');
  assert.equal(hasil[1].kategori, 'negatif');
  for (const h of hasil) {
    assert.ok(['positif', 'netral', 'negatif'].includes(h.kategori));
    assert.equal(h.confidence, null);
  }
});

test('model EDOM: alasan tanpa kata dikenal ditandai gagal, bukan netral', { skip: lewati }, async () => {
  const ai = load(path.join(AI_DIR, 'aiService.ts'));
  await assert.rejects(ai.klasifikasiAlasan('qwxz zzkq'), (e) => e.kode === 'tidak-dikenali');
  assert.equal(ai.formatAiError({ kode: 'tidak-dikenali' }), 'Alasan tidak mengandung kata yang dikenali model.');
});
