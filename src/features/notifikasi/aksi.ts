import type { Sesi } from '../../types';
import { periksaIzin } from '../../services/izinService';
import { kirimSesiDibuka, kirimKeputusanIzin, kirimJadwalBerubah, kirimSesiDijadwalUlang } from '../../services/notifikasiService';
import type { FormValues, Kind, PracticumRecord, PracticumSession, Schedule } from '../data-praktikum/models';
import { changeSessionStatus, saveRecord } from '../data-praktikum/repository';
import { validateForm } from '../data-praktikum/validation';
import { jadwalBerubah, sesiDijadwalUlang, type DataNotifikasi, type HasilKirim } from './pesan';

type Rute =
  | { name: 'Presensi'; params: { sesiId: string } }
  | { name: 'Schedule' | 'StatusIzin' | 'Tagihan' | 'RiwayatPembayaran'; params?: undefined };

/** Layar yang dibuka saat notifikasi diketuk; null bila data notifikasi tidak dikenal. */
export function ruteNotifikasi(data: Partial<DataNotifikasi> | undefined | null): Rute | null {
  switch (data?.jenis) {
    case 'sesi_dibuka':
      return typeof data.sesiId === 'string' ? { name: 'Presensi', params: { sesiId: data.sesiId } } : null;
    case 'jadwal_berubah':
      return { name: 'Schedule' };
    case 'keputusan_izin':
      return { name: 'StatusIzin' };
    // [SRS-029] Tagihan baru, gagal, atau tertunda perlu tindakan di layar Tagihan.
    case 'denda_baru':
    case 'pembayaran_gagal':
    case 'pembayaran_tertunda':
      return { name: 'Tagihan' };
    case 'pembayaran_berhasil':
      return { name: 'RiwayatPembayaran' };
    default:
      return null;
  }
}

// Commit first: failed writes must never send a notification.
export async function bukaSesiDenganNotifikasi(sesi: Sesi, topik: string | null) {
  if (!sesi.classId || !sesi.sessionId) throw new Error('Sesi tidak ditemukan.');
  await changeSessionStatus(sesi.classId, sesi.sessionId, 'dibuka', topik);
  return kirimSesiDibuka(sesi.classId, sesi.sessionId);
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
      return { id, notifikasi: await kirimJadwalBerubah(classId, id) };
    }
  }
  if (kind === 'sesi' && sesiDijadwalUlang(record as PracticumSession, { tanggal: values.tanggal, scheduleId: values.scheduleId })) {
    const jadwal = schedules.find((item) => item.id === values.scheduleId);
    if (jadwal) return { id, notifikasi: await kirimSesiDijadwalUlang(classId, id) };
  }
  return { id };
}

export async function periksaIzinDenganNotifikasi(
  izinId: string,
  status: 'Disetujui' | 'Ditolak',
  asisten: { uid: string; nama: string },
) {
  // Server resolves the recipient from the committed document.
  await periksaIzin(izinId, status, asisten);
  return kirimKeputusanIzin(izinId);
}
