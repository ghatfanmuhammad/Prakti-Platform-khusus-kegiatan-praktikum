import type { Role } from '../../types';
import type { LabPraktikumFormValues } from '../laboratorium/models';
import { collectLabPraktikumErrors } from '../laboratorium/validation';
import type { CsvRow } from './csv';
import type { Revalidator } from './review';

export interface AkunPenggunaRingkas {
  uid: string;
  email: string;
  name: string;
  role: Role;
  nimOrCode: string;
}

export interface BarisLabImpor extends LabPraktikumFormValues {
  /** Disimpan dari CSV atau form edit; semua baris diikat ke satu mata kuliah aktif. */
  namaPraktikum: string;
}

export interface BarisPraktikanImpor {
  nim: string;
  email: string;
  nama: string;
  matchedUid?: string;
  matchedNama?: string;
  matchedNim?: string;
  matchedEmail?: string;
}

export interface BarisAsprakImpor {
  email: string;
  kodeAsprak: string;
  nama: string;
  matchedUid?: string;
  matchedNama?: string;
  matchedKode?: string;
  matchedEmail?: string;
}

const norm = (value: string) => value.trim().toLowerCase();

function ambilKolom(raw: Record<string, string>, candidates: string[]): string {
  for (const key of candidates) {
    if (raw[key] !== undefined && raw[key] !== '') return raw[key].trim();
  }
  return '';
}

/** Mengonversi baris CSV menjadi bentuk awal baris Lab (terikat pada satu mata kuliah). */
export function petakanCsvLab(rows: CsvRow[], mataKuliah: string): { id: string; nomorBaris: number; data: BarisLabImpor }[] {
  return rows.map((row) => ({
    id: `lab-${row.lineNumber}`,
    nomorBaris: row.lineNumber,
    data: {
      kode: ambilKolom(row.raw, ['kode', 'kode_lab', 'kode_kelas']),
      namaLab: ambilKolom(row.raw, ['nama_lab', 'namalab', 'nama']),
      namaPraktikum: mataKuliah.trim(),
      lokasi: ambilKolom(row.raw, ['lokasi', 'ruangan', 'nama_lokasi']),
      lat: ambilKolom(row.raw, ['latitude', 'lat']),
      lng: ambilKolom(row.raw, ['longitude', 'lng', 'lon']),
      radiusMeter: ambilKolom(row.raw, ['radius_meter', 'radius', 'radiusmeter']),
      toleransiMenit: ambilKolom(row.raw, ['toleransi_menit', 'toleransi', 'toleransimenit']),
      nominalDenda: ambilKolom(row.raw, ['nominal_denda', 'denda', 'nominaldenda', 'nominal']),
    },
  }));
}

/**
 * Revalidator untuk baris impor Lab (SRS-021):
 * - Memeriksa seluruh aturan field Lab (radius 10–1000, toleransi 0–120, nominal > 0, mata kuliah).
 * - Menandai duplikat kode/nama Lab antar-baris atau yang sudah ada.
 */
export function buatRevalidatorLab(
  mataKuliah: string,
  existingLabs: { kode: string; namaLab: string; namaPraktikum: string }[] = [],
): Revalidator<BarisLabImpor> {
  return (items) => {
    const errors = new Map<string, string[]>();
    const seenKode = new Map<string, number>();
    const seenNama = new Map<string, number>();
    const existingKodes = new Set(existingLabs.map((l) => norm(l.kode)).filter(Boolean));
    const existingNames = new Set(
      existingLabs
        .filter((l) => norm(l.namaPraktikum) === norm(mataKuliah))
        .map((l) => norm(l.namaLab))
        .filter(Boolean),
    );

    for (const item of items) {
      const bound: LabPraktikumFormValues = {
        ...item.data,
        namaPraktikum: mataKuliah.trim() || item.data.namaPraktikum,
      };
      const rowErrors = collectLabPraktikumErrors(bound);
      const kodeNorm = norm(bound.kode);
      const namaNorm = norm(bound.namaLab);

      if (kodeNorm) {
        if (existingKodes.has(kodeNorm)) {
          rowErrors.push(`Kode Lab "${bound.kode.trim()}" sudah terdaftar.`);
        } else if (seenKode.has(kodeNorm)) {
          rowErrors.push(`Kode Lab duplikat dengan baris #${seenKode.get(kodeNorm)}.`);
        } else {
          seenKode.set(kodeNorm, item.nomorBaris);
        }
      }

      if (namaNorm) {
        if (existingNames.has(namaNorm)) {
          rowErrors.push(`Nama Lab "${bound.namaLab.trim()}" sudah ada di mata kuliah ini.`);
        } else if (seenNama.has(namaNorm)) {
          rowErrors.push(`Nama Lab duplikat dengan baris #${seenNama.get(namaNorm)}.`);
        } else {
          seenNama.set(namaNorm, item.nomorBaris);
        }
      }

      errors.set(item.id, rowErrors);
    }
    return errors;
  };
}

