import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { useToast } from '../../components/Toast';
import { useCurrentPraktikan, usePrakti } from '../../context/PraktiContext';
import { useAppNavigation } from '../../navigation/useAppNavigation';
import type { Sesi } from '../../types';
import { cariPresensi, urutkanSesi } from '../../utils/selectors';
import { SessionPickerSheet } from './SessionPickerSheet';

interface CheckInFlowValue {
  /** Tombol presensi umum: memilih sesi dibuka yang belum dipresensi. */
  mulai: () => void;
  /** Membuka halaman presensi untuk sesi tertentu (dari detail sesi atau beranda). */
  mulaiUntuk: (sesiId: string) => void;
}

const CheckInFlowContext = createContext<CheckInFlowValue | null>(null);

/**
 * Menentukan sesi yang akan dipresensi, lalu membuka halaman Presensi (SRS-012).
 * Provider ini berada di luar Stack.Navigator, sehingga useNavigation memakai
 * navigasi root dari NavigationContainer dan diteruskan ke rute "Presensi".
 */
export function CheckInFlowProvider({ children }: { children: ReactNode }) {
  const praktikan = useCurrentPraktikan();
  const { sesi, presensi, practicum } = usePrakti();
  const toast = useToast();
  const navigation = useAppNavigation();
  const [pickerVisible, setPickerVisible] = useState(false);

  const mulaiUntuk = useCallback(
    (sesiId: string) => {
      if (!praktikan) return;
      navigation.navigate('Presensi', { sesiId });
    },
    [praktikan, navigation],
  );

  const kandidat = useMemo<Sesi[]>(
    () =>
      praktikan
        ? urutkanSesi(sesi).filter(
            (s) => s.status === 'dibuka' && !cariPresensi(presensi, s.id, praktikan.id),
          )
        : [],
    [sesi, presensi, praktikan],
  );

  const mulai = useCallback(() => {
    if (practicum?.loading || practicum?.error) {
      toast.show(practicum.error ?? 'Memuat data praktikum…', practicum.error ? 'error' : 'info');
      return;
    }
    const terbuka = sesi.filter((s) => s.status === 'dibuka');
    if (terbuka.length === 0) {
      toast.show('Belum ada sesi yang dibuka', 'error');
    } else if (kandidat.length === 0) {
      toast.show('Kamu sudah presensi di semua sesi yang dibuka', 'info');
    } else if (kandidat.length === 1) {
      mulaiUntuk(kandidat[0].id);
    } else {
      setPickerVisible(true);
    }
  }, [sesi, kandidat, toast, practicum, mulaiUntuk]);

  const pilihDariDaftar = (dipilih: Sesi) => {
    setPickerVisible(false);
    mulaiUntuk(dipilih.id);
  };

  const value = useMemo(() => ({ mulai, mulaiUntuk }), [mulai, mulaiUntuk]);

  return (
    <CheckInFlowContext.Provider value={value}>
      {children}
      <SessionPickerSheet
        visible={pickerVisible}
        options={kandidat}
        onClose={() => setPickerVisible(false)}
        onPick={pilihDariDaftar}
      />
    </CheckInFlowContext.Provider>
  );
}

export function useCheckInFlow(): CheckInFlowValue {
  const value = useContext(CheckInFlowContext);
  if (!value) throw new Error('useCheckInFlow harus dipakai di dalam CheckInFlowProvider');
  return value;
}
