export type StatusTinjauan = 'diterima' | 'ditolak';

export interface BarisTinjauan<T> {
  id: string;
  nomorBaris: number;
  data: T;
  status: StatusTinjauan;
  /** Kesalahan validasi/pencocokan per baris. Kosong berarti valid. */
  errors: string[];
}

export interface RingkasanTinjauan {
  total: number;
  valid: number;
  bermasalah: number;
  diterima: number;
  ditolak: number;
  siapSimpan: number;
}

export interface HasilSimpanMassal {
  berhasil: number;
  gagal: number;
  dilewati: number;
  galatBaris: { nomorBaris: number; pesan: string }[];
}

export type Revalidator<T> = (items: { id: string; nomorBaris: number; data: T }[]) => Map<string, string[]>;

/** Membuat daftar baris tinjauan awal. Baris valid otomatis diterima, baris bermasalah tetap ditandai. */
export function buatBarisTinjauan<T>(
  items: { id: string; nomorBaris: number; data: T }[],
  revalidator: Revalidator<T>,
): BarisTinjauan<T>[] {
  const errorMap = revalidator(items);
  return items.map((item) => {
    const errors = errorMap.get(item.id) ?? [];
    return {
      id: item.id,
      nomorBaris: item.nomorBaris,
      data: item.data,
      status: errors.length === 0 ? 'diterima' : 'ditolak',
      errors,
    };
  });
}

/** Menyetujui satu baris (tetap tidak akan disimpan bila masih punya error sampai dilengkapi). */
export function terimaBaris<T>(rows: BarisTinjauan<T>[], id: string): BarisTinjauan<T>[] {
  return rows.map((row) => (row.id === id ? { ...row, status: 'diterima' } : row));
}

/** Menolak satu baris agar tidak ikut disimpan. */
export function tolakBaris<T>(rows: BarisTinjauan<T>[], id: string): BarisTinjauan<T>[] {
  return rows.map((row) => (row.id === id ? { ...row, status: 'ditolak' } : row));
}

/** Mengubah status terima/tolak pada satu baris. */
export function toggleStatusBaris<T>(rows: BarisTinjauan<T>[], id: string): BarisTinjauan<T>[] {
  return rows.map((row) =>
    row.id === id
      ? { ...row, status: row.status === 'diterima' ? 'ditolak' : 'diterima' }
      : row,
  );
}

/** Menyetujui seluruh baris yang tidak memiliki kesalahan. */
export function terimaSemuaValid<T>(rows: BarisTinjauan<T>[]): BarisTinjauan<T>[] {
  return rows.map((row) => (row.errors.length === 0 ? { ...row, status: 'diterima' } : row));
}

/** Menolak seluruh baris. */
export function tolakSemua<T>(rows: BarisTinjauan<T>[]): BarisTinjauan<T>[] {
  return rows.map((row) => ({ ...row, status: 'ditolak' }));
}

/**
 * Mengubah / melengkapi data satu baris lalu memvalidasi ulang seluruh baris
 * (agar pengecekan duplikat antar-baris ikut diperbarui).
 */
export function ubahBaris<T>(
  rows: BarisTinjauan<T>[],
  id: string,
  nextData: T,
  revalidator: Revalidator<T>,
  autoAcceptIfValid = true,
): BarisTinjauan<T>[] {
  const updated = rows.map((row) => (row.id === id ? { ...row, data: nextData } : row));
  const errorMap = revalidator(updated.map((r) => ({ id: r.id, nomorBaris: r.nomorBaris, data: r.data })));
  return updated.map((row) => {
    const errors = errorMap.get(row.id) ?? [];
    const shouldAccept = row.id === id && autoAcceptIfValid && errors.length === 0;
    return {
      ...row,
      errors,
      status: errors.length > 0 ? 'ditolak' : shouldAccept ? 'diterima' : row.status,
    };
  });
}

/** Mengembalikan hanya baris yang diterima DAN valid untuk disimpan (SRS-021). */
export function barisSiapSimpan<T>(rows: BarisTinjauan<T>[]): BarisTinjauan<T>[] {
  return rows.filter((row) => row.status === 'diterima' && row.errors.length === 0);
}

/** Menghitung ringkasan status baris tinjauan. */
export function ringkasTinjauan<T>(rows: BarisTinjauan<T>[]): RingkasanTinjauan {
  let valid = 0;
  let diterima = 0;
  let siapSimpan = 0;
  for (const row of rows) {
    const isValid = row.errors.length === 0;
    if (isValid) valid += 1;
    if (row.status === 'diterima') diterima += 1;
    if (isValid && row.status === 'diterima') siapSimpan += 1;
  }
  return {
    total: rows.length,
    valid,
    bermasalah: rows.length - valid,
    diterima,
    ditolak: rows.length - diterima,
    siapSimpan,
  };
}
