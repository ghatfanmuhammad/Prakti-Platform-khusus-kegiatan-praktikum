import { DAYS, type FormValues, type Kind, type Schedule } from './models';

function required(values: FormValues, key: string, label: string, max: number) {
  const value = (values[key] ?? '').trim();
  if (!value) throw new Error(`${label} wajib diisi.`);
  if (value.length > max) throw new Error(`${label} maksimal ${max} karakter.`);
  return value;
}
export function validId(id: string, maxLength = 128) {
  return typeof id === 'string' && id.length <= maxLength && /^[A-Za-z0-9_-]+$/.test(id);
}
export function participantId(classId: string, uid: string) {
  if (!validId(classId) || !validId(uid)) throw new Error('ID kelas atau UID peserta tidak valid.');
  return `${classId}_${uid}`;
}
export function validateForm(kind: Kind, values: FormValues): FormValues {
  switch (kind) {
    case 'kelas':
      return {
        kode: required(values, 'kode', 'Kode kelas', 40),
        namaPraktikum: required(values, 'namaPraktikum', 'Nama praktikum', 120),
      };
    case 'peserta': {
      const uid = required(values, 'uid', 'UID akun praktikan', 128);
      if (!validId(uid))
        throw new Error('UID hanya boleh berisi huruf, angka, tanda hubung, dan garis bawah.');
      return {
        uid,
        nama: required(values, 'nama', 'Nama peserta', 120),
        nim: required(values, 'nim', 'NIM', 40),
      };
    }
    case 'jadwal': {
      const hari = required(values, 'hari', 'Hari', 10);
      const mulai = required(values, 'mulai', 'Jam mulai', 5);
      const selesai = required(values, 'selesai', 'Jam selesai', 5);
      if (!(DAYS as readonly string[]).includes(hari)) throw new Error('Pilih hari yang valid.');
      if (![mulai, selesai].every((time) => /^([01]\d|2[0-3]):[0-5]\d$/.test(time)))
        throw new Error('Gunakan format waktu HH:mm (00:00–23:59).');
      if (selesai <= mulai)
        throw new Error('Jam selesai harus setelah jam mulai pada hari yang sama.');
      return {
        hari,
        mulai,
        selesai,
        ruangan: required(values, 'ruangan', 'Ruangan', 120),
      };
    }
    case 'sesi': {
      const tanggal = required(values, 'tanggal', 'Tanggal', 10);
      const date = new Date(`${tanggal}T00:00:00.000Z`);
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(tanggal) ||
        Number.isNaN(date.getTime()) ||
        date.toISOString().slice(0, 10) !== tanggal
      )
        throw new Error('Tanggal harus valid dengan format YYYY-MM-DD.');
      const scheduleId = required(values, 'scheduleId', 'Jadwal', 128);
      if (!validId(scheduleId)) throw new Error('Jadwal tidak valid.');
      const keterangan = (values.keterangan ?? '').trim();
      if (keterangan.length > 1000) throw new Error('Keterangan maksimal 1000 karakter.');
      return {
        scheduleId,
        tanggal,
        modul: required(values, 'modul', 'Materi / modul', 160),
        keterangan,
      };
    }
  }
}
export function assertScheduleDate(tanggal: string, schedule: Pick<Schedule, 'hari'>) {
  if (DAYS[new Date(`${tanggal}T00:00:00.000Z`).getUTCDay()] !== schedule.hari) {
    throw new Error(`Tanggal sesi harus jatuh pada hari ${schedule.hari}, sesuai jadwal.`);
  }
}
export function assertTransition(current: string, next: SessionStatusInput) {
  if (!(
    (current === 'belum_dibuka' && next === 'dibuka') ||
    (current === 'dibuka' && next === 'ditutup')
  )) {
    throw new Error('Status sesi sudah berubah. Sesi yang ditutup tidak dapat dibuka kembali.');
  }
}
type SessionStatusInput = 'dibuka' | 'ditutup';
