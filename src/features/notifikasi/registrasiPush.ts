/**
 * [SRS-017/SRS-018] Meminta izin notifikasi dan mendaftarkan perangkat ke Expo Push Service.
 */
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { AndroidImportance, IosAuthorizationStatus } from 'expo-notifications';
import { Platform } from 'react-native';

import { CHANNEL_ID } from './pesan';

export type StatusPush =
  | { kind: 'memeriksa' }
  | { kind: 'aktif'; token: string }
  | { kind: 'izin_ditolak'; bisaDimintaLagi: boolean }
  | { kind: 'tidak_didukung'; pesan: string }
  | { kind: 'gagal'; pesan: string };

/** Notifikasi tetap tampil sebagai banner saat aplikasi sedang dibuka. */
export function aturTampilanNotifikasi() {
  if (Platform.OS === 'web') return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

function projectIdEas(): string | undefined {
  return Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? undefined;
}

function alasanTidakDidukung(): string | null {
  if (Platform.OS === 'web') return 'Push notification hanya tersedia di aplikasi Android/iOS.';
  if (Platform.OS === 'android' && Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    return 'Expo Go di Android tidak mendukung push notification. Gunakan development build aplikasi PRAKTI.';
  }
  return null;
}

async function ambilToken(projectId: string): Promise<string> {
  try {
    return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  } catch (err) {
    // Pendaftaran butuh jaringan; coba sekali lagi sebelum menyerah
    await new Promise((resolve) => setTimeout(resolve, 1500));
    try {
      return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    } catch {
      throw err;
    }
  }
}

/**
 * Memeriksa/meminta izin lalu mengambil token Expo push.
 * @param mintaIzin false untuk sekadar memeriksa ulang tanpa memunculkan dialog izin.
 */
export async function daftarkanPerangkat(mintaIzin = true): Promise<StatusPush> {
  const tidakDidukung = alasanTidakDidukung();
  if (tidakDidukung) return { kind: 'tidak_didukung', pesan: tidakDidukung };

  try {
    // Android 13+ baru menampilkan dialog izin setelah channel dibuat
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Kegiatan praktikum',
        description: 'Sesi dibuka, perubahan jadwal, dan keputusan izin',
        importance: AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    let izin = await Notifications.getPermissionsAsync();
    if (!izin.granted && izin.canAskAgain && mintaIzin) {
      izin = await Notifications.requestPermissionsAsync();
    }
    const provisional = izin.ios?.status === IosAuthorizationStatus.PROVISIONAL;
    if (!izin.granted && !provisional) {
      return { kind: 'izin_ditolak', bisaDimintaLagi: izin.canAskAgain };
    }
  } catch (err) {
    console.warn('Gagal memeriksa izin notifikasi:', err);
    return { kind: 'gagal', pesan: 'Izin notifikasi tidak dapat diperiksa di perangkat ini.' };
  }

  const projectId = projectIdEas();
  if (!projectId) {
    return {
      kind: 'gagal',
      pesan: 'Aplikasi belum terhubung ke project EAS, sehingga perangkat tidak dapat didaftarkan.',
    };
  }

  try {
    return { kind: 'aktif', token: await ambilToken(projectId) };
  } catch (err) {
    console.warn('Gagal mendaftarkan perangkat untuk push:', err);
    return {
      kind: 'gagal',
      pesan: 'Perangkat gagal didaftarkan untuk menerima notifikasi. Periksa koneksi internet lalu coba lagi.',
    };
  }
}
