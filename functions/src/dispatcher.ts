import { pesanSesiDibuka, pesanJadwalBerubah, pesanSesiDijadwalUlang, pesanKeputusanIzin } from '../../src/features/notifikasi/pesan';
import { createPushSender, type ReadDocument } from './transport';

export class NotificationError extends Error {
  constructor(public code: 'permission-denied' | 'invalid-argument' | 'not-found' | 'failed-precondition', message: string) {
    super(message);
  }
}

export async function dispatchNotification(
  uid: string | undefined,
  input: unknown,
  io: { read: ReadDocument; members: (classId: string) => Promise<string[]> },
) {
  if (!uid || (await io.read(`users/${uid}`))?.role !== 'asprak') {
    throw new NotificationError('permission-denied', 'Hanya Asprak yang dapat mengirim notifikasi.');
  }
  const data = input as Record<string, unknown> | null;
  const fields: Record<string, string[]> = {
    sesi_dibuka: ['classId', 'sessionId'], sesi_dijadwal_ulang: ['classId', 'sessionId'],
    jadwal_berubah: ['classId', 'scheduleId'], keputusan_izin: ['izinId'],
  };
  const kind = data && typeof data.jenis === 'string' ? data.jenis : '';
  const ids = Object.hasOwn(fields, kind) ? fields[kind] : undefined;
  if (!data || !ids || Object.keys(data).some((key) => key !== 'jenis' && !ids.includes(key))
    || ids.some((key) => typeof data[key] !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(data[key] as string))) {
    throw new NotificationError('invalid-argument', 'Permintaan notifikasi tidak valid.');
  }
  const required = async (path: string) => {
    const doc = await io.read(path);
    if (!doc) throw new NotificationError('not-found', 'Data notifikasi tidak ditemukan.');
    return doc;
  };
  const requireAssignment = async (classId: string) => {
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(classId)) throw new NotificationError('permission-denied', 'Kelas tidak valid.');
    const assignment = await io.read(`pengampu/${classId}~${uid}`);
    if (!assignment || assignment.classId !== classId || assignment.uid !== uid) {
      throw new NotificationError('permission-denied', 'Asprak tidak ditugaskan pada kelas ini.');
    }
  };
  const send = createPushSender(io.read, io.members);
  if (kind === 'keputusan_izin') {
    const izin = await required(`izin/${data.izinId}`);
    await requireAssignment(String(izin.sesiId ?? '').split('~')[0]);
    if (izin.reviewedByUid !== uid || (izin.status !== 'Disetujui' && izin.status !== 'Ditolak')) {
      throw new NotificationError('permission-denied', 'Keputusan izin belum tersimpan atau bukan milik asisten ini.');
    }
    return send.kirimKePengguna([String(izin.praktikanId)], pesanKeputusanIzin({
      id: String(data.izinId), status: izin.status, sesiNama: String(izin.sesiNama), reviewedBy: String(izin.reviewedBy),
    }));
  }
  const classId = String(data.classId);
  await requireAssignment(classId);
  const kelas = await required(`classes/${classId}`);
  const ringkas = { id: classId, namaPraktikum: String(kelas.namaPraktikum), kode: String(kelas.kode) };
  if (kind === 'jadwal_berubah') {
    const jadwal = await required(`classes/${classId}/schedules/${data.scheduleId}`);
    return send.kirimKeKelas(classId, pesanJadwalBerubah(ringkas, {
      hari: String(jadwal.hari), mulai: String(jadwal.mulai), selesai: String(jadwal.selesai), ruangan: String(jadwal.ruangan),
    }));
  }
  const sesi = await required(`classes/${classId}/sessions/${data.sessionId}`);
  if (kind === 'sesi_dibuka' && (sesi.asistenId !== uid || sesi.status !== 'dibuka')) {
    throw new NotificationError('permission-denied', 'Sesi belum dibuka atau diampu asisten lain.');
  }
  if (kind === 'sesi_dijadwal_ulang' && sesi.status !== 'belum_dibuka') {
    throw new NotificationError('failed-precondition', 'Hanya rencana sesi yang dapat diubah.');
  }
  const jadwal = await required(`classes/${classId}/schedules/${sesi.scheduleId}`);
  const waktu = { hari: String(jadwal.hari), mulai: String(jadwal.mulai), selesai: String(jadwal.selesai), ruangan: String(jadwal.ruangan) };
  const isi = kind === 'sesi_dibuka' ? pesanSesiDibuka({
    id: `${classId}~${data.sessionId}`, praktikum: ringkas.namaPraktikum, kelas: ringkas.kode,
    tanggal: String(sesi.tanggal), mulai: waktu.mulai, selesai: waktu.selesai, ruang: waktu.ruangan,
    modul: String(sesi.modul), topik: typeof sesi.topik === 'string' ? sesi.topik : null,
  }) : pesanSesiDijadwalUlang(ringkas, { modul: String(sesi.modul), tanggal: String(sesi.tanggal) }, waktu);
  return send.kirimKeKelas(classId, isi);
}
