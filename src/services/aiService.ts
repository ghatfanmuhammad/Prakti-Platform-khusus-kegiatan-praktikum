/**
 * Analisis sentimen alasan izin dengan model AI di perangkat (Sprint 2 kebutuhan 6).
 *
 * Model: LinearSVC sentimen (positif / netral / negatif), file `ai/model-edom.json`.
 * Prediksi berjalan di HP: tanpa internet, tanpa API key, dan alasan izin tidak
 * dikirim ke layanan luar.
 *
 * Hasil AI hanya INFORMASI PENDUKUNG bagi asisten. Hasil ini tidak pernah dipakai
 * untuk menerima atau menolak izin secara otomatis.
 *
 * Catatan model: data latihnya berupa komentar evaluasi dosen (EDOM), bukan alasan
 * izin praktikum, dan kelas "netral" paling lemah. Anggap hasilnya perkiraan kasar.
 */

import { createSentimentClassifier, type SentimentModel } from './ai/sentiment';

export interface HasilKlasifikasi {
  /** Label sentimen: "positif", "netral", atau "negatif". */
  kategori: string;
  /**
   * Selalu null: model LinearSVC memberi margin keputusan, bukan probabilitas,
   * jadi tidak ditampilkan sebagai persen keyakinan.
   */
  confidence: number | null;
}

export type KodeErrorAI = 'tidak-dikenali' | 'model-tidak-valid';

export class AiError extends Error {
  constructor(public kode: KodeErrorAI, message: string) {
    super(message);
  }
}

/** Pesan ramah pengguna untuk tiap jenis kegagalan AI. */
export function formatAiError(err: unknown): string {
  const kode = (err as AiError | undefined)?.kode;
  switch (kode) {
    case 'tidak-dikenali':
      return 'Alasan tidak mengandung kata yang dikenali model.';
    case 'model-tidak-valid':
      return 'File model AI tidak dapat dimuat.';
    default:
      return 'Analisis AI gagal.';
  }
}

type Classifier = ReturnType<typeof createSentimentClassifier>;
let classifier: Classifier | null = null;

/** Memuat model saat pertama dipakai, supaya tidak memperlambat pembukaan aplikasi. */
function ambilClassifier(): Classifier {
  if (!classifier) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const model = require('./ai/model-edom.json') as SentimentModel;
      classifier = createSentimentClassifier(model);
    } catch (err) {
      throw new AiError('model-tidak-valid', (err as Error)?.message ?? 'model gagal dimuat');
    }
  }
  return classifier;
}

/**
 * Menganalisis sentimen alasan izin di perangkat.
 * Melempar AiError bila gagal; pemanggil wajib menangani agar izin tetap bisa diajukan.
 */
export async function klasifikasiAlasan(alasan: string): Promise<HasilKlasifikasi> {
  const hasil = ambilClassifier()(alasan);
  if (hasil.label === null) {
    throw new AiError('tidak-dikenali', `Model tidak dapat menganalisis alasan (${hasil.status}).`);
  }
  return { kategori: hasil.label, confidence: null };
}
