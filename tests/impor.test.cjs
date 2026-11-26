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

const csv = load(path.join(__dirname, '../src/features/impor/csv.ts'));
const review = load(path.join(__dirname, '../src/features/impor/review.ts'));
const pencocokan = load(path.join(__dirname, '../src/features/impor/pencocokan.ts'));
const template = load(path.join(__dirname, '../src/features/impor/template.ts'), {
  'expo-document-picker': {},
  'expo-file-system': { File: class {}, Paths: {} },
  'expo-sharing': {},
  'react-native': { Platform: { OS: 'android' } },
});

const repository = load(path.join(__dirname, '../src/features/data-praktikum/repository.ts'), {
  'firebase/firestore': firestore,
  '../../services/firebase': firebaseAdapter,
  '../../utils/code': { buatKodeSesi: () => '4829' },
});

const pengampuRepo = load(path.join(__dirname, '../src/features/data-praktikum/pengampu.ts'), {
  'firebase/firestore': firestore,
  '../../services/firebase': firebaseAdapter,
});

beforeEach(() => {
  documents = new Map([
    ['users/aslab1', { uid: 'aslab1', role: 'aslab', name: 'Aslab 1', email: 'aslab1@staff.id', nimOrCode: 'ASL-1' }],
    ['users/aslab2', { uid: 'aslab2', role: 'aslab', name: 'Aslab 2', email: 'aslab2@staff.id', nimOrCode: 'ASL-2' }],
    ['users/asprak1', { uid: 'asprak1', role: 'asprak', name: 'Andi Asprak', email: 'andi@staff.id', nimOrCode: 'ASP-01' }],
    ['users/asprak2', { uid: 'asprak2', role: 'asprak', name: 'Budi Asprak', email: 'budi@staff.id', nimOrCode: 'ASP-02' }],
    ['users/mhs1', { uid: 'mhs1', role: 'praktikan', name: 'Citra Mhs', email: 'citra@mhs.id', nimOrCode: '240601' }],
    ['users/mhs2', { uid: 'mhs2', role: 'praktikan', name: 'Dodi Mhs', email: 'dodi@mhs.id', nimOrCode: '240602' }],
    [
      'classes/labA',
      {
        kode: 'BD-A',
        namaLab: 'Lab A',
        namaPraktikum: 'Basis Data',
        aslabUid: 'aslab1',
        participantCount: 1,
        scheduleCount: 1,
        sessionCount: 1,
      },
    ],
    [
      'classes/labB',
      {
        kode: 'BD-B',
        namaLab: 'Lab B',
        namaPraktikum: 'Basis Data',
        aslabUid: 'aslab1',
        participantCount: 0,
        scheduleCount: 0,
        sessionCount: 0,
      },
    ],
    [
      'classes/labOther',
      {
        kode: 'JK-A',
        namaLab: 'Lab Lain',
        namaPraktikum: 'Jarkom',
        aslabUid: 'aslab2',
        participantCount: 0,
        scheduleCount: 0,
        sessionCount: 0,
      },
    ],
    [
      'participants/labA~mhs1',
      { classId: 'labA', uid: 'mhs1', nama: 'Citra Mhs', nim: '240601' },
    ],
    ['classes/labA/schedules/sched1', { hari: 'Senin', mulai: '08:00', selesai: '10:00', ruangan: 'Lab 1', sessionCount: 1 }],
    ['classes/labA/sessions/ses1', { scheduleId: 'sched1', status: 'ditutup', asistenId: 'asprak1' }],
    ['attendance/labA~ses1~mhs1', { classId: 'labA', sessionId: 'ses1', praktikanId: 'mhs1', kode: '1234' }],
    ['pengampu/labA~asprak1', { classId: 'labA', uid: 'asprak1', nama: 'Andi Asprak', kode: 'ASP-01', email: 'andi@staff.id' }],
  ]);
  user = { uid: 'aslab1' };
  sequence = 0;
});

test('parseCsv handles BOM, quotes, escaped quotes, semicolons, and blank lines', () => {
  const input =
    '\uFEFFKode Lab;Nama Lab;Lokasi\r\n' +
    '"BD-A";"Lab ""Utama""";Lab Komputer 1\r\n' +
    '\r\n' +
    'BD-B;Lab B;Lab Komputer 2\r\n';
  const parsed = csv.parseCsv(input);
  assert.equal(parsed.delimiter, ';');
  assert.deepEqual(parsed.headers, ['kode_lab', 'nama_lab', 'lokasi']);
  assert.equal(parsed.rows.length, 2);
  assert.equal(parsed.rows[0].lineNumber, 2);
  assert.equal(parsed.rows[0].raw.nama_lab, 'Lab "Utama"');
  assert.equal(parsed.rows[1].lineNumber, 4);

  const roundTrip = csv.parseCsv(csv.serializeCsv(['a', 'b'], [['1,2', 'x"y']]));
  assert.equal(roundTrip.rows[0].raw.a, '1,2');
  assert.equal(roundTrip.rows[0].raw.b, 'x"y');
});

