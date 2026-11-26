const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const load = require('./helpers/load-typescript.cjs');
const roles = load(path.resolve(path.dirname(module.filename), '../src/features/auth/roles.ts'));
const filename = path.resolve(path.dirname(module.filename), '../src/services/authService.ts');
function setup({ rejected = false, storedRole = 'asprak' } = {}) {
  const calls = [];
  const user = { uid: 'stable-uid', email: 'staff@example.test' };
  const api = load(filename, {
    './firebase': { auth: {}, db: {} },
    'firebase/auth': {
      createUserWithEmailAndPassword: async (_auth, email) => { calls.push(['create', email]); return { user }; },
      deleteUser: async (account) => { calls.push(['delete', account.uid]); },
      signOut: async () => { calls.push(['signOut']); },
      signInWithEmailAndPassword: async () => ({ user }),
    },
    'firebase/firestore': {
      doc: (_db, collection, uid) => ({ collection, uid }), serverTimestamp: () => 'server-time',
      setDoc: async (_ref, data) => { if (rejected) throw Object.assign(new Error('denied'), { code: 'permission-denied' }); calls.push(['save', data]); },
      getDocFromServer: async () => ({ exists: () => true, data: () => ({ uid: user.uid, role: storedRole, name: 'Nama Lama', nimOrCode: '001' }) }),
    },
  });
  return { api, calls };
}

test('all three roles map without changing UID; unknown/legacy roles cannot become praktikan', () => {
  const { api } = setup();
  for (const role of ['aslab', 'asprak', 'praktikan']) {
    const user = api.toCurrentUser({ uid: 'same', role, name: 'Nama', nimOrCode: '123' });
    assert.equal(user.role, role); assert.equal(roles.userUid(user), 'same');
  }
  for (const role of ['asisten', 'admin', null]) assert.throws(() => api.toCurrentUser({ role }), /Peran/);
});

test('registration normalizes email and preserves the exact requested staff role; rules rejection cleans Auth account', async () => {
  for (const role of ['aslab', 'asprak', 'praktikan']) {
    const { api, calls } = setup();
    const result = await api.registerUser(' Staff@Example.Test ', 'secret', ' Nama ', role, ' 001 ');
    assert.equal(result.uid, 'stable-uid'); assert.equal(result.role, role);
    assert.deepEqual(calls[0], ['create', 'staff@example.test']);
    assert.equal(calls[1][1].role, role);
  }
  const denied = setup({ rejected: true });
  await assert.rejects(denied.api.registerUser('staff@example.test', 'secret', 'Nama', 'aslab', '001'));
  assert.deepEqual(denied.calls.at(-1), ['delete', 'stable-uid']);
});

test('legacy login requests migration while a migrated account logs in with the same UID', async () => {
  const old = setup({ storedRole: 'asisten' });
  await assert.rejects(old.api.loginUser('old@example.test', 'secret'), (error) => error.code === 'app/role-needs-migration');
  assert.deepEqual(old.calls, [['signOut']]);
  const current = await setup().api.loginUser('old@example.test', 'secret');
  assert.equal(current.role, 'asprak'); assert.equal(current.uid, 'stable-uid');
});

test('route role matrix rejects cross-role operational screens', () => {
  assert.equal(roles.canOpenRoute('aslab', 'data'), true);
  assert.equal(roles.canOpenRoute('aslab', 'izin'), false);
  assert.equal(roles.canOpenRoute('asprak', 'izin'), true);
  assert.equal(roles.canOpenRoute('asprak', 'presensi'), false);
  assert.equal(roles.canOpenRoute('praktikan', 'presensi'), true);
  assert.equal(roles.canOpenRoute('praktikan', 'rekap'), false);
  for (const role of ['aslab', 'asprak', 'praktikan']) assert.equal(roles.canOpenRoute(role, 'unknown'), false);
});
