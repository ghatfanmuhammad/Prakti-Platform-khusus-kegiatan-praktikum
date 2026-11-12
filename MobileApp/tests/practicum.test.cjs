const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

// A small transactional Firestore double checks the repository contract, including
// the SDK's read-before-write requirement. Security rules have separate emulator tests.
let documents;
let user;
let sequence;
const database = {};
const reference = (value) => ({ path: value, id: value.split('/').at(-1) });
function ref(first, ...segments) {
  const base = first === database ? '' : first.path;
  if (!segments.length) segments = [`auto${++sequence}`];
  return reference([base, ...segments].filter(Boolean).join('/'));
}
const firestore = {
  doc: ref,
  collection: ref,
  serverTimestamp: () => ({ seconds: 1000 }),
  runTransaction: async (_db, operation) => {
    const changes = [];
    const snapshot = (target) => ({
      ref: target,
      exists: () => documents.has(target.path),
      data: () => documents.get(target.path),
    });
    const result = await operation({
      get: async (target) => {
        assert.equal(changes.length, 0, 'all reads must precede writes');
        return snapshot(target);
      },
      set: (target, value) => changes.push(['set', target, value]),
      update: (target, value) => changes.push(['update', target, value]),
      delete: (target) => changes.push(['delete', target]),
    });
    for (const [action, target, value] of changes) {
      if (action === 'delete') documents.delete(target.path);
      else
        documents.set(
          target.path,
          action === 'update' ? { ...documents.get(target.path), ...value } : value,
        );
    }
    return result;
  },
};
function load(name, cache = new Map()) {
  if (cache.has(name)) return cache.get(name);
  const filename = path.join(__dirname, '../src/features/data-praktikum', `${name}.ts`);
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const module = { exports: {} };
  const localRequire = (request) => {
    if (request === 'firebase/firestore') return firestore;
    if (request === 'firebase/auth') return { getAuth: () => ({ currentUser: user }) };
    if (request === '@/lib/firebase')
      return { getFirebaseServices: () => ({ app: {}, db: database }) };
    if (request.startsWith('./')) return load(request.slice(2), cache);
    throw new Error(`Unexpected import ${request}`);
  };
  new Function('require', 'module', 'exports', compiled)(localRequire, module, module.exports);
  cache.set(name, module.exports);
  return module.exports;
}
const repository = load('repository');
const { validateForm, assertScheduleDate } = load('validation');
beforeEach(() => {
  documents = new Map([
    ['users/assistant', { role: 'asisten' }],
    ['users/student', { role: 'praktikan' }],
  ]);
  user = { uid: 'assistant' };
  sequence = 0;
});
const makeClass = () =>
  repository.saveRecord('kelas', null, null, {
    kode: 'IF-2A',
    namaPraktikum: 'Basis Data',
  });
const makeSchedule = (classId, overrides = {}) =>
  repository.saveRecord('jadwal', classId, null, {
    hari: 'Kamis',
    mulai: '08:00',
    selesai: '10:00',
    ruangan: 'Lab 1',
    ...overrides,
  });
const makeSession = (classId, scheduleId, overrides = {}) =>
  repository.saveRecord('sesi', classId, null, {
    scheduleId,
    tanggal: '2026-11-12',
    modul: 'Modul 1',
    ...overrides,
  });

