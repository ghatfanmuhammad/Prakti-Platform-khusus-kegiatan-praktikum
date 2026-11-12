import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';

import { auth, db } from './firebase';

export type UserRole = 'asisten' | 'praktikan';

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  nimOrCode: string;
  createdAt?: unknown;
}

/**
 * Menerjemahkan kode error Firebase Auth ke pesan berbahasa Indonesia (SRS-007)
 */
export function formatAuthError(errorCode: string): string {
  switch (errorCode) {
    case 'auth/invalid-email':
      return 'Format email tidak valid.';
    case 'auth/user-disabled':
      return 'Akun ini telah dinonaktifkan.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Email atau kata sandi salah.';
    case 'auth/email-already-in-use':
      return 'Email sudah terdaftar. Silakan login.';
    case 'auth/weak-password':
      return 'Kata sandi terlalu lemah (minimal 6 karakter).';
    case 'auth/network-request-failed':
      return 'Gagal terhubung ke internet. Periksa koneksi Anda.';
    default:
      return 'Terjadi kesalahan autentikasi. Silakan coba lagi.';
  }
}

/**
 * Registrasi akun baru dengan role asisten / praktikan (SRS-007)
 */
export async function registerUser(
  email: string,
  pass: string,
  name: string,
  role: UserRole,
  nimOrCode: string,
): Promise<UserProfile> {
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), pass);
  const uid = cred.user.uid;

  const profile: UserProfile = {
    uid,
    email: email.trim(),
    name: name.trim(),
    role,
    nimOrCode: nimOrCode.trim(),
  };

  // Simpan data peran dan identitas pengguna ke koleksi Firestore "users"
  await setDoc(doc(db, 'users', uid), {
    ...profile,
    createdAt: serverTimestamp(),
  });

  return profile;
}

/**
 * Login pengguna (SRS-007)
 */
export async function loginUser(email: string, pass: string): Promise<UserProfile> {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), pass);
  const uid = cred.user.uid;

  const userDoc = await getDoc(doc(db, 'users', uid));
  if (!userDoc.exists()) {
    throw new Error('Data profil pengguna tidak ditemukan di Firestore.');
  }

  return userDoc.data() as UserProfile;
}

/**
 * Logout pengguna (SRS-007)
 */
export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

/**
 * Mengambil profil pengguna dari Firestore berdasarkan UID
 */
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const userDoc = await getDoc(doc(db, 'users', uid));
  return userDoc.exists() ? (userDoc.data() as UserProfile) : null;
}

/**
 * Memantau perubahan status login pengguna secara real-time
 */
export function subscribeAuth(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}
