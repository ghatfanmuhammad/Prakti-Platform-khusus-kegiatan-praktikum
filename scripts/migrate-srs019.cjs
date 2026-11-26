const { createRequire } = require('node:module');
const path = require('node:path');
const fs = require('node:fs/promises');
const serverRequire = createRequire(path.resolve(path.dirname(module.filename), '../functions/package.json'));
const validId = (id) => typeof id === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(id);
const emailKey = (value) => typeof value === 'string' ? value.trim().toLowerCase() : '';

// Plan first. A conflicting whitelist or ownership mapping blocks apply entirely.
async function planMigration(db, mapping = {}) {
  const users = await db.collection('users').get();
  const profiles = new Map(users.docs.map((doc) => [doc.id, doc.data()]));
  const plan = { users: [], owners: [], assignments: [], conflicts: [], needsOwnership: [] };
  for (const [uid, user] of profiles) {
    if (user.role !== 'asisten') continue;
    const email = emailKey(user.email);
    if (!email || !email.includes('@') || email.includes('/') || (user.uid && user.uid !== uid)) {
      plan.conflicts.push(`Profil ${uid}: email/UID tidak valid`); continue;
    }
    const whitelist = (await db.doc(`staf_terdaftar/${email}`).get()).data();
    if (whitelist && (whitelist.role !== 'asprak' || whitelist.email !== email)) {
      plan.conflicts.push(`Daftar staf ${email} berbeda; perlu keputusan koordinator`); continue;
    }
    plan.users.push({ uid, email });
  }
  const classes = await db.collection('classes').get();
  const byId = new Map(classes.docs.map((doc) => [doc.id, doc.data()]));
  for (const [classId, klass] of byId) {
    const owner = Object.hasOwn(mapping.classOwners ?? {}, classId) ? mapping.classOwners[classId] : undefined;
    if (!klass.aslabUid && !owner) plan.needsOwnership.push(classId);
  }
  for (const [classId, uid] of Object.entries(mapping.classOwners ?? {})) {
    const klass = byId.get(classId);
    if (!validId(classId) || !validId(uid) || !klass || profiles.get(uid)?.role !== 'aslab' || (klass.aslabUid && klass.aslabUid !== uid)) {
      plan.conflicts.push(`Pemilik ${classId}: mapping tidak valid atau mengganti pemilik lama`); continue;
    }
    if (!klass.aslabUid) plan.owners.push({ classId, uid });
  }
  for (const assignment of mapping.assignments ?? []) {
    const { classId, uid } = assignment;
    const klass = byId.get(classId);
    const role = profiles.get(uid)?.role;
    const existing = validId(classId) && validId(uid) ? (await db.doc(`pengampu/${classId}~${uid}`).get()).data() : undefined;
    if (!validId(classId) || !validId(uid) || !klass || !['asisten', 'asprak'].includes(role)
      || (!klass.aslabUid && !plan.owners.some((item) => item.classId === classId))
      || (existing && (existing.classId !== classId || existing.uid !== uid))) {
      plan.conflicts.push(`Penugasan ${classId}~${uid}: mapping tidak valid`); continue;
    }
    if (!existing && !plan.assignments.some((item) => item.classId === classId && item.uid === uid)) plan.assignments.push({ classId, uid });
  }
  return plan;
}

async function applyMigration(db, plan, timestamp) {
  if (plan.conflicts.length) throw new Error('Konflik migrasi harus diselesaikan sebelum apply.');
  let changed = 0;
  for (const { uid, email } of plan.users) {
    await db.runTransaction(async (tx) => {
      const ref = db.doc(`users/${uid}`), staff = db.doc(`staf_terdaftar/${email}`);
      const [userSnap, staffSnap] = await Promise.all([tx.get(ref), tx.get(staff)]);
      const user = userSnap.data(), whitelist = staffSnap.data();
      if (!user || !['asisten', 'asprak'].includes(user.role) || emailKey(user.email) !== email
        || (whitelist && (whitelist.role !== 'asprak' || whitelist.email !== email))) throw new Error(`Konflik bersamaan pada ${uid}`);
      if (user.role === 'asisten') tx.update(ref, { role: 'asprak' });
      if (!whitelist) tx.set(staff, { email, role: 'asprak' });
    });
    changed++;
  }
  for (const { classId, uid } of plan.owners) {
    await db.runTransaction(async (tx) => {
      const ref = db.doc(`classes/${classId}`);
      const [snapshot, owner] = await Promise.all([tx.get(ref), tx.get(db.doc(`users/${uid}`))]);
      if (!snapshot.exists || owner.data()?.role !== 'aslab' || (snapshot.data().aslabUid && snapshot.data().aslabUid !== uid)) throw new Error(`Konflik pemilik ${classId}`);
      if (!snapshot.data().aslabUid) tx.update(ref, { aslabUid: uid });
    });
    changed++;
  }
  for (const { classId, uid } of plan.assignments) {
    await db.runTransaction(async (tx) => {
      const ref = db.doc(`pengampu/${classId}~${uid}`);
      const [snapshot, user, klass] = await Promise.all([tx.get(ref), tx.get(db.doc(`users/${uid}`)), tx.get(db.doc(`classes/${classId}`))]);
      if (!klass.data()?.aslabUid || user.data()?.role !== 'asprak' || (snapshot.exists && (snapshot.data().uid !== uid || snapshot.data().classId !== classId))) throw new Error(`Konflik penugasan ${classId}~${uid}`);
      if (!snapshot.exists) tx.set(ref, { classId, uid, createdAt: timestamp() });
    });
    changed++;
  }
  return { processed: changed };
}

async function main(args) {
  const allowed = new Set(['--project', '--mapping', '--apply', '--dry-run']);
  let project, mapping = {}, apply = false, dry = false;
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (!allowed.has(flag)) throw new Error(`Opsi tidak dikenal: ${flag}`);
    if (flag === '--apply') apply = true;
    else if (flag === '--dry-run') dry = true;
    else if (flag === '--project') project = args[++i];
    else mapping = JSON.parse(await fs.readFile(args[++i], 'utf8'));
  }
  if (!project || !/^[a-z][a-z0-9-]+$/.test(project) || (apply && dry)) throw new Error('Gunakan --project ID dan pilih --dry-run (default) atau --apply.');
  if (process.env.FIRESTORE_EMULATOR_HOST && !/^(127\.0\.0\.1|localhost):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST)) throw new Error('Emulator harus lokal.');
  const { initializeApp, deleteApp } = serverRequire('firebase-admin/app');
  const { getFirestore, FieldValue } = serverRequire('firebase-admin/firestore');
  const app = initializeApp({ projectId: project });
  try {
    const db = getFirestore(app), plan = await planMigration(db, mapping);
    console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', project, plan }, null, 2));
    if (apply) console.log(JSON.stringify(await applyMigration(db, plan, () => FieldValue.serverTimestamp())));
  } finally { await deleteApp(app); }
}
module.exports = { planMigration, applyMigration };
if (require.main === module) main(process.argv.slice(2)).catch((error) => { console.error(error.message); process.exitCode = 1; });
