import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from 'react';

import type { HasilKirim } from '../features/notifikasi/pesan';
import { bukaSesiDenganNotifikasi } from '../features/notifikasi/aksi';

import { DAFTAR_ASISTEN, DAFTAR_PRAKTIKAN } from '../data';
import { saveAttendance } from '../features/data-praktikum/attendance';
import { usePracticumData } from '../features/data-praktikum/hooks';
import { changeSessionStatus } from '../features/data-praktikum/repository';
import type { LokasiValid } from '../features/presensi/lokasi';
import type { Asisten, CurrentUser, Praktikan, Presensi, Sesi } from '../types';
import { evaluateCheckIn, type CheckInResult } from '../utils/attendanceRules';
import { buatKodeSesi } from '../utils/code';
import { cariSesi } from '../utils/selectors';
import { initialState, praktiReducer } from './reducer';

interface PraktiContextValue {
  currentUser: CurrentUser | null;
  asistenList: Asisten[];
  praktikanList: Praktikan[];
  sesi: Sesi[];
  presensi: Presensi[];
  masuk: (user: CurrentUser, demo?: boolean) => void;
  keluar: () => void;
  practicum: ReturnType<typeof usePracticumData> | null;
  retryPracticum: () => void;
  pesertaSesi: (sesi: Sesi) => Praktikan[];
  /** Mengembalikan hasil push notification ke praktikan kelas (null di mode demo). */
  bukaSesi: (sesiId: string, topik: string | null) => Promise<HasilKirim | null>;
  tutupSesi: (sesiId: string) => Promise<void>;
  /**
   * Menyimpan presensi. `lokasi` wajib berupa hasil pemeriksaan yang berada dalam radius lab (SRS-013),
   * sehingga presensi tidak bisa tersimpan tanpa validasi lokasi.
   */
  catatPresensi: (sesiId: string, praktikanId: string, kode: string, lokasi: LokasiValid) => Promise<CheckInResult>;
}

const PraktiContext = createContext<PraktiContextValue | null>(null);

export function PraktiProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(praktiReducer, initialState);
  const [attempt, setAttempt] = useState(0);
  const retryPracticum = useCallback(() => setAttempt((retry) => retry + 1), []);
  const user = state.currentUser;
  const role = user?.role;
  const uid = user ? (user.role === 'praktikan' ? user.praktikan.id : user.asisten.id) : undefined;
  const identity = role && uid && !state.demo ? { role, uid } : null;
  const data = usePracticumData(identity, attempt);
  const practicum = identity ? data : null;
  const sesi = state.demo ? state.sesi : data.sesi;
  const presensi = state.demo ? state.presensi : data.presensi;
  const asistenList = useMemo(() =>
    state.demo || !user ? DAFTAR_ASISTEN : user && user.role !== 'praktikan' ? [user.asisten] : [],
    [state.demo, user],
  );
  const pesertaSesi = useCallback((target: Sesi) =>
    state.demo
      ? DAFTAR_PRAKTIKAN
      : data.participants.data
          .filter((p) => p.classId === target.classId)
          .map(({ uid: id, nama, nim }) => ({ id, nama, nim })),
    [state.demo, data.participants.data],
  );

  const masuk = useCallback((user: CurrentUser, demo = false) => dispatch({ type: 'MASUK', user, demo }), []);
  const keluar = useCallback(() => dispatch({ type: 'KELUAR' }), []);

  const bukaSesi = async (sesiId: string, topik: string | null) => {
    if (state.demo) {
      dispatch({ type: 'BUKA_SESI', sesiId, topik, kode: buatKodeSesi() });
      return null;
    }
    const target = cariSesi(sesi, sesiId);
    if (!target?.classId || !target.sessionId) throw new Error('Sesi tidak ditemukan.');
    return bukaSesiDenganNotifikasi(target, topik);
  };

  const tutupSesi = async (sesiId: string) => {
    if (state.demo) {
      dispatch({ type: 'TUTUP_SESI', sesiId });
      return;
    }
    const target = cariSesi(sesi, sesiId);
    if (!target?.classId || !target.sessionId) throw new Error('Sesi tidak ditemukan.');
    await changeSessionStatus(target.classId, target.sessionId, 'ditutup');
  };

  const catatPresensi = async (
    sesiId: string,
    praktikanId: string,
    kode: string,
    lokasi: LokasiValid,
  ): Promise<CheckInResult> => {
    // Kedua metode memakai validasi yang sama; repository dan rules memeriksa data lab terkini.
    if (!lokasi || lokasi.jenis !== 'dalam_radius') throw new Error('Lokasi belum tervalidasi. Periksa lokasi lalu coba lagi.');
    if (!state.demo) {
      const target = cariSesi(sesi, sesiId);
      if (!target) return { ok: false, reason: 'SESI_TIDAK_DITEMUKAN' };
      return saveAttendance(target, praktikanId, kode, lokasi);
    }
    const hasil = evaluateCheckIn({ sesi, presensi }, sesiId, praktikanId, kode);
    if (hasil.ok) dispatch({ type: 'TAMBAH_PRESENSI', presensi: hasil.presensi });
    return hasil;
  };

  const value: PraktiContextValue = {
    currentUser: user,
    asistenList,
    praktikanList: user && !state.demo ? [] : DAFTAR_PRAKTIKAN,
    sesi,
    presensi,
    practicum,
    retryPracticum,
    pesertaSesi,
    masuk,
    keluar,
    bukaSesi,
    tutupSesi,
    catatPresensi,
  };

  return <PraktiContext.Provider value={value}>{children}</PraktiContext.Provider>;
}

export function usePrakti(): PraktiContextValue {
  const value = useContext(PraktiContext);
  if (!value) throw new Error('usePrakti harus dipakai di dalam PraktiProvider');
  return value;
}

/**
 * Mengembalikan null (bukan melempar galat) saat peran tidak cocok, karena layar lama
 * masih bisa dirender sesaat ketika pengguna menekan "Ganti peran".
 */
export function useCurrentAsisten(): Asisten | null {
  const { currentUser } = usePrakti();
  return currentUser?.role === 'asprak' ? currentUser.asisten : null;
}

export function useCurrentPraktikan(): Praktikan | null {
  const { currentUser } = usePrakti();
  return currentUser?.role === 'praktikan' ? currentUser.praktikan : null;
}
