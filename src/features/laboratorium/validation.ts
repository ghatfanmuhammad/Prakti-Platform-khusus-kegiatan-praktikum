import { RADIUS_MAX, RADIUS_MIN, type LabFormValues } from './models';

/** Mengubah "-7,0511" atau "-7.0511" menjadi angka; NaN bila tidak valid. */
function parseAngka(teks: string): number {
  const bersih = teks.trim().replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(bersih)) return NaN;
  return Number(bersih);
}

export interface LabInput {
  nama: string;
  latitude: number;
  longitude: number;
  radiusMeter: number;
}

/** Validasi form lab. Melempar Error berpesan ramah bila ada yang tidak valid. */
export function validateLab(values: LabFormValues): LabInput {
  const nama = values.nama.trim();
  if (!nama) throw new Error('Nama laboratorium wajib diisi.');
  if (nama.length > 80) throw new Error('Nama laboratorium maksimal 80 karakter.');

  const latitude = parseAngka(values.latitude);
  const longitude = parseAngka(values.longitude);
  if (Number.isNaN(latitude) || latitude < -90 || latitude > 90)
    throw new Error('Latitude harus berupa angka antara -90 dan 90.');
  if (Number.isNaN(longitude) || longitude < -180 || longitude > 180)
    throw new Error('Longitude harus berupa angka antara -180 dan 180.');

  const radiusMeter = parseAngka(values.radiusMeter);
  if (Number.isNaN(radiusMeter) || radiusMeter < RADIUS_MIN || radiusMeter > RADIUS_MAX)
    throw new Error(`Radius harus antara ${RADIUS_MIN} dan ${RADIUS_MAX} meter.`);

  return { nama, latitude, longitude, radiusMeter: Math.round(radiusMeter) };
}