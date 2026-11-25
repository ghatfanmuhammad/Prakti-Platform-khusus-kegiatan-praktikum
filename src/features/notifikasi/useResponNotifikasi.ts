import type { NotificationResponse } from 'expo-notifications';

/**
 * Web tidak mendukung respons notifikasi: hook bawaan expo-notifications
 * melempar UnavailabilityError di web, sehingga di sini selalu null.
 * Versi Android/iOS ada di useResponNotifikasi.native.ts.
 */
export function useResponNotifikasi(): NotificationResponse | null | undefined {
  return null;
}
