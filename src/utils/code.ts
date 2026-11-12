export const PANJANG_KODE = 4;

/** Kode sesi acak 4 angka, tidak diawali nol. */
export const buatKodeSesi = (): string => String(Math.floor(1000 + Math.random() * 9000));