test('SRS-021/022/023 have three distinct CSV templates that parse cleanly', () => {
  const specs = [template.TEMPLATE_LAB, template.TEMPLATE_PRAKTIKAN, template.TEMPLATE_ASPRAK];
  const filenames = new Set(specs.map((s) => s.filename));
  assert.equal(filenames.size, 3);
  assert.notDeepEqual(template.TEMPLATE_LAB.headers, template.TEMPLATE_PRAKTIKAN.headers);
  assert.notDeepEqual(template.TEMPLATE_PRAKTIKAN.headers, template.TEMPLATE_ASPRAK.headers);
  for (const spec of specs) {
    const parsed = csv.parseCsv(template.buatKontenTemplate(spec));
    assert.deepEqual(parsed.headers, spec.headers);
    assert.equal(parsed.rows.length, spec.sampleRows.length);
  }
});

test('SRS-021 review engine binds rows to one course, tracks per-row errors, supports edit/accept/reject', () => {
  const csvText = [
    'kode,nama_lab,lokasi,latitude,longitude,radius_meter,toleransi_menit,nominal_denda',
    'BD-C,Lab C,Ruang 1,-7.05,110.44,50,15,10000',
    'BD-D,Lab D,Ruang 2,-7.05,110.44,5,150,0',
    'BD-C,Lab C2,Ruang 3,-7.05,110.44,50,15,10000',
  ].join('\n');

  const parsed = csv.parseCsv(csvText);
  const mapped = pencocokan.petakanCsvLab(parsed.rows, 'Basis Data');
  const revalidator = pencocokan.buatRevalidatorLab('Basis Data', [
    { kode: 'BD-A', namaLab: 'Lab A', namaPraktikum: 'Basis Data' },
  ]);

  let rows = review.buatBarisTinjauan(mapped, revalidator);
  assert.equal(rows[0].status, 'diterima');
  assert.equal(rows[0].errors.length, 0);
  // Row 2 has invalid radius, toleransi, nominal
  assert.equal(rows[1].status, 'ditolak');
  assert.equal(rows[1].errors.length, 3);
  // Row 3 duplicates BD-C from row 1
  assert.equal(rows[2].status, 'ditolak');
  assert.match(rows[2].errors[0], /duplikat/);

  // Tolak baris 1 -> siapSimpan becomes 0
  rows = review.tolakBaris(rows, rows[0].id);
  assert.equal(review.barisSiapSimpan(rows).length, 0);
  rows = review.terimaBaris(rows, rows[0].id);
  assert.equal(review.barisSiapSimpan(rows).length, 1);

  // Perbaiki baris 2 dan baris 3 -> langsung valid & diterima
  rows = review.ubahBaris(
    rows,
    rows[1].id,
    { ...rows[1].data, radiusMeter: '80', toleransiMenit: '10', nominalDenda: '5000' },
    revalidator,
  );
  rows = review.ubahBaris(rows, rows[2].id, { ...rows[2].data, kode: 'BD-E' }, revalidator);

  const ready = review.barisSiapSimpan(rows);
  assert.equal(ready.length, 3);
  assert.ok(ready.every((r) => r.data.namaPraktikum === 'Basis Data'));
});

