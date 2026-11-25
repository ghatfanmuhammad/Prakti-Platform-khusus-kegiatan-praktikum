import * as Notifications from 'expo-notifications';

/** Respons notifikasi terakhir yang diketuk pengguna (Android/iOS). */
export function useResponNotifikasi() {
  return Notifications.useLastNotificationResponse();
}
