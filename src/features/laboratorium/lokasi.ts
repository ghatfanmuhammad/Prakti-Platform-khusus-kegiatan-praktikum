import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';
import { Linking } from 'react-native';

import type { Koordinat } from '../../utils/geo';

export type StatusLokasi =
  | 'memuat' // sedang meminta izin / menyalakan pemantauan
  | 'menunggu' // izin ada, koordinat pertama belum datang
  | 'siap' // koordinat tersedia
  | 'izin-ditolak'
  | 'layanan-mati'
  | 'belum-tersedia' // menunggu terlalu lama tanpa koordinat
  | 'error';

export interface LokasiPengguna {
  status: StatusLokasi;
  koordinat: Koordinat | null;
  /** Pesan siap tampil untuk status selain siap/memuat/menunggu. */
  pesan: string | null;
  /** Izin masih bisa diminta lagi lewat dialog sistem. */
  bisaMintaLagi: boolean;
  ulangi: () => void;
  bukaPengaturan: () => void;
}

const PESAN: Record<'izin-ditolak' | 'layanan-mati' | 'belum-tersedia' | 'error', string> = {
  'izin-ditolak': 'Izin lokasi ditolak. Aktifkan izin lokasi di pengaturan agar posisi Anda tampil.',
  'layanan-mati': 'Layanan lokasi (GPS) di perangkat sedang mati. Nyalakan lalu coba lagi.',
  'belum-tersedia': 'Koordinat belum tersedia. Pastikan Anda berada di tempat dengan sinyal GPS yang baik.',
  error: 'Gagal membaca lokasi perangkat. Coba lagi.',
};

/** Batas menunggu koordinat pertama sebelum dianggap belum tersedia. */
const BATAS_TUNGGU_MS = 15_000;

/**
 * Memantau lokasi perangkat selama komponen yang memakainya aktif (SRS-015, SRS-018).
 * Meminta izin lokasi saat dipakai dan menghentikan pemantauan saat komponen ditutup.
 */
export function useLokasiPengguna(): LokasiPengguna {
  const [status, setStatus] = useState<StatusLokasi>('memuat');
  const [koordinat, setKoordinat] = useState<Koordinat | null>(null);
  const [bisaMintaLagi, setBisaMintaLagi] = useState(true);
  const [percobaan, setPercobaan] = useState(0);

  useEffect(() => {
    let batal = false;
    let langganan: Location.LocationSubscription | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function mulai() {
      setStatus('memuat');
      try {
        const layananAktif = await Location.hasServicesEnabledAsync();
        if (batal) return;
        if (!layananAktif) return setStatus('layanan-mati');

        const izin = await Location.requestForegroundPermissionsAsync();
        if (batal) return;
        setBisaMintaLagi(izin.canAskAgain);
        if (izin.status !== 'granted') return setStatus('izin-ditolak');

        setStatus('menunggu');
        timer = setTimeout(() => {
          setStatus((sekarang) => (sekarang === 'menunggu' ? 'belum-tersedia' : sekarang));
        }, BATAS_TUNGGU_MS);

        langganan = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, distanceInterval: 5, timeInterval: 3000 },
          (lokasi) => {
            if (batal) return;
            setKoordinat({ latitude: lokasi.coords.latitude, longitude: lokasi.coords.longitude });
            setStatus('siap');
          },
        );
        if (batal) langganan.remove();
      } catch (err) {
        console.warn('Gagal memantau lokasi:', err);
        if (!batal) setStatus('error');
      }
    }

    void mulai();
    return () => {
      batal = true;
      if (timer) clearTimeout(timer);
      langganan?.remove();
    };
  }, [percobaan]);

  const ulangi = useCallback(() => setPercobaan((n) => n + 1), []);
  const bukaPengaturan = useCallback(() => {
    void Linking.openSettings();
  }, []);

  const pesan =
    status === 'izin-ditolak' || status === 'layanan-mati' || status === 'belum-tersedia' || status === 'error'
      ? PESAN[status]
      : null;

  return { status, koordinat, pesan, bisaMintaLagi, ulangi, bukaPengaturan };
}

/**
 * Ambil satu koordinat saat ini (untuk tombol "Gunakan lokasi saya" di form lab).
 * Melempar Error berpesan ramah bila izin/GPS bermasalah.
 */
export async function ambilLokasiSekarang(): Promise<Koordinat> {
  if (!(await Location.hasServicesEnabledAsync()))
    throw new Error(PESAN['layanan-mati']);
  const izin = await Location.requestForegroundPermissionsAsync();
  if (izin.status !== 'granted') throw new Error(PESAN['izin-ditolak']);
  try {
    const lokasi = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    return { latitude: lokasi.coords.latitude, longitude: lokasi.coords.longitude };
  } catch {
    throw new Error(PESAN['belum-tersedia']);
  }
}