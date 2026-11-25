import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import * as firestore from 'firebase/firestore';
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
const require = createRequire(import.meta.url);
const load = require('./helpers/load-typescript.cjs');
const { periksaRadius } = load(new URL('../src/features/presensi/lokasi.ts', import.meta.url).pathname);
const { bacaIsiQr, buatIsiQr } = load(new URL('../src/utils/qr.ts', import.meta.url).pathname);
const lab = { id: 'lab-1', nama: 'Lab 1', lat: -6.2, lng: 106.8, radiusMeter: 50 };
const posisi = { lat: lab.lat, lng: lab.lng, akurasi: 10 };
const lokasi = { labId: lab.id, ...posisi };
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
    labId: lab.id,
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
  seed.set(doc(admin, 'laboratories', lab.id), lab);
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

  const checkIn = (db, uid, kode) => {
    const batch = writeBatch(db);
    const id = `own~session~${uid}`;
    batch.set(doc(db, 'attendance', id), {
      classId: 'own', sessionId: 'session', sesiId: 'own~session', praktikanId: uid, kode,
      waktuHadir: serverTimestamp(),
    });
    batch.set(doc(db, 'attendanceLocations', id), { lokasi, waktuHadir: serverTimestamp() });
    return batch.commit();
  };
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

    const oldSchedRef = doc(assistant, 'classes/other/schedules/schedule');
    assert.equal((await getDoc(oldSchedRef)).data().labId, undefined);
    await updateDoc(oldSchedRef, { ruangan: 'Lab 2 Baru', updatedAt: serverTimestamp() });
    assert.equal((await getDoc(oldSchedRef)).data().ruangan, 'Lab 2 Baru');
  },
);


for (const metode of ['qr', 'manual']) {
  test(`${metode}: real saveAttendance persists inside, rejects outside/closed/duplicate without new records`, options, async () => {
    const admin = client('owner');
    const sessionId = `radius-${metode}`;
    const sesi = { id: `own~${sessionId}`, classId: 'own', sessionId };
    const sessionRef = doc(admin, 'classes/own/sessions', sessionId);
    await setDoc(sessionRef, { scheduleId: 'schedule', status: 'dibuka' });
    await setDoc(doc(admin, 'sessionCodes', sesi.id), { classId: 'own', sesiId: sessionId, kode: '4829' });
    const { saveAttendance } = load(new URL('../src/features/data-praktikum/attendance.ts', import.meta.url).pathname, {
      'firebase/firestore': firestore,
      '../../services/firebase': { db: student, auth: { currentUser: { uid: 'student' } } },
    });
    const kode = metode === 'qr' ? bacaIsiQr(buatIsiQr({ id: sesi.id, kode: '4829' })).kode : '4829';
    const target = doc(student, 'attendance', `${sesi.id}~student`);
    const outside = { ...posisi, lat: posisi.lat + 0.001 };
    await assert.rejects(saveAttendance(sesi, 'student', kode, periksaRadius(outside, lab)));
    assert.equal((await getDoc(target)).exists(), false, 'outside attempt must create no attendance');
    // A forged successful client flag must also fail repository recalculation.
    await assert.rejects(saveAttendance(sesi, 'student', kode, { ...periksaRadius(posisi, lab), posisi: outside }));
    assert.equal((await getDoc(target)).exists(), false);
    const privateRef = doc(student, 'attendanceLocations', target.id);
    const summary = { classId: 'own', sessionId, sesiId: sesi.id, praktikanId: 'student', kode,
      waktuHadir: serverTimestamp() };
    const directWrite = (location) => {
      const batch = writeBatch(student);
      batch.set(target, summary);
      batch.set(privateRef, { waktuHadir: serverTimestamp(), lokasi: location });
      return batch.commit();
    };
    await denied(directWrite({ ...lokasi, ...outside }));
    assert.equal((await getDoc(target)).exists(), false, 'rules reject direct outside writes');
    assert.equal((await getDoc(privateRef)).exists(), false, 'failed attendance cannot leave private coordinates');
    await denied(directWrite({ ...lokasi, labId: 'another-lab' }));
    await denied(directWrite({ ...lokasi, akurasi: 101 }));
    await denied(setDoc(target, summary));
    await denied(setDoc(privateRef, { waktuHadir: serverTimestamp(), lokasi }));
    await denied(setDoc(target, { ...summary, lokasi }));
    await updateDoc(sessionRef, { status: 'ditutup' });
    assert.equal((await saveAttendance(sesi, 'student', kode, periksaRadius(posisi, lab))).reason, 'SESI_DITUTUP');
    await denied(directWrite(lokasi));
    assert.equal((await getDoc(target)).exists(), false, 'closed session creates no attendance');
    await updateDoc(sessionRef, { status: 'dibuka' });
    const scheduleRef = doc(admin, 'classes/own/schedules/schedule');
    await updateDoc(scheduleRef, { labId: 'changed-lab' });
    await assert.rejects(saveAttendance(sesi, 'student', kode, periksaRadius(posisi, lab)), /Laboratorium berubah/);
    assert.equal((await getDoc(target)).exists(), false);
    await updateDoc(scheduleRef, { labId: lab.id });
    const saved = await saveAttendance(sesi, 'student', kode, periksaRadius(posisi, lab));
    assert.equal(saved.ok, true);
    const original = (await getDoc(target)).data();
    assert.equal(Object.hasOwn(original, 'lokasi'), false);
    const privateOriginal = (await getDoc(privateRef)).data();
    assert.deepEqual(privateOriginal.lokasi, lokasi);
    assert.deepEqual((await getDoc(doc(assistant, 'attendance', target.id))).data(), original);
    const recap = await getDocs(collection(assistant, 'attendance'));
    assert.ok(recap.docs.some((row) => row.id === target.id), 'assistant recap remains queryable');
    assert.ok(recap.docs.every((row) => !Object.hasOwn(row.data(), 'lokasi')));
    for (const account of [assistant, anonymous, client('other')]) {
      await denied(getDoc(doc(account, 'attendanceLocations', target.id)));
      await denied(getDocs(collection(account, 'attendanceLocations')));
    }
    await denied(updateDoc(privateRef, { lokasi: { ...lokasi, lat: 0 } }));
    await denied(deleteDoc(privateRef));
    assert.equal((await saveAttendance(sesi, 'student', kode, periksaRadius(posisi, lab))).reason, 'SUDAH_PRESENSI');
    await denied(directWrite(lokasi));
    assert.deepEqual((await getDoc(target)).data(), original, 'duplicate cannot alter original attendance');
    assert.deepEqual((await getDoc(privateRef)).data(), privateOriginal);
  });
}
