import {
  createUserWithEmailAndPassword,
  deleteUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';
import {
  doc,
  getDocFromServer,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';

import type { CurrentUser, Role } from '../types';
<<<<<<< HEAD
=======
import { isRole, ROLE_LABELS } from '../features/auth/roles';
>>>>>>> origin/main
import { auth, db } from './firebase';

export type UserRole = Role;

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  nimOrCode: string;
  createdAt?: unknown;
}

/** Kode error buatan aplikasi (bukan dari Firebase). */
const PROFILE_NOT_FOUND = 'app/profile-not-found';

class AppAuthError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

/**
 * Menerjemahkan kode error Firebase Auth / Firestore ke pesan berbahasa Indonesia (SRS-007)
 */
export function formatAuthError(errorCode: string, context?: { role?: UserRole }): string {
  switch (errorCode) {
    case 'auth/invalid-email':
      return 'Format email tidak valid.';
    case 'auth/missing-password':
      return 'Kata sandi wajib diisi.';
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
    case 'auth/too-many-requests':
      return 'Terlalu banyak percobaan gagal. Tunggu beberapa saat lalu coba lagi.';
    case 'auth/network-request-failed':
    case 'unavailable':
      return 'Gagal terhubung ke internet. Periksa koneksi Anda.';
    case 'permission-denied':
      return context?.role && context.role !== 'praktikan'
        ? `Email dan peran ${ROLE_LABELS[context.role]} tidak cocok dengan daftar staf. Hubungi koordinator.`
        : 'Akses ditolak. Data pendaftaran tidak valid.';
    case 'app/role-needs-migration':
      return 'Peran akun lama belum dimigrasikan. Hubungi koordinator; akun dan data Anda tetap tersimpan.';
    case PROFILE_NOT_FOUND:
      return 'Profil akun tidak ditemukan. Silakan daftar ulang atau hubungi koordinator.';
    default:
      return 'Terjadi kesalahan autentikasi. Silakan coba lagi.';
  }
}

/**
 * Mengubah profil Firestore menjadi bentuk user yang dipakai state aplikasi.
 */
export function toCurrentUser(profile: UserProfile): CurrentUser {
<<<<<<< HEAD
  if (profile.role === 'aslab') {
    return { role: 'aslab', aslab: { id: profile.uid, nama: profile.name } };
  }
  if (profile.role === 'asprak') {
    return { role: 'asprak', asprak: { id: profile.uid, nama: profile.name } };
  }
  if (profile.role === 'asisten') {
    return { role: 'asisten', asisten: { id: profile.uid, nama: profile.name } };
=======
  if (!isRole(profile.role)) throw new AppAuthError('app/role-needs-migration', 'Peran akun belum didukung.');
  if (profile.role !== 'praktikan') {
    return { role: profile.role, asisten: { id: profile.uid, nama: profile.name } };
>>>>>>> origin/main
  }
  return {
    role: 'praktikan',
    praktikan: { id: profile.uid, nama: profile.name, nim: profile.nimOrCode },
  };
}

/**
 * Registrasi SRS-019. Role staf harus cocok dengan email dan role di staf_terdaftar; rules adalah otoritas.
 */
export async function registerUser(
  email: string,
  pass: string,
  name: string,
  role: UserRole,
  nimOrCode: string,
): Promise<UserProfile> {
  if (!isRole(role)) throw new AppAuthError('permission-denied', 'Peran tidak valid.');
  const cred = await createUserWithEmailAndPassword(auth, email.trim().toLowerCase(), pass);
  const uid = cred.user.uid;

  const profile: UserProfile = {
    uid,
    // Pakai email dari Firebase Auth (sudah dinormalisasi) agar cocok dengan token di Security Rules
    email: cred.user.email ?? email.trim().toLowerCase(),
    name: name.trim(),
    role,
    nimOrCode: nimOrCode.trim(),
  };

  try {
    // Simpan data peran dan identitas pengguna ke koleksi Firestore "users"
    await setDoc(doc(db, 'users', uid), {
      ...profile,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    // Profil gagal disimpan (mis. ditolak Security Rules): hapus akun Auth
    // supaya tidak ada akun "yatim" tanpa profil/peran.
    await deleteUser(cred.user).catch(() => signOut(auth));
    throw err;
  }

  return profile;
}

/**
 * Login pengguna (SRS-007)
 */
export async function loginUser(email: string, pass: string): Promise<UserProfile> {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), pass);
  const profile = await getUserProfile(cred.user.uid);

  if (!profile) {
    await signOut(auth);
    throw new AppAuthError(PROFILE_NOT_FOUND, 'Data profil pengguna tidak ditemukan di Firestore.');
  }

  if (!isRole(profile.role)) {
    await signOut(auth);
    throw new AppAuthError('app/role-needs-migration', 'Peran akun lama harus dimigrasikan.');
  }
  return profile;
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
  const userDoc = await getDocFromServer(doc(db, 'users', uid));
  if (!userDoc.exists()) return null;
  const profile = userDoc.data() as UserProfile;
  if (profile.uid !== uid) throw new AppAuthError('permission-denied', 'UID profil tidak cocok.');
  return profile;
}

/**
 * Memantau perubahan status login pengguna secara real-time
 */
export function subscribeAuth(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}
