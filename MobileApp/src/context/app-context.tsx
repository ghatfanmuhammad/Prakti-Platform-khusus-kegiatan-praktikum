// PLACEHOLDER SRS-002: state bersama sementara dari Felicia.
// Kalau PM sudah merge Context resminya, ganti import `useApp` ke milik PM
// dan sesuaikan nama field (pengguna, jadwal, presensi).
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

type AppContextValue = {
  pengguna: Identitas | null;
  masuk: (peran: Peran, id: string) => void;
  keluar: () => void;
  jadwal: Jadwal[];
  setJadwal: Dispatch<SetStateAction<Jadwal[]>>;
  presensi: Presensi[];
  setPresensi: Dispatch<SetStateAction<Presensi[]>>;
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

  const value = useMemo(
    () => ({ pengguna, masuk, keluar, jadwal, setJadwal, presensi, setPresensi }),
    [pengguna, masuk, keluar, jadwal, presensi],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp harus dipakai di dalam AppProvider');
  return ctx;
}
