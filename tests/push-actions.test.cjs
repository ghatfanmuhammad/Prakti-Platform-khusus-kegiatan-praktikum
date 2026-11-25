const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const load = require('./helpers/load-typescript.cjs');
const filename = path.resolve(__dirname, '../src/features/notifikasi/aksi.ts');
const sesi = { id: 'own~s1', classId: 'own', sessionId: 's1', praktikum: 'Basis Data', kelas: 'A', ruang: 'Lab 1', mulai: '08:00', selesai: '10:00', topik: null };
function setup(failed = false) {
  const calls = [];
  const commit = async () => { calls.push('commit'); if (failed) throw new Error('write failed'); return 'saved'; };
  const result = { penerima: 1, terkirim: 1, tanpaToken: 0, gagal: 0 };
  const send = (kind) => async (...args) => { calls.push([kind, ...args]); return result; };
  const api = load(filename, {
    '../data-praktikum/repository': { changeSessionStatus: commit, saveRecord: commit },
    '../../services/izinService': { periksaIzin: async (id, status, asisten) => {
      await commit(); return { id, status, praktikanId: 'canonical-owner', sesiNama: 'Basis Data', reviewedBy: asisten.nama };
    } },
    '../../services/notifikasiService': {
      kirimKeKelas: send('class'), kirimKePengguna: send('owner'),
      kirimJadwalBerubah: send('schedule'), kirimSesiDijadwalUlang: send('reschedule'),
    },
  });
  return { api, calls };
}

test('opening a session sends to its class only after commit; failed commit sends nothing', async () => {
  const { api, calls } = setup();
  await api.bukaSesiDenganNotifikasi(sesi, null);
  assert.equal(calls[0], 'commit'); assert.equal(calls[1][0], 'class'); assert.equal(calls[1][1], 'own');
  const failed = setup(true);
  await assert.rejects(failed.api.bukaSesiDenganNotifikasi(sesi, null), /write failed/);
  assert.deepEqual(failed.calls, ['commit']);
});

for (const status of ['Disetujui', 'Ditolak']) test(`${status} notifies only canonical applicant after commit`, async () => {
  const { api, calls } = setup();
  await api.periksaIzinDenganNotifikasi('permit', status, { uid: 'assistant', nama: 'Asisten' });
  assert.equal(calls[0], 'commit');
  assert.deepEqual(calls[1][1], ['canonical-owner']);
  assert.equal(calls[1][2].title, status === 'Disetujui' ? 'Izin disetujui' : 'Izin ditolak');
  const failed = setup(true);
  await assert.rejects(failed.api.periksaIzinDenganNotifikasi('permit', status, { uid: 'assistant', nama: 'Asisten' }));
  assert.deepEqual(failed.calls, ['commit']);
});

test('room/lab schedule change notifies the correct class; no-op and creation send nothing', async () => {
  const { api, calls } = setup();
  const before = { id: 'j1', hari: 'Kamis', mulai: '08:00', selesai: '10:00', ruangan: 'Lab 1', labId: 'lab-1' };
  const editor = { kind: 'jadwal', classId: 'own', record: before };
  await api.simpanDenganNotifikasi(editor, { ...before, labId: 'lab-2' }, []);
  assert.equal(calls[0], 'commit'); assert.equal(calls[1][0], 'schedule'); assert.equal(calls[1][1], 'own');
  calls.length = 0;
  await api.simpanDenganNotifikasi(editor, before, []);
  await api.simpanDenganNotifikasi({ ...editor, record: null }, before, []);
  assert.deepEqual(calls, ['commit', 'commit']);
  const failed = setup(true);
  await assert.rejects(failed.api.simpanDenganNotifikasi(editor, { ...before, ruangan: 'Lab 2' }, []));
  assert.deepEqual(failed.calls, ['commit']);
});
