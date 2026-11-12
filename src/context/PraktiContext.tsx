import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  type ReactNode,
} from 'react';

import { DAFTAR_ASISTEN, DAFTAR_PRAKTIKAN } from '../data';
import type { Asisten, CurrentUser, Praktikan, Presensi, Sesi } from '../types';
import { evaluateCheckIn, type CheckInResult } from '../utils/attendanceRules';
import { buatKodeSesi } from '../utils/code';
import { initialState, praktiReducer } from './reducer';

interface PraktiContextValue {
  currentUser: CurrentUser | null;
  asistenList: Asisten[];
  praktikanList: Praktikan[];
  sesi: Sesi[];
  presensi: Presensi[];
  masuk: (user: CurrentUser) => void;
  keluar: () => void;
  bukaSesi: (sesiId: string, topik: string | null) => void;
  tutupSesi: (sesiId: string) => void;
  /** Mencatat presensi bila aturan terpenuhi; hasilnya dipakai UI untuk umpan balik. */
  catatPresensi: (sesiId: string, praktikanId: string, kode: string) => CheckInResult;
}

const PraktiContext = createContext<PraktiContextValue | null>(null);

export function PraktiProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(praktiReducer, initialState);

  const masuk = useCallback((user: CurrentUser) => dispatch({ type: 'MASUK', user }), []);
  const keluar = useCallback(() => dispatch({ type: 'KELUAR' }), []);

  const bukaSesi = useCallback(
    (sesiId: string, topik: string | null) =>
      dispatch({ type: 'BUKA_SESI', sesiId, topik, kode: buatKodeSesi() }),
    [],
  );

  const tutupSesi = useCallback(
    (sesiId: string) => dispatch({ type: 'TUTUP_SESI', sesiId }),
    [],
  );

  const catatPresensi = useCallback(
    (sesiId: string, praktikanId: string, kode: string): CheckInResult => {
      const hasil = evaluateCheckIn(
        { sesi: state.sesi, presensi: state.presensi },
        sesiId,
        praktikanId,
        kode,
      );
      if (hasil.ok) dispatch({ type: 'TAMBAH_PRESENSI', presensi: hasil.presensi });
      return hasil;
    },
    [state.sesi, state.presensi],
  );

  const value = useMemo<PraktiContextValue>(
    () => ({
      currentUser: state.currentUser,
      asistenList: DAFTAR_ASISTEN,
      praktikanList: DAFTAR_PRAKTIKAN,
      sesi: state.sesi,
      presensi: state.presensi,
      masuk,
      keluar,
      bukaSesi,
      tutupSesi,
      catatPresensi,
    }),
    [state, masuk, keluar, bukaSesi, tutupSesi, catatPresensi],
  );

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
  return currentUser?.role === 'asisten' ? currentUser.asisten : null;
}

export function useCurrentPraktikan(): Praktikan | null {
  const { currentUser } = usePrakti();
  return currentUser?.role === 'praktikan' ? currentUser.praktikan : null;
}
