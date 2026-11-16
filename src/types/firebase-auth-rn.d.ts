// `firebase/auth` selalu memakai deklarasi tipe versi web, padahal Metro memuat build
// React Native (`@firebase/auth/dist/rn`) yang mengekspor getReactNativePersistence.
// Deklarasi ini hanya melengkapi tipe agar `tsc` tidak error; runtime tidak berubah.
import type { Persistence } from 'firebase/auth';

declare module 'firebase/auth' {
  interface ReactNativeAsyncStorage {
    setItem(key: string, value: string): Promise<void>;
    getItem(key: string): Promise<string | null>;
    removeItem(key: string): Promise<void>;
  }
  export function getReactNativePersistence(storage: ReactNativeAsyncStorage): Persistence;
}
