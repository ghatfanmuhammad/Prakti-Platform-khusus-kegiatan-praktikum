import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { initializeApp, deleteApp } from 'firebase/app';
import {
  collection,
  connectFirestoreEmulator,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';

// Only a dedicated demo project on the LOCAL emulator is touched.
const address = process.env.FIRESTORE_EMULATOR_HOST;
const projectId = 'demo-prakti-srs008-tests';
const apps = [];
let assistant, student, anonymous;
const denied = (operation) =>
  assert.rejects(operation, (error) => error.code === 'permission-denied');
function client(uid) {
  const app = initializeApp(
    { projectId, apiKey: 'demo-key', appId: 'demo-app' },
    `rules-${apps.length}`,
  );
  apps.push(app);
  const db = getFirestore(app);
  const url = new URL(`http://${address}`);
  connectFirestoreEmulator(
    db,
    url.hostname,
    Number(url.port),
    uid ? { mockUserToken: uid === 'owner' ? 'owner' : { sub: uid } } : {},
  );
  return db;
}
const klass = (kode) => ({
  kode,
  namaPraktikum: 'Basis Data',
  participantCount: 0,
  scheduleCount: 0,
  sessionCount: 0,
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
});
const schedule = () => ({
  hari: 'Kamis',
  mulai: '08:00',
  selesai: '10:00',
  ruangan: 'Lab 1',
  sessionCount: 0,
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
});
before(async () => {
  if (!address) return;
  assert.match(
    address,
    /^(127\.0\.0\.1|localhost):\d+$/,
    'Use a local emulator, never a hosted database',
  );
  const rules = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');
  const response = await fetch(
    `http://${address}/emulator/v1/projects/${projectId}:securityRules`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rules: { files: [{ name: 'firestore.rules', content: rules }] },
      }),
    },
  );
  assert.equal(response.ok, true, await response.text());
  const cleared = await fetch(
    `http://${address}/emulator/v1/projects/${projectId}/databases/(default)/documents`,
    { method: 'DELETE' },
  );
  assert.equal(cleared.ok, true);
  const admin = client('owner');
  const seed = writeBatch(admin);
  seed.set(doc(admin, 'users/assistant'), { role: 'asisten' });
  seed.set(doc(admin, 'users/student'), { role: 'praktikan' });
  seed.set(doc(admin, 'users/other'), { role: 'praktikan' });
  seed.set(doc(admin, 'classes/own'), {
    ...klass('OWN'),
    participantCount: 1,
    scheduleCount: 1,
    sessionCount: 1,
  });
  seed.set(doc(admin, 'classes/other'), {
    ...klass('OTHER'),
    scheduleCount: 1,
  });
  seed.set(doc(admin, 'participants/own_student'), {
    classId: 'own',
    uid: 'student',
    nama: 'Raihan',
    nim: '240601',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  seed.set(doc(admin, 'classes/own/schedules/schedule'), {
    ...schedule(),
    sessionCount: 1,
  });
  seed.set(doc(admin, 'classes/other/schedules/schedule'), schedule());
  seed.set(doc(admin, 'classes/own/sessions/session'), {
    scheduleId: 'schedule',
    tanggal: '2026-11-12',
    modul: 'Modul 1',
    keterangan: '',
    status: 'belum_dibuka',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  await seed.commit();
  assistant = client('assistant');
  student = client('student');
  anonymous = client();
});
after(async () => {
  await Promise.all(apps.map(deleteApp));
});
const options = {
  skip: !address && 'Set FIRESTORE_EMULATOR_HOST to run real rules checks',
};
test('anonymous cannot read data or self-create an assistant profile', options, async () => {
  await denied(getDoc(doc(anonymous, 'classes/own')));
  await denied(setDoc(doc(anonymous, 'users/new'), { role: 'asisten' }));
});
test(
  'student reads only their own classes, schedules, sessions, and memberships',
  options,
  async () => {
    assert.equal((await getDoc(doc(student, 'classes/own'))).exists(), true);
    assert.equal((await getDocs(collection(student, 'classes/own/schedules'))).size, 1);
    assert.equal((await getDocs(collection(student, 'classes/own/sessions'))).size, 1);
    assert.equal(
      (await getDocs(query(collection(student, 'participants'), where('uid', '==', 'student'))))
        .size,
      1,
    );
    await denied(getDoc(doc(student, 'classes/other')));
    await denied(getDocs(collection(student, 'classes/other/schedules')));
    await denied(getDocs(collection(student, 'classes')));
    await denied(getDocs(collection(student, 'participants')));
    await denied(getDocs(query(collection(student, 'participants'), where('uid', '==', 'other'))));
  },
);
test('student cannot write data, enroll themselves, or promote their role', options, async () => {
  await denied(updateDoc(doc(student, 'users/student'), { role: 'asisten' }));
  await denied(
    updateDoc(doc(student, 'classes/own'), {
      kode: 'HACK',
      updatedAt: serverTimestamp(),
    }),
  );
  await denied(
    setDoc(doc(student, 'participants/other_student'), {
      classId: 'other',
      uid: 'student',
      nama: 'Raihan',
      nim: '240601',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }),
  );
  await denied(
    updateDoc(doc(student, 'classes/own/sessions/session'), {
      status: 'dibuka',
      updatedAt: serverTimestamp(),
    }),
  );
});
test(
  'assistant creates valid data; enrollment must update parent counters atomically',
  options,
  async () => {
    await setDoc(doc(assistant, 'classes/new'), {
      ...klass('NEW'),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    const participant = {
      classId: 'new',
      uid: 'other',
      nama: 'Other',
      nim: '240602',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await denied(setDoc(doc(assistant, 'participants/new_other'), participant));
    const batch = writeBatch(assistant);
    batch.set(doc(assistant, 'participants/new_other'), participant);
    batch.update(doc(assistant, 'classes/new'), {
      participantCount: 1,
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
    assert.equal((await getDoc(doc(assistant, 'participants/new_other'))).exists(), true);
  },
);
test('closed sessions cannot reopen or have historical content changed', options, async () => {
  const ref = doc(assistant, 'classes/own/sessions/session');
  await updateDoc(ref, { status: 'dibuka', updatedAt: serverTimestamp() });
  await updateDoc(ref, { status: 'ditutup', updatedAt: serverTimestamp() });
  await denied(updateDoc(ref, { status: 'dibuka', updatedAt: serverTimestamp() }));
  await denied(updateDoc(ref, { modul: 'Changed', updatedAt: serverTimestamp() }));
});
