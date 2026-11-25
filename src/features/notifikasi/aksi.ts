import type { Sesi } from '../../types';
import { periksaIzin } from '../../services/izinService';
import { kirimKeKelas, kirimKePengguna, kirimJadwalBerubah, kirimSesiDijadwalUlang } from '../../services/notifikasiService';
import type { FormValues, Kind, PracticumRecord, PracticumSession, Schedule } from '../data-praktikum/models';
import { changeSessionStatus, saveRecord } from '../data-praktikum/repository';
import { validateForm } from '../data-praktikum/validation';
import { jadwalBerubah, pesanKeputusanIzin, pesanSesiDibuka, sesiDijadwalUlang, type HasilKirim } from './pesan';

// Commit first: failed writes must never send a notification.
export async function bukaSesiDenganNotifikasi(sesi: Sesi, topik: string | null) {
  if (!sesi.classId || !sesi.sessionId) throw new Error('Sesi tidak ditemukan.');
  await changeSessionStatus(sesi.classId, sesi.sessionId, 'dibuka', topik);
  return kirimKeKelas(sesi.classId, pesanSesiDibuka({ ...sesi, topik }));
}

export async function simpanDenganNotifikasi(
  editor: { kind: Kind; classId: string | null; record: PracticumRecord | null },
  input: FormValues,
  schedules: Schedule[],
): Promise<{ id: string; notifikasi?: HasilKirim }> {
  const { kind, classId, record } = editor;
  const id = await saveRecord(kind, classId, record?.id ?? null, input);
  if (!record || !classId) return { id };
  const values = validateForm(kind, input);
  if (kind === 'jadwal') {
    const jadwal = { hari: values.hari, mulai: values.mulai, selesai: values.selesai, ruangan: values.ruangan, labId: values.labId ?? (record as Schedule).labId };
    if (jadwalBerubah(record as Schedule, jadwal)) {
      return { id, notifikasi: await kirimJadwalBerubah(classId, jadwal) };
    }
  }
  if (kind === 'sesi' && sesiDijadwalUlang(record as PracticumSession, { tanggal: values.tanggal, scheduleId: values.scheduleId })) {
    const jadwal = schedules.find((item) => item.id === values.scheduleId);
    if (jadwal) return { id, notifikasi: await kirimSesiDijadwalUlang(classId, { modul: values.modul, tanggal: values.tanggal }, jadwal) };
  }
  return { id };
}

export async function periksaIzinDenganNotifikasi(
  izinId: string,
  status: 'Disetujui' | 'Ditolak',
  asisten: { uid: string; nama: string },
) {
  // Recipient comes from the committed transaction, not a potentially stale UI selection.
  const izin = await periksaIzin(izinId, status, asisten);
  return kirimKePengguna([izin.praktikanId], pesanKeputusanIzin(izin));
}
