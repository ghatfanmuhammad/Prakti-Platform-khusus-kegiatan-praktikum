const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const load = require('./helpers/load-typescript.cjs');
const filename = path.resolve(__dirname, '../src/services/notifikasiService.ts');
const isi = { title: 'Test', body: 'Test', data: { jenis: 'jadwal_berubah', classId: 'own' } };
const ref = (_db, ...parts) => ({ path: parts.join('/') });

function service(tokens, participants = []) {
  return load(filename, {
    './firebase': { db: {} },
    'firebase/firestore': {
      doc: ref, collection: ref,
      where: (field, op, value) => ({ field, op, value }),
      query: (collection, filter) => ({ collection, filter }),
      getDocsFromServer: async (query) => ({ docs: participants.filter((p) => p.classId === query.filter.value).map((p) => ({ data: () => p })) }),
      getDocFromServer: async (ref) => {
        const uid = ref.path.split('/').at(-1);
        if (tokens[uid] instanceof Error) throw tokens[uid];
        return { data: () => tokens[uid] && { uid, token: tokens[uid] } };
      },
    },
  });
}

test('class recipients exclude other classes, deduplicate members, skip missing tokens', async () => {
  const sent = [];
  const previous = global.fetch;
  global.fetch = async (_url, options) => {
    const body = JSON.parse(options.body); sent.push(...body);
    return { ok: true, json: async () => ({ data: body.map(() => ({ status: 'ok' })) }) };
  };
  try {
    const api = service({ a: 'ExpoPushToken[a]', outsider: 'ExpoPushToken[outsider]' }, [
      { classId: 'own', uid: 'a' }, { classId: 'own', uid: 'a' },
      { classId: 'own', uid: 'no-token' }, { classId: 'other', uid: 'outsider' },
    ]);
    assert.deepEqual(await api.kirimKeKelas('own', isi), { penerima: 2, terkirim: 1, tanpaToken: 1, gagal: 0 });
    assert.deepEqual(sent.map((p) => p.to), ['ExpoPushToken[a]']);
  } finally { global.fetch = previous; }
});

test('partial batch failure preserves accepted counts and continues remaining batches', async () => {
  let calls = 0;
  const previous = global.fetch;
  global.fetch = async (_url, options) => {
    calls++;
    if (calls === 2) throw new TypeError('offline');
    const body = JSON.parse(options.body);
    return { ok: true, json: async () => ({ data: body.map(() => ({ status: 'ok' })) }) };
  };
  try {
    const tokens = Object.fromEntries(Array.from({ length: 205 }, (_, i) => [`u${i}`, `ExpoPushToken[t${i}]`]));
    const result = await service(tokens).kirimKePengguna(Object.keys(tokens), isi);
    assert.equal(calls, 3);
    assert.equal(result.terkirim, 105);
    assert.equal(result.gagal, 100);
    assert.equal(result.penerima, 205);
    assert.match(result.galat, /koneksi/);
  } finally { global.fetch = previous; }
});

test('one token lookup failure does not prevent sending to remaining users', async () => {
  const previous = global.fetch;
  global.fetch = async () => ({ ok: true, json: async () => ({ data: [{ status: 'ok' }] }) });
  try {
    const result = await service({ a: new Error('read failed'), b: 'ExpoPushToken[b]' }).kirimKePengguna(['a', 'b'], isi);
    assert.equal(result.terkirim, 1);
    assert.equal(result.gagal, 1);
    assert.equal(result.tanpaToken, 0);
  } finally { global.fetch = previous; }
});

test('token cleanup uses a transaction and preserves a newer device token', async () => {
  const deleted = [];
  let current = 'ExpoPushToken[new]';
  const api = load(filename, {
    './firebase': { db: {} },
    'firebase/firestore': { doc: ref, runTransaction: async (_db, operation) => operation({
      get: async () => ({ exists: () => true, data: () => ({ token: current }) }),
      delete: (ref) => { deleted.push(ref.path); },
    }) },
  });
  await api.hapusTokenPerangkat('student', 'ExpoPushToken[old]');
  assert.deepEqual(deleted, []);
  current = 'ExpoPushToken[old]';
  await api.hapusTokenPerangkat('student', current);
  assert.deepEqual(deleted, ['pushTokens/student']);
});