test('class and participant CRUD persist independently of a repository instance', async () => {
  const classId = await makeClass();
  const id = await repository.saveRecord('peserta', classId, null, {
    uid: 'student',
    nama: 'Raihan',
    nim: '240601',
  });
  const reopened = load('repository');
  await reopened.saveRecord('kelas', null, classId, {
    kode: 'IF-2B',
    namaPraktikum: 'Basis Data Lanjut',
  });
  await reopened.saveRecord('peserta', classId, id, {
    uid: 'student',
    nama: 'Raihan Lazuardi',
    nim: '240602',
  });
  assert.equal(documents.get(`classes/${classId}`).participantCount, 1);
  assert.equal(documents.get(`classes/${classId}`).kode, 'IF-2B');
  assert.equal(documents.get(`participants/${id}`).nama, 'Raihan Lazuardi');
  await reopened.deleteRecord('peserta', classId, id);
  await reopened.deleteRecord('kelas', null, classId);
  assert.equal(documents.has(`participants/${id}`), false);
  assert.equal(documents.has(`classes/${classId}`), false);
});
test('duplicate enrollment, unknown accounts, and UID reassignment are rejected atomically', async () => {
  const classId = await makeClass();
  const values = { uid: 'student', nama: 'Raihan', nim: '240601' };
  const id = await repository.saveRecord('peserta', classId, null, values);
  await assert.rejects(repository.saveRecord('peserta', classId, null, values), /sudah terdaftar/);
  await assert.rejects(
    repository.saveRecord('peserta', classId, null, {
      ...values,
      uid: 'missing',
    }),
    /akun praktikan/,
  );
  await assert.rejects(
    repository.saveRecord('peserta', classId, id, { ...values, uid: 'other' }),
    /tidak dapat diubah/,
  );
  assert.equal(documents.get(`classes/${classId}`).participantCount, 1);
});
test('writes require a signed-in assistant, including after role revocation', async () => {
  user = null;
  await assert.rejects(makeClass(), /masuk kembali/);
  user = { uid: 'student' };
  await assert.rejects(makeClass(), /Hanya asisten/);
  user = { uid: 'assistant' };
  documents.set('users/assistant', { role: 'praktikan' });
  await assert.rejects(makeClass(), /Hanya asisten/);
  assert.equal(
    [...documents.keys()].some((key) => key.startsWith('classes/')),
    false,
  );
});
test('class and schedule deletion preserve referenced data; child cleanup restores counts', async () => {
  const classId = await makeClass();
  const scheduleId = await makeSchedule(classId);
  const sessionId = await makeSession(classId, scheduleId);
  await assert.rejects(repository.deleteRecord('kelas', null, classId), /seluruh peserta/);
  await assert.rejects(repository.deleteRecord('jadwal', classId, scheduleId), /Hapus sesi/);
  await repository.deleteRecord('sesi', classId, sessionId);
  assert.equal(documents.get(`classes/${classId}`).sessionCount, 0);
  assert.equal(documents.get(`classes/${classId}/schedules/${scheduleId}`).sessionCount, 0);
  await repository.deleteRecord('jadwal', classId, scheduleId);
  await repository.deleteRecord('kelas', null, classId);
  assert.equal([...documents.keys()].filter((key) => key.startsWith('classes/')).length, 0);
});
test('moving an unopened session updates both schedule references atomically', async () => {
  const classId = await makeClass();
  const first = await makeSchedule(classId);
  const second = await makeSchedule(classId, {
    mulai: '13:00',
    selesai: '15:00',
  });
  const session = await makeSession(classId, first);
  await repository.saveRecord('sesi', classId, session, {
    scheduleId: second,
    tanggal: '2026-11-12',
    modul: 'Modul Baru',
  });
  assert.equal(documents.get(`classes/${classId}/schedules/${first}`).sessionCount, 0);
  assert.equal(documents.get(`classes/${classId}/schedules/${second}`).sessionCount, 1);
  assert.equal(documents.get(`classes/${classId}`).sessionCount, 1);
  await repository.deleteRecord('jadwal', classId, first);
  await assert.rejects(
    repository.saveRecord('jadwal', classId, second, {
      hari: 'Kamis',
      mulai: '14:00',
      selesai: '16:00',
      ruangan: 'Lab 2',
    }),
    /sudah dipakai/,
  );
});
test('wrong dates and deleted references cannot create partial records or counters', async () => {
  const classId = await makeClass();
  const scheduleId = await makeSchedule(classId);
  await assert.rejects(makeSession(classId, scheduleId, { tanggal: '2026-11-13' }), /hari Kamis/);
  await assert.rejects(makeSession(classId, 'missing'), /tidak tersedia/);
  assert.equal(documents.get(`classes/${classId}`).sessionCount, 0);
  assert.equal(documents.get(`classes/${classId}/schedules/${scheduleId}`).sessionCount, 0);
  await repository.deleteRecord('jadwal', classId, scheduleId);
  await assert.rejects(
    repository.saveRecord('jadwal', classId, scheduleId, {
      hari: 'Senin',
      mulai: '08:00',
      selesai: '10:00',
      ruangan: 'Lab 1',
    }),
    /sudah dihapus/,
  );
});
test('opened sessions retain history and closed sessions are terminal', async () => {
  const classId = await makeClass();
  const scheduleId = await makeSchedule(classId);
  const sessionId = await makeSession(classId, scheduleId);
  await repository.changeSessionStatus(classId, sessionId, 'dibuka');
  await assert.rejects(repository.changeSessionStatus(classId, sessionId, 'dibuka'), /Status sesi/);
  await assert.rejects(repository.deleteRecord('sesi', classId, sessionId), /riwayat/);
  await assert.rejects(
    repository.saveRecord('sesi', classId, sessionId, {
      scheduleId,
      tanggal: '2026-11-12',
      modul: 'Changed',
    }),
    /belum dibuka/,
  );
  await repository.changeSessionStatus(classId, sessionId, 'ditutup');
  await assert.rejects(
    repository.changeSessionStatus(classId, sessionId, 'dibuka'),
    /tidak dapat dibuka/,
  );
  assert.equal(documents.get(`classes/${classId}/sessions/${sessionId}`).status, 'ditutup');
});
test('validation handles whitespace, leap days, invalid calendar dates and time boundaries', () => {
  assert.throws(() => validateForm('kelas', { kode: ' ', namaPraktikum: 'DB' }), /wajib/);
  assert.equal(validateForm('kelas', { kode: ' IF-2A ', namaPraktikum: ' DB ' }).kode, 'IF-2A');
  const session = { scheduleId: 'schedule', modul: 'Modul' };
  for (const tanggal of ['2026-02-29', '2026-02-31', '2026-13-01', '2026-1-01', 'garbage'])
    assert.throws(() => validateForm('sesi', { ...session, tanggal }), /Tanggal/);
  assert.equal(validateForm('sesi', { ...session, tanggal: '2028-02-29' }).tanggal, '2028-02-29');
  const schedule = { hari: 'Senin', ruangan: 'Lab' };
  for (const [mulai, selesai] of [
    ['24:00', '25:00'],
    ['08:60', '10:00'],
    ['10:00', '08:00'],
    ['08:00', '08:00'],
  ])
    assert.throws(() => validateForm('jadwal', { ...schedule, mulai, selesai }));
  assert.doesNotThrow(() => assertScheduleDate('2026-11-12', { hari: 'Kamis' }));
});

test('a maximum-length Firebase UID can be enrolled, edited, and removed', async () => {
  const classId = await makeClass();
  const uid = 's'.repeat(128);
  documents.set(`users/${uid}`, { role: 'praktikan' });
  const values = { uid, nama: 'Long UID', nim: '240603' };
  const id = await repository.saveRecord('peserta', classId, null, values);
  assert.equal(id.length > 128, true);
  await repository.saveRecord('peserta', classId, id, { ...values, nama: 'Updated' });
  await repository.deleteRecord('peserta', classId, id);
  assert.equal(documents.has(`participants/${id}`), false);
  assert.equal(documents.get(`classes/${classId}`).participantCount, 0);
});
