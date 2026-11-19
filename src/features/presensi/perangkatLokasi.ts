import * as Location from 'expo-location';

import type { HasilLokasi, Posisi } from './lokasi';

export type HasilPosisi =
  | { ok: true; posisi: Posisi }
  | { ok: false; hasil: Extract<HasilLokasi, { jenis: 'izin_ditolak' | 'layanan_mati' | 'koordinat_tidak_tersedia' }> };

const BATAS_TUNGGU_MS = 15_000;

function denganBatasWaktu<T>(janji: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Waktu mengambil lokasi habis')), ms);
    janji.then(
      (nilai) => {
        clearTimeout(timer);
        resolve(nilai);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

const kePosisi = (lokasi: Location.LocationObject): Posisi => ({
  lat: lokasi.coords.latitude,
  lng: lokasi.coords.longitude,
  akurasi: lokasi.coords.accuracy ?? null,
});

/**
 * Meminta izin lokasi (hanya saat fitur presensi dipakai) lalu mengambil posisi terbaru.
 * Setiap kegagalan diterjemahkan menjadi kondisi yang bisa dijelaskan ke praktikan (SRS-018).
 */
export async function ambilPosisi(): Promise<HasilPosisi> {
  let izin = await Location.getForegroundPermissionsAsync();
  if (!izin.granted && izin.canAskAgain) izin = await Location.requestForegroundPermissionsAsync();
  if (!izin.granted) return { ok: false, hasil: { jenis: 'izin_ditolak', bisaMintaLagi: izin.canAskAgain } };

  if (!(await Location.hasServicesEnabledAsync())) return { ok: false, hasil: { jenis: 'layanan_mati' } };

  try {
    const lokasi = await denganBatasWaktu(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      BATAS_TUNGGU_MS,
    );
    return { ok: true, posisi: kePosisi(lokasi) };
  } catch (err) {
    console.warn('Gagal mengambil posisi terbaru:', err);
    // Di dalam gedung GPS bisa lama terkunci; posisi terakhir yang masih baru dan cukup akurat tetap bisa dipakai.
    const terakhir = await Location.getLastKnownPositionAsync({ maxAge: 60_000, requiredAccuracy: 100 }).catch(
      () => null,
    );
    if (terakhir) return { ok: true, posisi: kePosisi(terakhir) };
    if (!(await Location.hasServicesEnabledAsync().catch(() => true))) {
      return { ok: false, hasil: { jenis: 'layanan_mati' } };
    }
    return { ok: false, hasil: { jenis: 'koordinat_tidak_tersedia' } };
  }
}
