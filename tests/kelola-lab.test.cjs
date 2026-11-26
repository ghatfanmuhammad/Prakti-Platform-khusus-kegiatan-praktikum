const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const load = require('./helpers/load-typescript.cjs');

let documents;
let user;
let sequence;
const database = {};

const reference = (value) => ({ path: value, id: value.split('/').at(-1) });
function ref(first, ...segments) {
  const base = first === database || first?.type === 'query' ? (first.path ?? '') : first.path;
  if (!segments.length) segments = [`auto${++sequence}`];
  return reference([base, ...segments].filter(Boolean).join('/'));
}

function query(target, ...constraints) {
  return { type: 'query', path: target.path, constraints };
}

function where(field, op, value) {
  return { field, op, value };
}

function matchQuery(q) {
  const prefix = `${q.path}/`;
  const depth = q.path.split('/').length + 1;
  const rows = [];
  for (const [docPath, data] of documents.entries()) {
    if (!docPath.startsWith(prefix) || docPath.split('/').length !== depth) continue;
    const ok = (q.constraints ?? []).every((c) => c.op === '==' && data[c.field] === c.value);
    if (ok) rows.push({ id: docPath.split('/').at(-1), ref: reference(docPath), data: () => data });
  }
  return rows;
}

const firestore = {
  doc: ref,
  collection: ref,
  query,
  where,
  orderBy: () => ({}),
  onSnapshot: () => () => {},
  serverTimestamp: () => ({ seconds: 1000 }),
  getDocs: async (target) => {
    const q = target.type === 'query' ? target : { type: 'query', path: target.path, constraints: [] };
    return { docs: matchQuery(q) };
  },
  runTransaction: async (_db, operation) => {
    const changes = [];
    const snapshot = (target) => ({
      id: target.id,
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

const firebaseAdapter = {
  auth: {
    get currentUser() {
      return user;
    },
  },
  db: database,
};

const {
  collectLabPraktikumErrors,
  validateLabPraktikum,
} = load(path.join(__dirname, '../src/features/laboratorium/validation.ts'));

const {
  hapusLabPraktikum,
  simpanLabPraktikum,
} = load(path.join(__dirname, '../src/features/laboratorium/repository.ts'), {
  'firebase/firestore': firestore,
  '../../services/firebase': firebaseAdapter,
});

const { aktivitasLab } = load(
  path.join(__dirname, '../src/features/laboratorium/aktivitas.ts'),
);

const validLabInput = (overrides = {}) => ({
  kode: 'BD-A',
  namaLab: 'Lab A',
  namaPraktikum: 'Basis Data',
  lokasi: 'Lab Komputer 1',
  lat: '-7.050000',
  lng: '110.440000',
  radiusMeter: '50',
  toleransiMenit: '15',
  nominalDenda: '10000',
  ...overrides,
});

beforeEach(() => {
  documents = new Map([
    ['users/aslab1', { role: 'aslab', name: 'Aslab Satu' }],
    ['users/aslab2', { role: 'aslab', name: 'Aslab Dua' }],
    ['users/asprak1', { role: 'asprak', name: 'Asprak Satu' }],
    ['users/mhs1', { role: 'praktikan', name: 'Mhs Satu' }],
  ]);
  user = { uid: 'aslab1' };
  sequence = 0;
});

test('validateLabPraktikum enforces radius 10–1000 m, toleransi 0–120 menit, and nominal > 0', () => {
  assert.doesNotThrow(() => validateLabPraktikum(validLabInput({ radiusMeter: '10', toleransiMenit: '0', nominalDenda: '1' })));
  assert.doesNotThrow(() => validateLabPraktikum(validLabInput({ radiusMeter: '1000', toleransiMenit: '120', nominalDenda: '50000' })));

  for (const radiusMeter of ['9', '1001', 'abc', '-5']) {
    assert.throws(() => validateLabPraktikum(validLabInput({ radiusMeter })), /Radius/);
  }
  for (const toleransiMenit of ['-1', '121', '10.5', 'abc']) {
    assert.throws(() => validateLabPraktikum(validLabInput({ toleransiMenit })), /Toleransi/);
  }
  for (const nominalDenda of ['0', '-1000', '10.5', 'abc']) {
    assert.throws(() => validateLabPraktikum(validLabInput({ nominalDenda })), /Nominal denda/);
  }

  const manyErrors = collectLabPraktikumErrors(
    validLabInput({ kode: '', radiusMeter: '5', toleransiMenit: '200', nominalDenda: '0' }),
  );
  assert.equal(manyErrors.length, 4);
});

test('simpanLabPraktikum creates and updates Lab + physical room, enforcing Aslab ownership', async () => {
  const classId = await simpanLabPraktikum(null, validLabInput());
  const klass = documents.get(`classes/${classId}`);
  assert.equal(klass.namaLab, 'Lab A');
  assert.equal(klass.namaPraktikum, 'Basis Data');
  assert.equal(klass.aslabUid, 'aslab1');
  assert.equal(klass.toleransiMenit, 15);
  assert.equal(klass.nominalDenda, 10000);
  const room = documents.get(`laboratories/${klass.labId}`);
  assert.equal(room.nama, 'Lab Komputer 1');
  assert.equal(room.radiusMeter, 50);

  // Jadwal di bawah Lab ikut tersinkron saat lokasi/labId diubah
  documents.set(`classes/${classId}/schedules/s1`, {
    hari: 'Senin',
    mulai: '08:00',
    selesai: '10:00',
    ruangan: 'Lab Komputer 1',
    labId: klass.labId,
    sessionCount: 0,
  });

  await simpanLabPraktikum(
    classId,
    validLabInput({ lokasi: 'Lab Jaringan', radiusMeter: '120', toleransiMenit: '20', nominalDenda: '15000' }),
    { selectedLabId: klass.labId },
  );
  assert.equal(documents.get(`classes/${classId}`).toleransiMenit, 20);
  assert.equal(documents.get(`laboratories/${klass.labId}`).nama, 'Lab Jaringan');
  assert.equal(documents.get(`laboratories/${klass.labId}`).radiusMeter, 120);
  assert.equal(documents.get(`classes/${classId}/schedules/s1`).ruangan, 'Lab Jaringan');

  // Aslab lain dan non-Aslab ditolak
  user = { uid: 'aslab2' };
  await assert.rejects(
    simpanLabPraktikum(classId, validLabInput({ namaLab: 'Hijack' })),
    /milik Anda sendiri/,
  );
  user = { uid: 'asprak1' };
  await assert.rejects(
    simpanLabPraktikum(null, validLabInput({ kode: 'BD-X' })),
    /Hanya Aslab/,
  );
});

test('hapusLabPraktikum blocks deletion if Lab has participants or running/saved sessions, otherwise cleans up', async () => {
  const classId = await simpanLabPraktikum(null, validLabInput());

  // Gagal jika masih ada peserta
  documents.set(`classes/${classId}`, { ...documents.get(`classes/${classId}`), participantCount: 1 });
  await assert.rejects(hapusLabPraktikum(classId), /memiliki peserta/);

  // Gagal jika masih ada sesi dibuka
  documents.set(`classes/${classId}`, { ...documents.get(`classes/${classId}`), participantCount: 0, sessionCount: 1 });
  documents.set(`classes/${classId}/sessions/ses1`, { status: 'dibuka' });
  await assert.rejects(hapusLabPraktikum(classId), /sesi berjalan/);

  // Gagal jika ada riwayat sesi (ditutup)
  documents.set(`classes/${classId}/sessions/ses1`, { status: 'ditutup' });
  await assert.rejects(hapusLabPraktikum(classId), /memiliki sesi/);

  // Berhasil hapus jika peserta = 0 dan sesi = 0 (termasuk jadwal kosong & pengampu)
  documents.delete(`classes/${classId}/sessions/ses1`);
  documents.set(`classes/${classId}`, { ...documents.get(`classes/${classId}`), sessionCount: 0, scheduleCount: 1 });
  documents.set(`classes/${classId}/schedules/sched1`, { sessionCount: 0 });
  documents.set(`pengampu/${classId}~asprak1`, { classId, uid: 'asprak1' });

  await hapusLabPraktikum(classId);
  assert.equal(documents.has(`classes/${classId}`), false);
  assert.equal(documents.has(`classes/${classId}/schedules/sched1`), false);
  assert.equal(documents.has(`pengampu/${classId}~asprak1`), false);
});

test('aktivitasLab reflects labId updates for Maps', () => {
  const lab = { id: 'lab-99', nama: 'Lab Baru', lat: -7.05, lng: 110.44, radiusMeter: 80 };
  const sesi = [
    {
      id: 'c1~s1',
      praktikum: 'Basis Data',
      kelas: 'BD-A',
      tanggal: '2026-11-26',
      mulai: '10:00',
      selesai: '12:00',
      ruang: 'Lab Lama',
      labId: 'lab-99',
      asistenId: 'asprak1',
      status: 'dibuka',
      topik: 'Normalisasi',
      kode: '1234',
    },
  ];
  const hasil = aktivitasLab(lab, sesi, new Date('2026-11-26T10:30:00').getTime());
  assert.equal(hasil.berlangsung.length, 1);
  assert.equal(hasil.berlangsung[0].id, 'c1~s1');
});
