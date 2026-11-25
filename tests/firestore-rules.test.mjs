import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { initializeApp, deleteApp } from 'firebase/app';
import {
  collection,
  connectFirestoreEmulator,
  deleteDoc,
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
  seed.set(doc(admin, 'participants/own~student'), {
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
    asistenId: 'assistant',
    topik: null,
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
    setDoc(doc(student, 'participants/other~student'), {
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
    await denied(setDoc(doc(assistant, 'participants/new~other'), participant));
    const batch = writeBatch(assistant);
    batch.set(doc(assistant, 'participants/new~other'), participant);
    batch.update(doc(assistant, 'classes/new'), {
      participantCount: 1,
      lastChildId: 'new~other',
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
    assert.equal((await getDoc(doc(assistant, 'participants/new~other'))).exists(), true);
  },
);
test('assistant creates and deletes a scheduled session in atomic writes', options, async () => {
  const classRef = doc(assistant, 'classes/crud');
  await setDoc(classRef, { ...klass('CRUD'), createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  const scheduleRef = doc(assistant, 'classes/crud/schedules/thursday');
  const session = doc(assistant, 'classes/crud/sessions/first');
  const addSchedule = writeBatch(assistant);
  addSchedule.set(scheduleRef, { ...schedule(), createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  addSchedule.update(classRef, { scheduleCount: 1, lastChildId: 'thursday', updatedAt: serverTimestamp() });
  await addSchedule.commit();

  const addSession = writeBatch(assistant);
  addSession.set(session, {
    scheduleId: 'thursday',
    tanggal: '2026-11-12',
    modul: 'Modul 1',
    keterangan: '',
    status: 'belum_dibuka',
    asistenId: 'assistant',
    topik: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  addSession.update(classRef, { sessionCount: 1, lastChildId: 'first', updatedAt: serverTimestamp() });
  addSession.update(scheduleRef, { sessionCount: 1, lastSessionId: 'first', updatedAt: serverTimestamp() });
  await addSession.commit();
  await updateDoc(session, { modul: 'Modul 2', updatedAt: serverTimestamp() });
  assert.equal((await getDoc(session)).data().modul, 'Modul 2');

  const removeSession = writeBatch(assistant);
  removeSession.delete(session);
  removeSession.update(classRef, { sessionCount: 0, lastChildId: 'first', updatedAt: serverTimestamp() });
  removeSession.update(scheduleRef, { sessionCount: 0, lastSessionId: 'first', updatedAt: serverTimestamp() });
  await removeSession.commit();
  assert.equal((await getDoc(session)).exists(), false);
});

test('assistant cannot reset counters without writing the linked child', options, async () => {
  await denied(updateDoc(doc(assistant, 'classes/own'), {
    participantCount: 0,
    lastChildId: 'own~student',
    updatedAt: serverTimestamp(),
  }));
  await denied(updateDoc(doc(assistant, 'classes/own/schedules/schedule'), {
    sessionCount: 0,
    lastSessionId: 'session',
    updatedAt: serverTimestamp(),
  }));
});

test('QR check-in validates the code, membership, and one check-in per session', options, async () => {
  const ref = doc(assistant, 'classes/own/sessions/session');
  const privateCode = doc(assistant, 'sessionCodes/own~session');
  await denied(updateDoc(ref, { status: 'dibuka', updatedAt: serverTimestamp() }));

  const open = writeBatch(assistant);
  open.update(ref, { status: 'dibuka', updatedAt: serverTimestamp() });
  open.set(privateCode, { classId: 'own', sesiId: 'session', kode: '4829' });
  await open.commit();
  await denied(getDoc(doc(student, 'sessionCodes/own~session')));

  const checkIn = (db, uid, kode) => setDoc(doc(db, `attendance/own~session~${uid}`), {
    classId: 'own',
    sessionId: 'session',
    sesiId: 'own~session',
    praktikanId: uid,
    kode,
    waktuHadir: serverTimestamp(),
  });
  await denied(checkIn(student, 'student', '0000'));
  await denied(checkIn(client('other'), 'other', '4829'));
  await checkIn(student, 'student', '4829');
  await denied(checkIn(student, 'student', '4829'));

  const close = writeBatch(assistant);
  close.update(ref, { status: 'ditutup', updatedAt: serverTimestamp() });
  close.delete(privateCode);
  await close.commit();
  await denied(updateDoc(ref, { status: 'dibuka', updatedAt: serverTimestamp() }));
  await denied(updateDoc(ref, { modul: 'Changed', updatedAt: serverTimestamp() }));
});

test('push tokens are owned by their user and readable by assistants (SRS-017)', options, async () => {
  const token = (uid, value = 'ExponentPushToken[abc123]') => ({
    uid,
    token: value,
    platform: 'android',
    updatedAt: serverTimestamp(),
  });
  const own = doc(student, 'pushTokens/student');
  await denied(setDoc(doc(student, 'pushTokens/other'), token('other')));
  await denied(setDoc(own, token('student', 'bukan-token')));
  await denied(setDoc(own, { ...token('student'), extra: true }));
  await denied(setDoc(own, { ...token('student'), platform: 'web' }));
  await setDoc(own, token('student'));
  await setDoc(own, token('student', 'ExpoPushToken[xyz789]'));

  assert.equal((await getDoc(doc(assistant, 'pushTokens/student'))).data().token, 'ExpoPushToken[xyz789]');
  await denied(getDoc(doc(client('other'), 'pushTokens/student')));
  await denied(getDocs(collection(assistant, 'pushTokens')));
  await denied(setDoc(doc(assistant, 'pushTokens/student'), token('student')));
  await denied(deleteDoc(doc(assistant, 'pushTokens/student')));
  await deleteDoc(own);
});
test(
  'laboratories: assistants can write, students and assistants can read, anonymous is denied',
  options,
  async () => {
    const labRef = doc(assistant, 'laboratories/lab-test');
    await denied(getDoc(doc(anonymous, 'laboratories/lab-test')));
    await denied(setDoc(doc(anonymous, 'laboratories/lab-test'), { nama: 'Lab Anon' }));
    await denied(setDoc(doc(student, 'laboratories/lab-test'), { nama: 'Lab Mhs' }));

    await setDoc(labRef, { nama: 'Lab Test', lat: -6.2, lng: 106.8, radiusMeter: 50 });
    assert.equal((await getDoc(doc(student, 'laboratories/lab-test'))).exists(), true);
    assert.equal((await getDoc(doc(assistant, 'laboratories/lab-test'))).exists(), true);

    await updateDoc(labRef, { nama: 'Lab Test Updated' });
    assert.equal(
      (await getDoc(doc(student, 'laboratories/lab-test'))).data().nama,
      'Lab Test Updated',
    );
    await denied(updateDoc(doc(student, 'laboratories/lab-test'), { nama: 'Lab Hack' }));

    await denied(deleteDoc(doc(student, 'laboratories/lab-test')));
    await deleteDoc(labRef);
    assert.equal((await getDoc(doc(assistant, 'laboratories/lab-test'))).exists(), false);
  },
);

test(
  'assistant can create and edit schedule with labId; schedules without labId remain valid',
  options,
  async () => {
    const classRef = doc(assistant, 'classes/lab-sched');
    await setDoc(classRef, {
      ...klass('LS'),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    const schedRef = doc(assistant, 'classes/lab-sched/schedules/friday');

    const addSchedule = writeBatch(assistant);
    addSchedule.set(schedRef, {
      ...schedule(),
      hari: 'Jumat',
      labId: 'lab-1',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    addSchedule.update(classRef, {
      scheduleCount: 1,
      lastChildId: 'friday',
      updatedAt: serverTimestamp(),
    });
    await addSchedule.commit();

    assert.equal((await getDoc(schedRef)).data().labId, 'lab-1');

    await updateDoc(schedRef, { labId: 'lab-2', updatedAt: serverTimestamp() });
    assert.equal((await getDoc(schedRef)).data().labId, 'lab-2');

    const oldSchedRef = doc(assistant, 'classes/own/schedules/schedule');
    assert.equal((await getDoc(oldSchedRef)).data().labId, undefined);
    await updateDoc(oldSchedRef, { ruangan: 'Lab 2 Baru', updatedAt: serverTimestamp() });
    assert.equal((await getDoc(oldSchedRef)).data().ruangan, 'Lab 2 Baru');
  },
);
