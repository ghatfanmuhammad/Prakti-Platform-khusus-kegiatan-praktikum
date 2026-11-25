const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const load = require('./helpers/load-typescript.cjs');
const registration = path.resolve(__dirname, '../src/features/notifikasi/registrasiPush.ts');

function perangkat(permission, { os = 'android', request = permission, storeClient = false } = {}) {
  const calls = [];
  const { daftarkanPerangkat } = load(registration, {
    'react-native': { Platform: { OS: os } },
    'expo-constants': { __esModule: true, default: {
      expoConfig: { extra: { eas: { projectId: 'test-project' } } },
      executionEnvironment: storeClient ? 'storeClient' : 'standalone',
    }, ExecutionEnvironment: { StoreClient: 'storeClient' } },
    'expo-notifications': {
      AndroidImportance: { HIGH: 4 }, IosAuthorizationStatus: { PROVISIONAL: 3 },
      setNotificationChannelAsync: async () => { calls.push('channel'); },
      getPermissionsAsync: async () => { calls.push('permission'); return permission; },
      requestPermissionsAsync: async () => { calls.push('prompt'); return request; },
      getExpoPushTokenAsync: async () => { calls.push('token'); return { data: 'ExpoPushToken[device]' }; },
    },
  });
  return { daftarkanPerangkat, calls };
}

test('denied notification permission returns nonfatal status and never obtains a token', async () => {
  for (const canAskAgain of [true, false]) {
    const device = perangkat({ granted: false, canAskAgain });
    assert.deepEqual(await device.daftarkanPerangkat(), { kind: 'izin_ditolak', bisaDimintaLagi: canAskAgain });
    assert.deepEqual(device.calls, ['channel', 'permission', ...(canAskAgain ? ['prompt'] : [])]);
  }
});

test('resume checks permissions without prompting; Android channel precedes granted token registration', async () => {
  const denied = perangkat({ granted: false, canAskAgain: true });
  await denied.daftarkanPerangkat(false);
  assert.deepEqual(denied.calls, ['channel', 'permission']);
  const granted = perangkat({ granted: true });
  assert.deepEqual(await granted.daftarkanPerangkat(), { kind: 'aktif', token: 'ExpoPushToken[device]' });
  assert.deepEqual(granted.calls, ['channel', 'permission', 'token']);
});

test('web and Android Expo Go never invoke unsupported notification APIs; iOS provisional permission works', async () => {
  for (const options of [{ os: 'web' }, { storeClient: true }]) {
    const device = perangkat({}, options);
    assert.equal((await device.daftarkanPerangkat()).kind, 'tidak_didukung');
    assert.deepEqual(device.calls, []);
  }
  const device = perangkat({ granted: false, canAskAgain: false, ios: { status: 3 } }, { os: 'ios' });
  assert.equal((await device.daftarkanPerangkat()).kind, 'aktif');
});

test('permission revocation after app restart deletes only this persisted device token; late registration cannot save', async () => {
  const storage = new Map();
  const writes = [], deletes = [];
  let status = { kind: 'aktif', token: 'ExpoPushToken[this-device]' };
  const adapters = {
    '@react-native-async-storage/async-storage': {
      getItem: async (key) => storage.get(key) ?? null,
      setItem: async (key, value) => { storage.set(key, value); },
      removeItem: async (key) => { storage.delete(key); },
    },
    './registrasiPush': { daftarkanPerangkat: async () => status },
    '../../services/notifikasiService': {
      simpanTokenPerangkat: async (...args) => { writes.push(args); },
      hapusTokenPerangkat: async (...args) => { deletes.push(args); },
    },
  };
  const filename = path.resolve(__dirname, '../src/features/notifikasi/sinkronisasiPush.ts');
  await load(filename, adapters).sinkronkanPerangkat('student', 'android', true, () => true);
  assert.deepEqual(writes, [['student', 'ExpoPushToken[this-device]', 'android']]);
  status = { kind: 'izin_ditolak', bisaDimintaLagi: false };
  const restarted = load(filename, adapters);
  assert.deepEqual(await restarted.sinkronkanPerangkat('student', 'android', false, () => true), status);
  assert.deepEqual(deletes, [['student', 'ExpoPushToken[this-device]']]);
  assert.equal(storage.size, 0);
  status = { kind: 'aktif', token: 'ExpoPushToken[late]' };
  await restarted.sinkronkanPerangkat('student', 'android', true, () => false);
  assert.equal(writes.length, 1);
  assert.equal(storage.size, 0);
});
