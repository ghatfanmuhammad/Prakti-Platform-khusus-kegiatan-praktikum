const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const BULAN = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

const pad = (n: number): string => String(n).padStart(2, '0');

/** Date menjadi kunci tanggal YYYY-MM-DD (zona waktu perangkat). */
export const toDateKey = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const parseDateKey = (key: string): Date => {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
};

export const addDays = (date: Date, days: number): Date => {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
};

/** Gabungkan kunci tanggal dan jam (HH:mm atau HH:mm:ss) menjadi Date. */
export const combineDateTime = (dateKey: string, time: string): Date => {
  const [year, month, day] = dateKey.split('-').map(Number);
  const [hour, minute, second = 0] = time.split(':').map(Number);
  return new Date(year, month - 1, day, hour, minute, second);
};

/** 08:03 dari string ISO. */
export const formatJam = (iso: string): string => {
  const date = new Date(iso);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

/** 08:03:12 dari string ISO. */
export const formatJamDetik = (iso: string): string => {
  const date = new Date(iso);
  return `${formatJam(iso)}:${pad(date.getSeconds())}`;
};

/** Kamis, 22 Oktober */
export const formatTanggal = (dateKey: string): string => {
  const date = parseDateKey(dateKey);
  return `${HARI[date.getDay()]}, ${date.getDate()} ${BULAN[date.getMonth()]}`;
};

/** Hari ini, Kamis 22 Oktober / Besok, ... / Rabu 28 Oktober */
export const formatTanggalRelatif = (dateKey: string, today: Date = new Date()): string => {
  const date = parseDateKey(dateKey);
  const base = `${HARI[date.getDay()]} ${date.getDate()} ${BULAN[date.getMonth()]}`;
  if (dateKey === toDateKey(today)) return `Hari ini, ${base}`;
  if (dateKey === toDateKey(addDays(today, 1))) return `Besok, ${base}`;
  return base;
};
