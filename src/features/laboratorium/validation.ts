import {
  NOMINAL_DENDA_MIN,
  RADIUS_MAX,
  RADIUS_MIN,
  TOLERANSI_MAX,
  TOLERANSI_MIN,
  type LabFormValues,
  type LabPraktikumFormValues,
} from './models';

/** Mengubah "-7,0511" atau "-7.0511" menjadi angka; NaN bila tidak valid. */
export function parseAngka(teks: string): number {
  const bersih = teks.trim().replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(bersih)) return NaN;
  return Number(bersih);
}

function parseBilanganBulat(teks: string): number {
  const bersih = teks.trim();
  if (!/^-?\d+$/.test(bersih)) return NaN;
  return Number(bersih);
}

export interface LabInput {
  nama: string;
  lat: number;
  lng: number;
  radiusMeter: number;
}

export interface LabPraktikumInput {
  kode: string;
  namaLab: string;
  namaPraktikum: string;
  lokasi: string;
  lat: number;
  lng: number;
  radiusMeter: number;
  toleransiMenit: number;
  nominalDenda: number;
}

/** Validasi ruang fisik laboratorium. Mengembalikan daftar pesan error (kosong jika valid). */
export function collectPhysicalLabErrors(values: LabFormValues): string[] {
  const errors: string[] = [];
  const nama = values.nama.trim();
  if (!nama) errors.push('Nama lokasi laboratorium wajib diisi.');
  else if (nama.length > 80) errors.push('Nama lokasi laboratorium maksimal 80 karakter.');

  const lat = parseAngka(values.lat);
  const lng = parseAngka(values.lng);
  if (Number.isNaN(lat) || lat < -90 || lat > 90)
    errors.push('Latitude harus berupa angka antara -90 dan 90.');
  if (Number.isNaN(lng) || lng < -180 || lng > 180)
    errors.push('Longitude harus berupa angka antara -180 dan 180.');

  const radiusMeter = parseAngka(values.radiusMeter);
  if (Number.isNaN(radiusMeter) || radiusMeter < RADIUS_MIN || radiusMeter > RADIUS_MAX)
    errors.push(`Radius harus antara ${RADIUS_MIN} dan ${RADIUS_MAX} meter.`);

  return errors;
}

/** Validasi form lab fisik. Melempar Error berpesan ramah bila ada yang tidak valid. */
export function validateLab(values: LabFormValues): LabInput {
  const errors = collectPhysicalLabErrors(values);
  if (errors.length > 0) throw new Error(errors[0]);
  return {
    nama: values.nama.trim(),
    lat: parseAngka(values.lat),
    lng: parseAngka(values.lng),
    radiusMeter: Math.round(parseAngka(values.radiusMeter)),
  };
}

/** Validasi lengkap Lab & kebijakan presensi (SRS-020 / SRS-021). Mengembalikan semua error per field. */
export function collectLabPraktikumErrors(values: LabPraktikumFormValues): string[] {
  const errors: string[] = [];
  const kode = values.kode.trim();
  const namaLab = values.namaLab.trim();
  const namaPraktikum = values.namaPraktikum.trim();

  if (!kode) errors.push('Kode Lab wajib diisi.');
  else if (kode.length > 40) errors.push('Kode Lab maksimal 40 karakter.');

  if (!namaLab) errors.push('Nama Lab wajib diisi.');
  else if (namaLab.length > 120) errors.push('Nama Lab maksimal 120 karakter.');

  if (!namaPraktikum) errors.push('Mata kuliah wajib diisi.');
  else if (namaPraktikum.length > 120) errors.push('Mata kuliah maksimal 120 karakter.');

  errors.push(
    ...collectPhysicalLabErrors({
      nama: values.lokasi,
      lat: values.lat,
      lng: values.lng,
      radiusMeter: values.radiusMeter,
    }),
  );

  const toleransi = parseBilanganBulat(values.toleransiMenit);
  if (Number.isNaN(toleransi) || toleransi < TOLERANSI_MIN || toleransi > TOLERANSI_MAX) {
    errors.push(`Toleransi keterlambatan harus bilangan bulat ${TOLERANSI_MIN}–${TOLERANSI_MAX} menit.`);
  }

  const nominal = parseBilanganBulat(values.nominalDenda);
  if (Number.isNaN(nominal) || nominal < NOMINAL_DENDA_MIN) {
    errors.push('Nominal denda harus bilangan bulat lebih dari 0.');
  }

  return errors;
}

/** Validasi Lab & kebijakan presensi (SRS-020). Melempar Error bila tidak valid. */
export function validateLabPraktikum(values: LabPraktikumFormValues): LabPraktikumInput {
  const errors = collectLabPraktikumErrors(values);
  if (errors.length > 0) throw new Error(errors[0]);

  return {
    kode: values.kode.trim(),
    namaLab: values.namaLab.trim(),
    namaPraktikum: values.namaPraktikum.trim(),
    lokasi: values.lokasi.trim(),
    lat: parseAngka(values.lat),
    lng: parseAngka(values.lng),
    radiusMeter: Math.round(parseAngka(values.radiusMeter)),
    toleransiMenit: parseBilanganBulat(values.toleransiMenit),
    nominalDenda: parseBilanganBulat(values.nominalDenda),
  };
}
