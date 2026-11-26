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

const address = process.env.FIRESTORE_EMULATOR_HOST;
const projectId = 'demo-prakti-felicia-rules';
const apps = [];
let aslab1, aslab2, asprak1, student;

const denied = (operation) =>
  assert.rejects(operation, (error) => error.code === 'permission-denied');

function client(uid) {
  const app = initializeApp(
    { projectId, apiKey: 'demo-key', appId: 'demo-app' },
    `felicia-rules-${apps.length}`,
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

const options = {
  skip: !address && 'Set FIRESTORE_EMULATOR_HOST to run real rules checks',
};

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
  await fetch(
    `http://${address}/emulator/v1/projects/${projectId}/databases/(default)/documents`,
    { method: 'DELETE' },
  );

  const admin = client('owner');
  const seed = writeBatch(admin);
  seed.set(doc(admin, 'users/aslab1'), { role: 'aslab', name: 'Aslab 1' });
  seed.set(doc(admin, 'users/aslab2'), { role: 'aslab', name: 'Aslab 2' });
  seed.set(doc(admin, 'users/asprak1'), { role: 'asprak', name: 'Asprak 1' });
  seed.set(doc(admin, 'users/student'), { role: 'praktikan', name: 'Student' });
  seed.set(doc(admin, 'laboratories/room1'), {
    nama: 'Lab Komputer 1',
    lat: -7.05,
    lng: 110.44,
    radiusMeter: 50,
    aslabUid: 'aslab1',
  });
  seed.set(doc(admin, 'classes/labA'), {
    kode: 'BD-A',
    namaLab: 'Lab A',
    namaPraktikum: 'Basis Data',
    aslabUid: 'aslab1',
    labId: 'room1',
    toleransiMenit: 15,
    nominalDenda: 10000,
    participantCount: 0,
    scheduleCount: 0,
    sessionCount: 0,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  seed.set(doc(admin, 'classes/labB'), {
    kode: 'BD-B',
    namaLab: 'Lab B',
    namaPraktikum: 'Basis Data',
    aslabUid: 'aslab1',
    labId: 'room1',
    toleransiMenit: 15,
    nominalDenda: 10000,
    participantCount: 0,
    scheduleCount: 0,
    sessionCount: 0,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  await seed.commit();

  aslab1 = client('aslab1');
  aslab2 = client('aslab2');
  asprak1 = client('asprak1');
  student = client('student');
});

after(async () => {
  await Promise.all(apps.map(deleteApp));
});

test('SRS-020: only owning Aslab can manage their classes and laboratories with valid policy bounds', options, async () => {
  // Valid atomic create of laboratory + class by aslab1
  const batch = writeBatch(aslab1);
  batch.set(doc(aslab1, 'laboratories/room2'), {
    nama: 'Lab 2',
    lat: -7.051,
    lng: 110.441,
    radiusMeter: 100,
    aslabUid: 'aslab1',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(aslab1, 'classes/labC'), {
    kode: 'BD-C',
    namaLab: 'Lab C',
    namaPraktikum: 'Basis Data',
    aslabUid: 'aslab1',
    labId: 'room2',
    toleransiMenit: 10,
    nominalDenda: 5000,
    participantCount: 0,
    scheduleCount: 0,
    sessionCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await batch.commit();

  // Invalid bounds rejected
  await denied(updateDoc(doc(aslab1, 'laboratories/room2'), { radiusMeter: 5, updatedAt: serverTimestamp() }));
  await denied(updateDoc(doc(aslab1, 'classes/labC'), { toleransiMenit: 121, updatedAt: serverTimestamp() }));
  await denied(updateDoc(doc(aslab1, 'classes/labC'), { nominalDenda: 0, updatedAt: serverTimestamp() }));

  // Another Aslab, Asprak, and Praktikan are denied write/read on unowned class
  await denied(updateDoc(doc(aslab2, 'classes/labC'), { namaLab: 'Hijack', updatedAt: serverTimestamp() }));
  await denied(deleteDoc(doc(aslab2, 'classes/labC')));
  await denied(getDoc(doc(aslab2, 'classes/labC')));
  await denied(updateDoc(doc(asprak1, 'classes/labC'), { toleransiMenit: 30, updatedAt: serverTimestamp() }));
  await denied(updateDoc(doc(student, 'classes/labC'), { toleransiMenit: 30, updatedAt: serverTimestamp() }));

  await deleteDoc(doc(aslab1, 'classes/labC'));
});

test('SRS-022 & SRS-023: participants, pengampu, and riwayatPindah require owning Aslab and enforce target role', options, async () => {
  // Enroll student into labA
  const enroll = writeBatch(aslab1);
  enroll.set(doc(aslab1, 'participants/labA~student'), {
    classId: 'labA',
    uid: 'student',
    nama: 'Student',
    nim: '240601',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  enroll.update(doc(aslab1, 'classes/labA'), {
    participantCount: 1,
    lastChildId: 'labA~student',
    updatedAt: serverTimestamp(),
  });
  await enroll.commit();

  // Move student labA -> labB in single atomic transaction + riwayatPindah
  const moveStudent = writeBatch(aslab1);
  moveStudent.delete(doc(aslab1, 'participants/labA~student'));
  moveStudent.set(doc(aslab1, 'participants/labB~student'), {
    classId: 'labB',
    uid: 'student',
    nama: 'Student',
    nim: '240601',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  moveStudent.update(doc(aslab1, 'classes/labA'), {
    participantCount: 0,
    lastChildId: 'labA~student',
    updatedAt: serverTimestamp(),
  });
  moveStudent.update(doc(aslab1, 'classes/labB'), {
    participantCount: 1,
    lastChildId: 'labB~student',
    updatedAt: serverTimestamp(),
  });
  moveStudent.set(doc(aslab1, 'riwayatPindah/hist1'), {
    jenis: 'praktikan',
    uid: 'student',
    dariClassId: 'labA',
    keClassId: 'labB',
    olehUid: 'aslab1',
    waktu: serverTimestamp(),
  });
  await moveStudent.commit();

  // Forged riwayatPindah without actual move is rejected
  await denied(setDoc(doc(aslab1, 'riwayatPindah/fake'), {
    jenis: 'praktikan',
    uid: 'student',
    dariClassId: 'labB',
    keClassId: 'labA',
    olehUid: 'aslab1',
    waktu: serverTimestamp(),
  }));

  // Non-asprak cannot be assigned to pengampu
  await denied(setDoc(doc(aslab1, 'pengampu/labA~student'), {
    classId: 'labA',
    uid: 'student',
    nama: 'Student',
    kode: '240601',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }));

  // Assign asprak1 to labA -> asprak1 can read labA, not labB
  await setDoc(doc(aslab1, 'pengampu/labA~asprak1'), {
    classId: 'labA',
    uid: 'asprak1',
    nama: 'Asprak 1',
    kode: 'ASP-01',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  assert.equal((await getDoc(doc(asprak1, 'classes/labA'))).exists(), true);
  await denied(getDoc(doc(asprak1, 'classes/labB')));

  // Move asprak1 labA -> labB -> old access immediately revoked
  const moveAsprak = writeBatch(aslab1);
  moveAsprak.delete(doc(aslab1, 'pengampu/labA~asprak1'));
  moveAsprak.set(doc(aslab1, 'pengampu/labB~asprak1'), {
    classId: 'labB',
    uid: 'asprak1',
    nama: 'Asprak 1',
    kode: 'ASP-01',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  moveAsprak.set(doc(aslab1, 'riwayatPindah/hist2'), {
    jenis: 'asprak',
    uid: 'asprak1',
    dariClassId: 'labA',
    keClassId: 'labB',
    olehUid: 'aslab1',
    waktu: serverTimestamp(),
  });
  await moveAsprak.commit();

  await denied(getDoc(doc(asprak1, 'classes/labA')));
  assert.equal((await getDoc(doc(asprak1, 'classes/labB'))).exists(), true);
  assert.equal(
    (await getDocs(query(collection(aslab1, 'riwayatPindah'), where('olehUid', '==', 'aslab1')))).size,
    2,
  );
});
