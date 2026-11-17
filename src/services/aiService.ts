/**
 * Integrasi API model AI pengajar untuk klasifikasi alasan izin (Sprint 2 kebutuhan 6).
 *
 * Hasil AI hanya INFORMASI PENDUKUNG bagi asisten. Hasil ini tidak pernah dipakai
 * untuk menerima atau menolak izin secara otomatis.
 *
 * Konfigurasi di file `.env.local` (lihat `.env.example`):
 *   EXPO_PUBLIC_AI_API_URL  = endpoint model
 *   EXPO_PUBLIC_AI_API_KEY  = token (opsional, dikirim sebagai Bearer)
 */

const AI_API_URL = process.env.EXPO_PUBLIC_AI_API_URL ?? '';
const AI_API_KEY = process.env.EXPO_PUBLIC_AI_API_KEY ?? '';

/** Batas waktu menunggu respons AI sebelum dianggap gagal. */
const TIMEOUT_MS = 10_000;

export interface HasilKlasifikasi {
  kategori: string;
  /** Tingkat keyakinan 0..1, null bila API tidak mengirimkannya. */
  confidence: number | null;
}

export type KodeErrorAI =
  | 'belum-dikonfigurasi'
  | 'timeout'
  | 'jaringan'
  | 'server'
  | 'respons-tidak-valid';

export class AiError extends Error {
  constructor(public kode: KodeErrorAI, message: string) {
    super(message);
  }
}

/** Pesan ramah pengguna untuk tiap jenis kegagalan AI. */
export function formatAiError(err: unknown): string {
  const kode = (err as AiError | undefined)?.kode;
  switch (kode) {
    case 'belum-dikonfigurasi':
      return 'Layanan AI belum dikonfigurasi.';
    case 'timeout':
      return 'Layanan AI tidak merespons.';
    case 'jaringan':
      return 'Gagal terhubung ke layanan AI.';
    case 'server':
      return 'Layanan AI sedang bermasalah.';
    case 'respons-tidak-valid':
      return 'Respons layanan AI tidak dapat dibaca.';
    default:
      return 'Klasifikasi AI gagal.';
  }
}

/**
 * Body request ke API. SESUAIKAN dengan format dari pengajar bila berbeda.
 */
function buatBodyRequest(alasan: string): unknown {
  return { text: alasan };
}

/**
 * Membaca hasil dari berbagai bentuk respons yang umum, misalnya:
 *   { "label": "Sakit", "confidence": 0.92 }
 *   { "kategori": "Sakit", "score": 92 }
 *   { "data": { "prediction": "Sakit", "probability": 0.9 } }
 *   [{ "label": "Sakit", "score": 0.9 }, { "label": "Lainnya", "score": 0.1 }]   (gaya Hugging Face)
 *   [[{ "label": "Sakit", "score": 0.9 }]]
 * SESUAIKAN bila format API pengajar berbeda.
 */
export function bacaHasilKlasifikasi(json: unknown): HasilKlasifikasi {
  let x: any = json;
  if (x && !Array.isArray(x) && typeof x === 'object') {
    x = x.data ?? x.result ?? x.hasil ?? x.output ?? x;
  }
  while (Array.isArray(x) && Array.isArray(x[0])) x = x[0];
  if (Array.isArray(x)) {
    // Ambil kandidat dengan skor tertinggi
    x = [...x].sort((a, b) => ambilSkor(b) - ambilSkor(a))[0];
  }

  const kategori =
    x?.kategori ?? x?.category ?? x?.label ?? x?.prediction ?? x?.predicted_label ?? x?.class;
  if (typeof kategori !== 'string' || kategori.trim() === '') {
    throw new AiError('respons-tidak-valid', 'Respons AI tidak berisi kategori.');
  }

  const skor = ambilSkor(x);
  return {
    kategori: kategori.trim(),
    confidence: Number.isFinite(skor) && skor >= 0 ? normalisasi(skor) : null,
  };
}

function ambilSkor(x: any): number {
  const v = x?.confidence ?? x?.score ?? x?.probability ?? x?.prob;
  return typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : NaN;
}

/** Sebagian API mengirim persen (0..100); simpan selalu dalam 0..1. */
function normalisasi(skor: number): number {
  const nilai = skor > 1 ? skor / 100 : skor;
  return Math.min(1, Math.max(0, nilai));
}

/**
 * MODE UJI COBA (EXPO_PUBLIC_AI_API_URL=mock).
 * BUKAN model AI: hanya tebakan kata kunci untuk mencoba tampilan & alur
 * sebelum API pengajar tersedia. Jangan dipakai untuk demo akhir.
 * Ketik kata "gagalai" di alasan untuk mensimulasikan layanan AI yang tidak merespons.
 */
const KATA_KUNCI_MOCK: { kategori: string; kata: string[] }[] = [
  { kategori: 'Sakit', kata: ['sakit', 'demam', 'dokter', 'rumah sakit', 'flu', 'pusing', 'opname', 'diare', 'tifus', 'covid'] },
  { kategori: 'Keluarga', kata: ['keluarga', 'orang tua', 'ayah', 'ibu', 'nenek', 'kakek', 'meninggal', 'duka', 'pernikahan', 'nikah', 'saudara'] },
  { kategori: 'Akademik', kata: ['lomba', 'kompetisi', 'seminar', 'ujian', 'konferensi', 'tugas kampus', 'delegasi', 'magang'] },
  { kategori: 'Transportasi', kata: ['macet', 'banjir', 'kendaraan', 'motor', 'mogok', 'kecelakaan', 'ban bocor'] },
];

async function klasifikasiMock(alasan: string): Promise<HasilKlasifikasi> {
  await new Promise((r) => setTimeout(r, 800)); // tiru jeda jaringan
  const teks = alasan.toLowerCase();
  if (teks.includes('gagalai')) {
    throw new AiError('timeout', 'Simulasi: layanan AI tidak merespons.');
  }
  for (const { kategori, kata } of KATA_KUNCI_MOCK) {
    const cocok = kata.filter((k) => teks.includes(k)).length;
    if (cocok > 0) return { kategori, confidence: Math.min(0.95, 0.6 + cocok * 0.15) };
  }
  return { kategori: 'Lainnya', confidence: 0.4 };
}

/**
 * Mengirim alasan izin ke API AI dan mengembalikan prediksi kategorinya.
 * Melempar AiError bila gagal; pemanggil wajib menangani agar izin tetap bisa diajukan.
 */
export async function klasifikasiAlasan(alasan: string): Promise<HasilKlasifikasi> {
  if (AI_API_URL.trim().toLowerCase() === 'mock') {
    return klasifikasiMock(alasan);
  }
  if (!AI_API_URL) {
    throw new AiError('belum-dikonfigurasi', 'EXPO_PUBLIC_AI_API_URL belum diisi.');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(AI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(AI_API_KEY ? { Authorization: `Bearer ${AI_API_KEY}` } : {}),
      },
      body: JSON.stringify(buatBodyRequest(alasan)),
      signal: controller.signal,
    });
  } catch (err) {
    const aborted = (err as Error | undefined)?.name === 'AbortError';
    throw new AiError(aborted ? 'timeout' : 'jaringan', (err as Error)?.message ?? 'fetch gagal');
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    throw new AiError('server', `API AI merespons HTTP ${res.status}`);
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new AiError('respons-tidak-valid', 'Respons AI bukan JSON.');
  }
  return bacaHasilKlasifikasi(json);
}
