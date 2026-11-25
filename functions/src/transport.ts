import { susunPesan, tokenValid, type HasilKirim, type IsiNotifikasi } from '../../src/features/notifikasi/pesan';

export type ReadDocument = (path: string) => Promise<Record<string, unknown> | undefined>;
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const BATAS_WAKTU_MS = 10000;

// Server-only: the mobile app never reads another account's token.
export function createPushSender(read: ReadDocument, members: (classId: string) => Promise<string[]>) {
  function pesanGalat(err: unknown): string {
    if ((err as { name?: string })?.name === 'AbortError') return 'layanan notifikasi tidak merespons.';
    const code = (err as { code?: string })?.code;
    if (code === 'permission-denied') return 'akses data token ditolak.';
    if (code === 'unavailable' || err instanceof TypeError) return 'periksa koneksi internet.';
    return 'layanan notifikasi gagal memproses permintaan.';
  }

  /** Mengirim hanya token milik UID yang diminta, melanjutkan batch lain jika satu batch gagal. */
  async function kirimKePengguna(uids: string[], isi: IsiNotifikasi): Promise<HasilKirim> {
    const unik = [...new Set(uids.filter((uid) => typeof uid === 'string' && uid.length > 0))];
    const hasil: HasilKirim = { penerima: unik.length, terkirim: 0, tanpaToken: 0, gagal: 0 };
    const pemilik = new Map<string, number>();
    const snaps = await Promise.allSettled(unik.map((uid) => read(`pushTokens/${uid}`)));
    snaps.forEach((snap, index) => {
      if (snap.status === 'rejected') {
        hasil.gagal++;
        hasil.galat = pesanGalat(snap.reason);
        return;
      }
      const data = snap.value;
      if (!data || data.uid !== unik[index] || !tokenValid(data.token)) hasil.tanpaToken++;
      else pemilik.set(data.token, (pemilik.get(data.token) ?? 0) + 1);
    });
    for (const potongan of susunPesan([...pemilik.keys()], isi)) {
      const jumlah = potongan.reduce((total, pesan) => total + pemilik.get(pesan.to)!, 0);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), BATAS_WAKTU_MS);
      try {
        const res = await fetch(EXPO_PUSH_URL, {
          method: 'POST',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify(potongan),
          signal: controller.signal,
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(`layanan notifikasi menolak permintaan (HTTP ${res.status}).`);
        const data = json?.data;
        const tiket = Array.isArray(data) ? data : data ? [data] : [];
        const diterima = potongan.reduce((total, pesan, index) =>
          total + (tiket[index]?.status === 'ok' ? pemilik.get(pesan.to)! : 0), 0);
        hasil.terkirim += diterima;
        hasil.gagal += jumlah - diterima;
        const ditolak = tiket.find((tiket: { status?: string }) => tiket?.status === 'error');
        if (ditolak) hasil.galat = 'layanan push menolak pesan.';
      } catch (err) {
        hasil.gagal += jumlah;
        hasil.galat = pesanGalat(err);
      } finally {
        clearTimeout(timer);
      }
    }
    return hasil;
  }

  /** Mengirim ke seluruh praktikan yang terdaftar di kelas (koleksi participants). */
  async function kirimKeKelas(classId: string, isi: IsiNotifikasi): Promise<HasilKirim> {
    try {
      return await kirimKePengguna(await members(classId), isi);
    } catch (err) {
      return { penerima: 0, terkirim: 0, tanpaToken: 0, gagal: 0, galat: pesanGalat(err) };
    }
  }

  return { kirimKePengguna, kirimKeKelas };
}
