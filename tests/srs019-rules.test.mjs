import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { initializeApp, deleteApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, doc, collection, getDoc, getDocs, setDoc, updateDoc, deleteDoc, writeBatch, query, where, serverTimestamp, Timestamp } from 'firebase/firestore';

const address = process.env.FIRESTORE_EMULATOR_HOST;
const options = { skip: !address && 'Local Firestore emulator required' };
const projectId = 'demo-prakti-srs019-tests';
const apps = [];
const denied = (op) => assert.rejects(op, (error) => error.code === 'permission-denied');
let admin, aslab, otherLab, asprak, unassigned, student;
function client(uid, email = `${uid}@example.test`) {
  const app = initializeApp({ projectId, apiKey: 'demo-key', appId: 'demo-app' }, `srs019-${apps.length}`);
  apps.push(app);
  const db = getFirestore(app), url = new URL(`http://${address}`);
  connectFirestoreEmulator(db, url.hostname, Number(url.port), { mockUserToken: uid === 'owner' ? 'owner' : { sub: uid, email } });
  return db;
}
const klass = (aslabUid) => ({ aslabUid, kode: 'A', namaPraktikum: 'Lab A', participantCount: 0, scheduleCount: 0, sessionCount: 0, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
before(async () => {
  if (!address) return;
  assert.match(address, /^(127\.0\.0\.1|localhost):\d+$/);
  const rules = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');
  const applied = await fetch(`http://${address}/emulator/v1/projects/${projectId}:securityRules`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rules: { files: [{ name: 'firestore.rules', content: rules }] } }) });
  assert.equal(applied.ok, true, await applied.text());
  assert.equal((await fetch(`http://${address}/emulator/v1/projects/${projectId}/databases/(default)/documents`, { method: 'DELETE' })).ok, true);
  admin = client('owner');
  const batch = writeBatch(admin);
  for (const [uid, role] of Object.entries({ lab: 'aslab', lab2: 'aslab', staff: 'asprak', outside: 'asprak', student: 'praktikan', legacy: 'asisten' })) batch.set(doc(admin, 'users', uid), { uid, role, email: `${uid}@example.test`, name: uid, nimOrCode: '001' });
  batch.set(doc(admin, 'classes/a'), klass('lab'));
  batch.set(doc(admin, 'classes/b'), klass('lab2'));
  batch.set(doc(admin, 'pengampu/a~staff'), { classId: 'a', uid: 'staff', createdAt: Timestamp.now() });
  batch.set(doc(admin, 'classes/a/schedules/j'), { hari: 'Kamis', mulai: '08:00', selesai: '10:00', ruangan: 'Lab A', sessionCount: 1, createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
  batch.set(doc(admin, 'classes/a/sessions/s'), { scheduleId: 'j', tanggal: '2026-11-12', modul: 'M1', keterangan: '', status: 'belum_dibuka', asistenId: 'staff', topik: null, createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
  batch.set(doc(admin, 'participants/a~student'), { classId: 'a', uid: 'student', nama: 'Student', nim: '123' });
  await batch.commit();
  aslab = client('lab'); otherLab = client('lab2'); asprak = client('staff'); unassigned = client('outside'); student = client('student');
});
after(async () => { await Promise.all(apps.map(deleteApp)); });

const profile = (uid, role, email = `${uid}@example.test`) => ({ uid, email, role, name: 'Nama', nimOrCode: '001', createdAt: serverTimestamp() });
test('staff signup requires BOTH matching email and role; legacy whitelist cannot grant access', options, async () => {
  for (const [uid, role] of [['newlab', 'aslab'], ['newstaff', 'asprak']]) {
    const email = `${uid}@example.test`, db = client(uid, email);
    await setDoc(doc(admin, 'staf_terdaftar', email), { email, role });
    await denied(setDoc(doc(db, 'users', uid), profile(uid, role === 'aslab' ? 'asprak' : 'aslab')));
    await setDoc(doc(db, 'users', uid), profile(uid, role));
    assert.equal((await getDoc(doc(db, 'users', uid))).data().role, role);
    await denied(getDoc(doc(db, 'staf_terdaftar', email)));
  }
  await denied(setDoc(doc(client('missing'), 'users/missing'), profile('missing', 'aslab')));
  await setDoc(doc(admin, 'staf_terdaftar/wrong@example.test'), { email: 'different@example.test', role: 'asprak' });
  await denied(setDoc(doc(client('wrong'), 'users/wrong'), profile('wrong', 'asprak')));
  await setDoc(doc(admin, 'asisten_terdaftar/old@example.test'), {});
  await denied(setDoc(doc(client('old'), 'users/old'), profile('old', 'asprak')));
  await denied(setDoc(doc(client('oldrole'), 'users/oldrole'), profile('oldrole', 'asisten')));
  await setDoc(doc(client('newstudent'), 'users/newstudent'), profile('newstudent', 'praktikan'));
});

test('self role changes and whitelist edits are denied for all roles', options, async () => {
  for (const [db, uid] of [[aslab, 'lab'], [asprak, 'staff'], [student, 'student']]) {
    for (const role of ['aslab', 'asprak', 'praktikan'].filter((role) => role !== (uid === 'lab' ? 'aslab' : uid === 'staff' ? 'asprak' : 'praktikan'))) await denied(updateDoc(doc(db, 'users', uid), { role }));
    await denied(setDoc(doc(db, 'staf_terdaftar/injected@example.test'), { email: 'injected@example.test', role: 'aslab' }));
    await updateDoc(doc(db, 'users', uid), { name: 'Nama diperbarui' });
  }
});

test('class ownership is immutable and isolates Aslab accounts; Asprak/legacy/Praktikan cannot create labs', options, async () => {
  await setDoc(doc(aslab, 'classes/owned-new'), klass('lab'));
  await denied(setDoc(doc(aslab, 'classes/spoof-owner'), klass('lab2')));
  for (const db of [asprak, student, client('legacy')]) await denied(setDoc(doc(db, 'classes/no-create'), klass('lab')));
  await denied(getDoc(doc(otherLab, 'classes/a')));
  await denied(updateDoc(doc(otherLab, 'classes/a'), { kode: 'HACK', updatedAt: serverTimestamp() }));
  await denied(updateDoc(doc(aslab, 'classes/a'), { aslabUid: 'lab2', updatedAt: serverTimestamp() }));
  assert.equal((await getDocs(query(collection(aslab, 'classes'), where('aslabUid', '==', 'lab')))).size, 2);
  await denied(getDocs(collection(aslab, 'classes')));
  await denied(getDocs(collection(aslab, 'users')));
  await denied(getDoc(doc(asprak, 'users/lab')));
  await denied(getDoc(doc(student, 'users/staff')));
  await denied(getDoc(doc(client('legacy'), 'classes/a')));
});

test('only class owner assigns Asprak; assignments grant and revoke scoped access', options, async () => {
  const ref = doc(aslab, 'pengampu/a~outside');
  await denied(setDoc(doc(asprak, 'pengampu/a~outside'), { classId: 'a', uid: 'outside', createdAt: serverTimestamp() }));
  await denied(setDoc(doc(otherLab, 'pengampu/a~outside'), { classId: 'a', uid: 'outside', createdAt: serverTimestamp() }));
  await denied(setDoc(doc(aslab, 'pengampu/a~student'), { classId: 'a', uid: 'student', createdAt: serverTimestamp() }));
  await denied(getDoc(doc(unassigned, 'classes/a')));
  await setDoc(ref, { classId: 'a', uid: 'outside', createdAt: serverTimestamp() });
  assert.equal((await getDoc(doc(unassigned, 'classes/a'))).exists(), true);
  await denied(updateDoc(ref, { uid: 'student' }));
  await denied(deleteDoc(doc(unassigned, 'pengampu/a~outside')));
  await deleteDoc(ref);
  await denied(getDoc(doc(unassigned, 'classes/a')));
  await denied(getDoc(doc(asprak, 'classes/b')));
});

test('operational writes are assigned Asprak only; recap remains scoped and raw coordinates/tokens private', options, async () => {
  const change = { modul: 'Updated', updatedAt: serverTimestamp() };
  await updateDoc(doc(asprak, 'classes/a/sessions/s'), change);
  for (const db of [aslab, otherLab, unassigned, student]) await denied(updateDoc(doc(db, 'classes/a/sessions/s'), change));
  await setDoc(doc(admin, 'attendance/a~s~student'), { classId: 'a', sesiId: 'a~s', praktikanId: 'student', waktuHadir: Timestamp.now() });
  await setDoc(doc(admin, 'attendanceLocations/a~s~student'), { lokasi: { lat: -6.2, lng: 106.8 }, waktuHadir: Timestamp.now() });
  await setDoc(doc(admin, 'pushTokens/student'), { uid: 'student', token: 'ExpoPushToken[private]' });
  for (const db of [aslab, asprak]) {
    assert.equal((await getDocs(query(collection(db, 'attendance'), where('classId', '==', 'a')))).size, 1);
    await denied(getDoc(doc(db, 'attendanceLocations/a~s~student')));
    await denied(getDoc(doc(db, 'pushTokens/student')));
    await denied(getDocs(collection(db, 'pushTokens')));
  }
  for (const db of [otherLab, unassigned]) await denied(getDoc(doc(db, 'attendance/a~s~student')));
});

test('Admin SDK migration dry-run and repeat apply preserve UID, old records and valid push access', options, async () => {
  const require = createRequire(import.meta.url), serverRequire = createRequire(new URL('../functions/package.json', import.meta.url));
  const { initializeApp: initAdmin, deleteApp: closeAdmin } = serverRequire('firebase-admin/app');
  const { getFirestore: adminDb, Timestamp: AdminTimestamp, FieldValue } = serverRequire('firebase-admin/firestore');
  const migrationProject = 'demo-prakti-srs019-migration-tests';
  const app = initAdmin({ projectId: migrationProject }, 'migration');
  try {
    const db = adminDb(app);
    await fetch(`http://${address}/emulator/v1/projects/${migrationProject}/databases/(default)/documents`, { method: 'DELETE' });
    const old = { uid: 'legacy-staff', email: 'Legacy@Example.Test', role: 'asisten', name: 'Nama Lama', nimOrCode: 'AST-1', createdAt: AdminTimestamp.fromMillis(1000), customLegacy: 'keep' };
    await db.doc('users/legacy-staff').set(old);
    await db.doc('users/lab').set({ uid: 'lab', role: 'aslab' });
    const klass = { kode: 'OLD', namaPraktikum: 'Lab Lama', participantCount: 1, scheduleCount: 1, sessionCount: 1 };
    await db.doc('classes/legacy-class').set(klass);
    const session = { asistenId: 'legacy-staff', scheduleId: 'j', status: 'dibuka', tanggal: '2026-11-12', modul: 'Lama' };
    await db.doc('classes/legacy-class/sessions/s').set(session);
    await db.doc('classes/legacy-class/schedules/j').set({ mulai: '08:00', selesai: '10:00', ruangan: 'Lab Lama' });
    await db.doc('participants/legacy-class~student').set({ classId: 'legacy-class', uid: 'student' });
    await db.doc('pushTokens/student').set({ uid: 'student', token: 'ExpoPushToken[target]' });
    const attendance = { sesiId: 'legacy-class~s', praktikanId: 'student', waktuHadir: AdminTimestamp.fromMillis(2000) };
    await db.doc('attendance/legacy-class~s~student').set(attendance);
    const { planMigration, applyMigration } = require('../scripts/migrate-srs019.cjs');
    const before = await planMigration(db);
    assert.deepEqual(before.needsOwnership, ['legacy-class']);
    const dry = spawnSync(process.execPath, [new URL('../scripts/migrate-srs019.cjs', import.meta.url).pathname, '--project', migrationProject, '--dry-run'], { encoding: 'utf8', env: { ...process.env, FIRESTORE_EMULATOR_HOST: address } });
    assert.equal(dry.status, 0, dry.stderr);
    assert.equal(JSON.parse(dry.stdout).mode, 'dry-run');
    assert.deepEqual((await db.doc('users/legacy-staff').get()).data(), old);
    const mapping = { classOwners: { 'legacy-class': 'lab' }, assignments: [{ classId: 'legacy-class', uid: 'legacy-staff' }] };
    const plan = await planMigration(db, mapping);
    assert.deepEqual(plan.conflicts, []);
    await applyMigration(db, plan, () => FieldValue.serverTimestamp());
    assert.deepEqual((await db.doc('users/legacy-staff').get()).data(), { ...old, role: 'asprak' });
    assert.deepEqual((await db.doc('classes/legacy-class').get()).data(), { ...klass, aslabUid: 'lab' });
    assert.deepEqual((await db.doc('classes/legacy-class/sessions/s').get()).data(), session);
    assert.deepEqual((await db.doc('attendance/legacy-class~s~student').get()).data(), attendance);
    assert.deepEqual((await db.doc('staf_terdaftar/legacy@example.test').get()).data(), { email: 'legacy@example.test', role: 'asprak' });
    const wrongOwner = await planMigration(db, { classOwners: { 'legacy-class': 'legacy-staff' } });
    assert.ok(wrongOwner.conflicts.length > 0);
    await assert.rejects(applyMigration(db, wrongOwner, () => FieldValue.serverTimestamp()), /Konflik/);
    assert.equal((await db.doc('classes/legacy-class').get()).data().aslabUid, 'lab');
    const again = await planMigration(db, mapping);
    assert.deepEqual([again.users, again.owners, again.assignments], [[], [], []]);
    assert.deepEqual(await applyMigration(db, again, () => FieldValue.serverTimestamp()), { processed: 0 });
    const load = require('./helpers/load-typescript.cjs');
    const { dispatchNotification } = load(new URL('../functions/src/dispatcher.ts', import.meta.url).pathname);
    const previous = globalThis.fetch, sent = [];
    globalThis.fetch = async (_url, options) => { const body = JSON.parse(options.body); sent.push(...body); return { ok: true, json: async () => ({ data: body.map(() => ({ status: 'ok' })) }) }; };
    try {
      const result = await dispatchNotification('legacy-staff', { jenis: 'sesi_dibuka', classId: 'legacy-class', sessionId: 's' }, {
        read: async (path) => (await db.doc(path).get()).data(),
        members: async (classId) => (await db.collection('participants').where('classId', '==', classId).get()).docs.map((doc) => doc.data().uid),
      });
      assert.equal(result.terkirim, 1); assert.deepEqual(sent.map((p) => p.to), ['ExpoPushToken[target]']);
    } finally { globalThis.fetch = previous; }
    await db.doc('users/conflict').set({ uid: 'conflict', email: 'conflict@example.test', role: 'asisten' });
    await db.doc('staf_terdaftar/conflict@example.test').set({ email: 'conflict@example.test', role: 'aslab' });
    const conflict = await planMigration(db);
    assert.equal(conflict.conflicts.length, 1);
    await assert.rejects(applyMigration(db, conflict, () => FieldValue.serverTimestamp()), /Konflik/);
    assert.equal((await db.doc('users/conflict').get()).data().role, 'asisten');
  } finally { await closeAdmin(app); }
});
