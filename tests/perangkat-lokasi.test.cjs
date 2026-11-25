const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const load = require('./helpers/load-typescript.cjs');
const filename = path.resolve(__dirname, '../src/features/presensi/perangkatLokasi.ts');

test('denied location permission never requests GPS, including permanent denial', async () => {
  for (const canAskAgain of [true, false]) {
    let prompts = 0;
    const { ambilPosisi } = load(filename, { 'expo-location': {
      getForegroundPermissionsAsync: async () => ({ granted: false, canAskAgain }),
      requestForegroundPermissionsAsync: async () => { prompts++; return { granted: false, canAskAgain }; },
      hasServicesEnabledAsync: async () => { assert.fail('GPS must not be accessed'); },
    } });
    assert.deepEqual(await ambilPosisi(), { ok: false, hasil: { jenis: 'izin_ditolak', bisaMintaLagi: canAskAgain } });
    assert.equal(prompts, canAskAgain ? 1 : 0);
  }
});

test('disabled GPS returns an actionable state without acquiring a position', async () => {
  const { ambilPosisi } = load(filename, { 'expo-location': {
    getForegroundPermissionsAsync: async () => ({ granted: true }),
    hasServicesEnabledAsync: async () => false,
    getCurrentPositionAsync: async () => { assert.fail('GPS is disabled'); },
  } });
  assert.deepEqual(await ambilPosisi(), { ok: false, hasil: { jenis: 'layanan_mati' } });
});
