import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Platform } from 'react-native';

import { useToast } from '../../components/Toast';
import { useCurrentPraktikan, usePrakti } from '../../context/PraktiContext';
import type { Sesi } from '../../types';
import { evaluateCheckIn, pesanGagalPresensi } from '../../utils/attendanceRules';
import { cariPresensi, cariSesi, urutkanSesi } from '../../utils/selectors';
import { CheckInSheet } from './CheckInSheet';
import { SessionPickerSheet } from './SessionPickerSheet';

interface CheckInFlowValue {
  /** Tombol presensi umum: memilih sesi dibuka yang belum dipresensi. */
  mulai: () => void;
  /** Presensi untuk sesi tertentu (dari detail sesi atau beranda). */
  mulaiUntuk: (sesiId: string) => void;
}

const CheckInFlowContext = createContext<CheckInFlowValue | null>(null);

// Modal kedua di iOS baru bisa tampil setelah modal pertama selesai menutup.
const JEDA_MODAL_MS = Platform.OS === 'ios' ? 400 : 0;

export function CheckInFlowProvider({ children }: { children: ReactNode }) {
  const praktikan = useCurrentPraktikan();
  const { sesi, presensi } = usePrakti();
  const toast = useToast();
  const [pickerVisible, setPickerVisible] = useState(false);
  const [sheetSesiId, setSheetSesiId] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const mulaiUntuk = useCallback(
    (sesiId: string) => {
      if (!praktikan) return;
      const cek = evaluateCheckIn({ sesi, presensi }, sesiId, praktikan.id, '');
      if (!cek.ok && ['SESI_TIDAK_DITEMUKAN', 'SESI_BELUM_DIBUKA', 'SESI_DITUTUP', 'SUDAH_PRESENSI'].includes(cek.reason)) {
        toast.show(pesanGagalPresensi(cek), cek.reason === 'SUDAH_PRESENSI' ? 'info' : 'error');
        return;
      }
      setSheetSesiId(sesiId);
    },
    [praktikan, sesi, presensi, toast],
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
    const terbuka = sesi.filter((s) => s.status === 'dibuka');
    if (terbuka.length === 0) {
      toast.show('Belum ada sesi yang dibuka', 'error');
    } else if (kandidat.length === 0) {
      toast.show('Kamu sudah presensi di semua sesi yang dibuka', 'info');
    } else if (kandidat.length === 1) {
      setSheetSesiId(kandidat[0].id);
    } else {
      setPickerVisible(true);
    }
  }, [sesi, kandidat, toast]);

  const pilihDariDaftar = (dipilih: Sesi) => {
    setPickerVisible(false);
    timer.current = setTimeout(() => setSheetSesiId(dipilih.id), JEDA_MODAL_MS);
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
      <CheckInSheet
        visible={sheetSesiId !== null}
        sesi={sheetSesiId ? (cariSesi(sesi, sheetSesiId) ?? null) : null}
        onClose={() => setSheetSesiId(null)}
      />
    </CheckInFlowContext.Provider>
  );
}

export function useCheckInFlow(): CheckInFlowValue {
  const value = useContext(CheckInFlowContext);
  if (!value) throw new Error('useCheckInFlow harus dipakai di dalam CheckInFlowProvider');
  return value;
}
