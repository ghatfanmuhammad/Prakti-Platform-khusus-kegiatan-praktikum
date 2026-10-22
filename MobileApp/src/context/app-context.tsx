// SRS-002: state bersama (pengguna, jadwal, presensi) untuk seluruh fitur.
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';

import {
  ASISTEN,
  JADWAL_AWAL,
  PRAKTIKAN,
  PRESENSI_AWAL,
  type Identitas,
  type Jadwal,
  type Peran,
  type Presensi,
} from '@/data/dummy';
import { keWaktuLokal } from '@/utils/waktu';

type AppContextValue = {
  pengguna: Identitas | null;
  masuk: (peran: Peran, id: string) => void;
  keluar: () => void;
  jadwal: Jadwal[];
  setJadwal: Dispatch<SetStateAction<Jadwal[]>>;
  presensi: Presensi[];
  setPresensi: Dispatch<SetStateAction<Presensi[]>>;
  /** Mencatat presensi pengguna aktif; diabaikan jika sesi tidak dibuka atau sudah tercatat. */
  catatPresensi: (jadwalId: string, waktuHadir: string) => void;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [pengguna, setPengguna] = useState<Identitas | null>(null);
  const [jadwal, setJadwal] = useState<Jadwal[]>(JADWAL_AWAL);
  const [presensi, setPresensi] = useState<Presensi[]>(PRESENSI_AWAL);

  const masuk = useCallback((peran: Peran, id: string) => {
    const daftar = peran === 'asisten' ? ASISTEN : PRAKTIKAN;
    const ditemukan = daftar.find((item) => item.id === id);
    if (ditemukan) setPengguna(ditemukan);
  }, []);

  const keluar = useCallback(() => setPengguna(null), []);

  const catatPresensi = useCallback(
    (jadwalId: string, waktuHadir: string) => {
      if (!pengguna || pengguna.peran !== 'praktikan') return;
      const sesi = jadwal.find((j) => j.id === jadwalId);
      if (sesi?.status !== 'dibuka') return;
      setPresensi((prev) => {
        if (prev.some((p) => p.jadwalId === jadwalId && p.praktikanId === pengguna.id)) return prev;
        return [
          ...prev,
          {
            id: `p-${Date.now()}`,
            praktikanId: pengguna.id,
            jadwalId,
            waktuHadir: keWaktuLokal(new Date(waktuHadir)),
          },
        ];
      });
    },
    [pengguna, jadwal],
  );

  const value = useMemo(
    () => ({ pengguna, masuk, keluar, jadwal, setJadwal, presensi, setPresensi, catatPresensi }),
    [pengguna, masuk, keluar, jadwal, presensi, catatPresensi],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp harus dipakai di dalam AppProvider');
  return ctx;
}
