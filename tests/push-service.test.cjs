const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const load = require('./helpers/load-typescript.cjs');
const filename = path.resolve(__dirname, '../src/services/notifikasiService.ts');
const isi = { title: 'Test', body: 'Test', data: { jenis: 'jadwal_berubah', classId: 'own' } };
const ref = (_db, ...parts) => ({ path: parts.join('/') });

function service(tokens, participants = []) {
  const { createPushSender } = load(path.resolve(__dirname, '../functions/src/transport.ts'));
  return createPushSender(async (path) => {
    const uid = path.split('/').at(-1);
    if (tokens[uid] instanceof Error) throw tokens[uid];
    return tokens[uid] && { uid, token: tokens[uid] };
  }, async (classId) => participants.filter((p) => p.classId === classId).map((p) => p.uid));
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


test('callable rejects unauthorized callers and client-supplied recipients before reading tokens', async () => {
  const { dispatchNotification } = load(path.resolve(__dirname, '../functions/src/dispatcher.ts'));
  const reads = [];
  const io = { read: async (path) => { reads.push(path); return { role: ({ 'users/assistant': 'asprak', 'users/lab': 'aslab', 'users/legacy': 'asisten' })[path] ?? 'praktikan' }; },
    members: async () => { assert.fail('no recipient lookup allowed'); } };
  const request = { jenis: 'keputusan_izin', izinId: 'permit' };
  for (const uid of [undefined, 'student', 'lab', 'legacy']) {
    await assert.rejects(dispatchNotification(uid, request, io), (error) => error.code === 'permission-denied');
  }
  await assert.rejects(dispatchNotification('assistant', { ...request, uids: ['outsider'] }, io),
    (error) => error.code === 'invalid-argument');
  await assert.rejects(dispatchNotification('assistant', { ...request, izinId: '../other' }, io),
    (error) => error.code === 'invalid-argument');
  assert.ok(reads.every((path) => path.startsWith('users/')));
});

test('upstream errors never expose tokens in the callable result', async () => {
  const previous = global.fetch;
  global.fetch = async () => ({ ok: true, json: async () => ({ data: [{ status: 'error', message: 'ExpoPushToken[secret] is invalid', details: { error: 'DeviceNotRegistered' } }] }) });
  try {
    const result = await service({ a: 'ExpoPushToken[secret]' }).kirimKePengguna(['a'], isi);
    assert.equal(result.gagal, 1);
    assert.equal(JSON.stringify(result).includes('secret'), false);
  } finally { global.fetch = previous; }
});