export function petakanCsvPraktikan(rows: CsvRow[]): { id: string; nomorBaris: number; data: BarisPraktikanImpor }[] {
  return rows.map((row) => ({
    id: `mhs-${row.lineNumber}`,
    nomorBaris: row.lineNumber,
    data: {
      nim: ambilKolom(row.raw, ['nim', 'nim_praktikan']),
      email: ambilKolom(row.raw, ['email', 'email_praktikan']),
      nama: ambilKolom(row.raw, ['nama', 'nama_praktikan', 'nama_lengkap']),
    },
  }));
}

/** Mencocokkan satu input praktikan (NIM dan/atau email) ke daftar pengguna terdaftar. */
export function cariAkunPraktikan(
  nim: string,
  email: string,
  users: AkunPenggunaRingkas[],
): { akun: AkunPenggunaRingkas | null; error?: string } {
  const nimBersih = norm(nim);
  const emailBersih = norm(email);
  if (!nimBersih && !emailBersih) {
    return { akun: null, error: 'Isi NIM atau email praktikan.' };
  }

  const byNim = nimBersih
    ? users.find((u) => norm(u.nimOrCode) === nimBersih && u.role === 'praktikan') ??
      users.find((u) => norm(u.nimOrCode) === nimBersih)
    : undefined;
  const byEmail = emailBersih ? users.find((u) => norm(u.email) === emailBersih) : undefined;

  if (nimBersih && emailBersih && byNim && byEmail && byNim.uid !== byEmail.uid) {
    return { akun: null, error: 'NIM dan email merujuk ke dua akun yang berbeda.' };
  }

  const matched = byEmail ?? byNim ?? null;
  if (!matched) {
    return { akun: null, error: 'Akun praktikan belum terdaftar di sistem.' };
  }
  if (matched.role !== 'praktikan') {
    return { akun: null, error: `Akun terdaftar sebagai ${matched.role}, bukan praktikan.` };
  }
  return { akun: matched };
}

/** Melengkapi field hasil pencocokan tanpa memutasi objek asal. */
export function lengkapiPraktikan(
  data: BarisPraktikanImpor,
  users: AkunPenggunaRingkas[],
): BarisPraktikanImpor {
  const { akun } = cariAkunPraktikan(data.nim, data.email, users);
  if (!akun) {
    return {
      nim: data.nim,
      email: data.email,
      nama: data.nama,
    };
  }
  return {
    ...data,
    matchedUid: akun.uid,
    matchedNama: data.nama.trim() || akun.name,
    matchedNim: akun.nimOrCode,
    matchedEmail: akun.email,
  };
}

/**
 * Revalidator untuk impor praktikan (SRS-022):
 * - Mencocokkan lewat NIM atau email.
 * - Menandai akun yang belum terdaftar atau bukan praktikan.
 * - Menandai duplikat di file CSV dan duplikat di Lab tujuan.
 */
export function buatRevalidatorPraktikan(
  users: AkunPenggunaRingkas[],
  existingParticipantUids: Set<string>,
): Revalidator<BarisPraktikanImpor> {
  return (items) => {
    const errors = new Map<string, string[]>();
    const seenUid = new Map<string, number>();
    const seenIdent = new Map<string, number>();

    for (const item of items) {
      const rowErrors: string[] = [];
      const { akun, error } = cariAkunPraktikan(item.data.nim, item.data.email, users);
      if (error) rowErrors.push(error);

      if (akun) {
        if (existingParticipantUids.has(akun.uid)) {
          rowErrors.push('Praktikan sudah terdaftar di Lab ini.');
        } else if (seenUid.has(akun.uid)) {
          rowErrors.push(`Data duplikat dalam file impor (sama dengan baris #${seenUid.get(akun.uid)}).`);
        } else {
          seenUid.set(akun.uid, item.nomorBaris);
        }
      } else {
        const key = norm(item.data.email) || norm(item.data.nim);
        if (key) {
          if (seenIdent.has(key)) {
            rowErrors.push(`Data duplikat dalam file impor (sama dengan baris #${seenIdent.get(key)}).`);
          } else {
            seenIdent.set(key, item.nomorBaris);
          }
        }
      }

      errors.set(item.id, rowErrors);
    }

    return errors;
  };
}

