import AsyncStorage from '@react-native-async-storage/async-storage';
import { hapusTokenPerangkat, simpanTokenPerangkat } from '../../services/notifikasiService';
import { daftarkanPerangkat, type StatusPush } from './registrasiPush';

const kunci = (uid: string) => `@prakti/push/${uid}`;

export async function lepasRegistrasi(uid: string) {
  const token = await AsyncStorage.getItem(kunci(uid));
  if (!token) return;
  // Server transaction only deletes if this is still the registered device.
  await hapusTokenPerangkat(uid, token);
  await AsyncStorage.removeItem(kunci(uid));
}

export async function sinkronkanPerangkat(
  uid: string,
  platform: 'android' | 'ios',
  mintaIzin: boolean,
  masihAktif: () => boolean,
): Promise<StatusPush> {
  const status = await daftarkanPerangkat(mintaIzin);
  if (!masihAktif()) return status;
  try {
    if (status.kind === 'aktif') {
      // Persist first so logout can also clean up after an ambiguous network failure.
      await AsyncStorage.setItem(kunci(uid), status.token);
      if (!masihAktif()) return status;
      await simpanTokenPerangkat(uid, status.token, platform);
    } else if (status.kind === 'izin_ditolak') {
      await lepasRegistrasi(uid);
    }
    return status;
  } catch (err) {
    console.warn('Gagal menyinkronkan token push:', err);
    // A denied permission stays denied even if removal must be retried on resume.
    return status.kind === 'izin_ditolak' ? status : {
      kind: 'gagal', pesan: 'Perangkat gagal didaftarkan ke server PRAKTI. Periksa koneksi internet lalu coba lagi.',
    };
  }
}
