import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  getAuth,
  getReactNativePersistence,
  initializeAuth,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { Platform } from 'react-native';

/**
 * Konfigurasi Firebase resmi untuk PRAKTI.
 */
export const firebaseConfig = {
  apiKey: 'AIzaSyB8aND0gIOdRRsj96FjcdGrAEmq3SyHDwY',
  authDomain: 'prakti-f938a.firebaseapp.com',
  databaseURL: 'https://prakti-f938a-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'prakti-f938a',
  storageBucket: 'prakti-f938a.firebasestorage.app',
  messagingSenderId: '66616717405',
  appId: '1:66616717405:web:ed90a2df59cb1032d5ddb4',
  measurementId: 'G-XFGBSPG2FQ',
};

// Inisialisasi Firebase App (singleton)
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Inisialisasi Auth dengan AsyncStorage di platform mobile (Android/iOS)
// agar sesi login tetap tersimpan saat aplikasi ditutup
export const auth = (() => {
  if (Platform.OS === 'web') {
    return getAuth(app);
  }
  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    return getAuth(app);
  }
})();

// Inisialisasi Cloud Firestore
export const db = getFirestore(app);