test('SRS-022 matches praktikan by NIM/email, flags unregistered/role-mismatch/duplicates, and moves atomically', async () => {
  const users = [...documents.entries()]
    .filter(([k]) => k.startsWith('users/'))
    .map(([, v]) => v);
  const revalidator = pencocokan.buatRevalidatorPraktikan(users, new Set(['mhs1']));

  const parsed = csv.parseCsv([
    'nim,email,nama',
    '240602,,Dodi', // valid by NIM
    ',citra@mhs.id,Citra', // already enrolled in Lab A
    '240602,,Dodi Duplikat', // duplicate in CSV
    ',belum@mhs.id,Unknown', // unregistered
    ',andi@staff.id,Andi', // role mismatch (asprak)
  ].join('\n'));

  const mapped = pencocokan.petakanCsvPraktikan(parsed.rows);
  const rows = review.buatBarisTinjauan(mapped, revalidator);
  assert.equal(rows[0].errors.length, 0);
  assert.equal(rows[0].status, 'diterima');
  assert.match(rows[1].errors[0], /sudah terdaftar/);
  assert.match(rows[2].errors[0], /duplikat/);
  assert.match(rows[3].errors[0], /belum terdaftar/);
  assert.match(rows[4].errors[0], /bukan praktikan/);

  // Atomic move of mhs1 from labA -> labB
  await repository.pindahPraktikan({ uid: 'mhs1', dariClassId: 'labA', keClassId: 'labB' });
  assert.equal(documents.has('participants/labA~mhs1'), false);
  assert.equal(documents.get('participants/labB~mhs1').nim, '240601');
  assert.equal(documents.get('classes/labA').participantCount, 0);
  assert.equal(documents.get('classes/labB').participantCount, 1);

  // Jadwal dan riwayat presensi di Lab asal TIDAK berubah
  assert.equal(documents.has('classes/labA/schedules/sched1'), true);
  assert.equal(documents.has('attendance/labA~ses1~mhs1'), true);

  // Tercatat di riwayatPindah
  const history = [...documents.entries()].filter(([k]) => k.startsWith('riwayatPindah/'));
  assert.equal(history.length, 1);
  assert.equal(history[0][1].jenis, 'praktikan');
  assert.equal(history[0][1].uid, 'mhs1');
  assert.equal(history[0][1].dariClassId, 'labA');
  assert.equal(history[0][1].keClassId, 'labB');
  assert.equal(history[0][1].olehUid, 'aslab1');

  // Non-aslab atau Lab milik Aslab lain ditolak
  user = { uid: 'asprak1' };
  await assert.rejects(
    repository.pindahPraktikan({ uid: 'mhs1', dariClassId: 'labB', keClassId: 'labA' }),
    /Hanya Aslab/,
  );
  user = { uid: 'aslab1' };
  await assert.rejects(
    repository.pindahPraktikan({ uid: 'mhs1', dariClassId: 'labB', keClassId: 'labOther' }),
    /milik Anda sendiri/,
  );
});

test('SRS-023 enforces Asprak role on assign/import and blocks move if Asprak has an open session', async () => {
  const users = [...documents.entries()]
    .filter(([k]) => k.startsWith('users/'))
    .map(([, v]) => v);
  const revalidator = pencocokan.buatRevalidatorAsprak(users, new Set(['asprak1']));

  const parsed = csv.parseCsv([
    'email,kode_asprak,nama',
    'budi@staff.id,,Budi', // valid asprak
    ',ASP-01,Andi', // already assigned
    'citra@mhs.id,,Citra', // not asprak
    'missing@staff.id,,Unknown', // unregistered
  ].join('\n'));
  const rows = review.buatBarisTinjauan(pencocokan.petakanCsvAsprak(parsed.rows), revalidator);
  assert.equal(rows[0].errors.length, 0);
  assert.match(rows[1].errors[0], /sudah ditugaskan/);
  assert.match(rows[2].errors[0], /berperan Asprak/);
  assert.match(rows[3].errors[0], /belum terdaftar/);

  // Direct assign rejects non-asprak
  await assert.rejects(
    pengampuRepo.tambahAsprak('labB', { uid: 'mhs2', nama: 'Dodi', kode: '240602' }),
    /berperan Asprak/,
  );
  await pengampuRepo.tambahAsprak('labB', { uid: 'asprak2', nama: 'Budi', kode: 'ASP-02', email: 'budi@staff.id' });
  assert.equal(documents.has('pengampu/labB~asprak2'), true);

  // Move blocked when Asprak has an open session
  documents.set('classes/labA/sessions/ses1', { scheduleId: 'sched1', status: 'dibuka', asistenId: 'asprak1' });
  await assert.rejects(
    pengampuRepo.pindahAsprak({ uid: 'asprak1', dariClassId: 'labA', keClassId: 'labB' }),
    /masih dibuka/,
  );
  assert.equal(documents.has('pengampu/labA~asprak1'), true);

  // Move succeeds once session is closed; old access removed & history logged
  documents.set('classes/labA/sessions/ses1', { scheduleId: 'sched1', status: 'ditutup', asistenId: 'asprak1' });
  await pengampuRepo.pindahAsprak({ uid: 'asprak1', dariClassId: 'labA', keClassId: 'labB' });
  assert.equal(documents.has('pengampu/labA~asprak1'), false);
  assert.equal(documents.has('pengampu/labB~asprak1'), true);

  const history = [...documents.entries()].filter(([k, v]) => k.startsWith('riwayatPindah/') && v.jenis === 'asprak');
  assert.equal(history.length, 1);
  assert.equal(history[0][1].uid, 'asprak1');
  assert.equal(history[0][1].dariClassId, 'labA');
  assert.equal(history[0][1].keClassId, 'labB');
});