export function petakanCsvAsprak(rows: CsvRow[]): { id: string; nomorBaris: number; data: BarisAsprakImpor }[] {
  return rows.map((row) => ({
    id: `asprak-${row.lineNumber}`,
    nomorBaris: row.lineNumber,
    data: {
      email: ambilKolom(row.raw, ['email', 'email_asprak']),
      kodeAsprak: ambilKolom(row.raw, ['kode_asprak', 'kode', 'kodeasprak']),
      nama: ambilKolom(row.raw, ['nama', 'nama_asprak', 'nama_lengkap']),
    },
  }));
}

/** Mencocokkan satu input Asprak (email atau kode) ke daftar pengguna terdaftar berperan `asprak`. */
export function cariAkunAsprak(
  email: string,
  kodeAsprak: string,
  users: AkunPenggunaRingkas[],
): { akun: AkunPenggunaRingkas | null; error?: string } {
  const emailBersih = norm(email);
  const kodeBersih = norm(kodeAsprak);
  if (!emailBersih && !kodeBersih) {
    return { akun: null, error: 'Isi email atau kode Asprak.' };
  }

  const byEmail = emailBersih ? users.find((u) => norm(u.email) === emailBersih) : undefined;
  const byKode = kodeBersih
    ? users.find((u) => norm(u.nimOrCode) === kodeBersih && u.role === 'asprak') ??
      users.find((u) => norm(u.nimOrCode) === kodeBersih)
    : undefined;

  if (emailBersih && kodeBersih && byEmail && byKode && byEmail.uid !== byKode.uid) {
    return { akun: null, error: 'Email dan kode Asprak merujuk ke dua akun yang berbeda.' };
  }

  const matched = byEmail ?? byKode ?? null;
  if (!matched) {
    return { akun: null, error: 'Akun Asprak belum terdaftar di sistem.' };
  }
  if (matched.role !== 'asprak') {
    return { akun: null, error: `Hanya akun berperan Asprak yang bisa ditugaskan (peran akun: ${matched.role}).` };
  }
  return { akun: matched };
}

/** Melengkapi field hasil pencocokan Asprak tanpa memutasi objek asal. */
export function lengkapiAsprak(
  data: BarisAsprakImpor,
  users: AkunPenggunaRingkas[],
): BarisAsprakImpor {
  const { akun } = cariAkunAsprak(data.email, data.kodeAsprak, users);
  if (!akun) {
    return {
      email: data.email,
      kodeAsprak: data.kodeAsprak,
      nama: data.nama,
    };
  }
  return {
    ...data,
    matchedUid: akun.uid,
    matchedNama: data.nama.trim() || akun.name,
    matchedKode: akun.nimOrCode,
    matchedEmail: akun.email,
  };
}

/**
 * Revalidator untuk impor Asprak (SRS-023):
 * - Hanya akun berperan `asprak` yang dapat ditugaskan.
 * - Menandai akun tidak terdaftar dan duplikat.
 */
export function buatRevalidatorAsprak(
  users: AkunPenggunaRingkas[],
  existingPengampuUids: Set<string>,
): Revalidator<BarisAsprakImpor> {
  return (items) => {
    const errors = new Map<string, string[]>();
    const seenUid = new Map<string, number>();
    const seenIdent = new Map<string, number>();

    for (const item of items) {
      const rowErrors: string[] = [];
      const { akun, error } = cariAkunAsprak(item.data.email, item.data.kodeAsprak, users);
      if (error) rowErrors.push(error);

      if (akun) {
        if (existingPengampuUids.has(akun.uid)) {
          rowErrors.push('Asprak sudah ditugaskan di Lab ini.');
        } else if (seenUid.has(akun.uid)) {
          rowErrors.push(`Data duplikat dalam file impor (sama dengan baris #${seenUid.get(akun.uid)}).`);
        } else {
          seenUid.set(akun.uid, item.nomorBaris);
        }
      } else {
        const key = norm(item.data.email) || norm(item.data.kodeAsprak);
        if (key) {
          if (seenIdent.has(key)) {
            rowErrors.push(`Data duplikat dalam file impor (sama dengan baris #${seenIdent.get(key)}).`);
          } else {
            seenIdent.set(key, item.nomorBaris);
          }
        }
      }

      errors.set(item.id, rowErrors);
    }

    return errors;
  };
}
