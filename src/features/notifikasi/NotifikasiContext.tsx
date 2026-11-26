/**
 * [SRS-017/SRS-018] Status push notification untuk praktikan yang login dengan Firebase.
 * - Meminta izin & mendaftarkan perangkat setelah login, lalu menyimpan token ke pushTokens/{uid}.
 * - Memeriksa ulang saat aplikasi kembali aktif (mis. setelah izin diaktifkan di Pengaturan).
 * - Membuka layar terkait saat notifikasi diketuk.
 */
import * as Notifications from 'expo-notifications';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { AppState, Platform } from 'react-native';

import { usePrakti } from '../../context/PraktiContext';
import { router, useRootNavigationState } from 'expo-router';
import { lepasRegistrasi, sinkronkanPerangkat } from './sinkronisasiPush';
import type { DataNotifikasi } from './pesan';
import { aturTampilanNotifikasi, type StatusPush } from './registrasiPush';
import { useResponNotifikasi } from './useResponNotifikasi';

aturTampilanNotifikasi();

interface NotifikasiContextValue {
  /** null bila notifikasi tidak relevan (asisten atau mode demo). */
  status: StatusPush | null;
  daftarUlang: () => void;
  /** Dipanggil sebelum logout agar perangkat berhenti menerima notifikasi akun ini. */
  lepasPerangkat: () => Promise<void>;
}

const NotifikasiContext = createContext<NotifikasiContextValue | null>(null);

export function NotifikasiProvider({ children }: { children: ReactNode }) {
  const { currentUser, practicum } = usePrakti();
  // Hanya praktikan yang login Firebase (bukan mode demo) yang menerima push
  const uid = currentUser?.role === 'praktikan' && practicum ? currentUser.praktikan.id : null;
  const [hasil, setHasil] = useState<{ uid: string; status: StatusPush } | null>(null);
  const berjalan = useRef<Promise<void> | null>(null);
  const permintaan = useRef(0);
  const sedangKeluar = useRef(false);

  const daftar = useCallback(
    (mintaIzin: boolean) => {
      if (!uid || sedangKeluar.current) return Promise.resolve();
      if (berjalan.current) return berjalan.current;
      const nomor = ++permintaan.current;
      const tugas = (async () => {
        const status = await sinkronkanPerangkat(uid, Platform.OS === 'ios' ? 'ios' : 'android', mintaIzin,
          () => nomor === permintaan.current);
        if (nomor === permintaan.current) setHasil({ uid, status });
      })().finally(() => { berjalan.current = null; });
      berjalan.current = tugas;
      return tugas;
    },
    [uid],
  );

  useEffect(() => {
    let aktif = true;
    const batalkan = () => { permintaan.current++; };
    sedangKeluar.current = false;
    // Wait for the previous account/request, also safe under Strict Mode effect replay.
    void (async () => {
      await berjalan.current;
      if (aktif && uid) await daftar(true);
    })();
    return () => { aktif = false; batalkan(); };
  }, [uid, daftar]);

  const status = useMemo(() => uid && hasil?.uid === uid ? hasil.status : uid ? ({ kind: 'memeriksa' } as const) : null, [uid, hasil]);
  const statusRef = useRef(status);
  useEffect(() => { statusRef.current = status; }, [status]);

  // Setelah pengguna mengubah izin di Pengaturan lalu kembali ke aplikasi, periksa ulang tanpa dialog
  useEffect(() => {
    if (!uid) return;
    const sub = AppState.addEventListener('change', (state) => {
      const kind = statusRef.current?.kind;
      if (state === 'active' && kind !== 'memeriksa') void daftar(false);
    });
    return () => sub.remove();
  }, [uid, daftar]);

  const daftarUlang = useCallback(() => void daftar(true), [daftar]);

  const lepasPerangkat = useCallback(async () => {
    sedangKeluar.current = true;
    permintaan.current++;
    await berjalan.current;
    if (!uid) return;
    try {
      await lepasRegistrasi(uid);
    } catch (err) {
      console.warn('Gagal menghapus token push:', err);
    }
  }, [uid]);

  useBukaLayarDariNotifikasi(uid);

  return (
    <NotifikasiContext.Provider value={{ status, daftarUlang, lepasPerangkat }}>
      {children}
    </NotifikasiContext.Provider>
  );
}

/** Mengetuk notifikasi membuka layar terkait (juga saat aplikasi dibuka dari notifikasi). */
function useBukaLayarDariNotifikasi(uid: string | null) {
  const respons = useResponNotifikasi();
  const rootNavigation = useRootNavigationState();
  const ditangani = useRef<string | null>(null);
  const [percobaan, setPercobaan] = useState(0);

  useEffect(() => {
    if (!uid || !respons || respons.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const id = respons.notification.request.identifier;
    if (ditangani.current === id) return;
    // Navigator praktikan bisa belum siap sesaat setelah login dipulihkan
    if (!rootNavigation?.key) {
      if (percobaan >= 20) return;
      const timer = setTimeout(() => setPercobaan((n) => n + 1), 300);
      return () => clearTimeout(timer);
    }
    ditangani.current = id;
    const data = respons.notification.request.content.data as Partial<DataNotifikasi> | undefined;
    if (data?.jenis === 'sesi_dibuka' && typeof data.sesiId === 'string') {
      router.push({ pathname: '/[role]/[screen]', params: { role: 'praktikan', screen: 'presensi', sesiId: data.sesiId } });
    } else if (data?.jenis === 'jadwal_berubah') {
      router.push('/praktikan/jadwal');
    } else if (data?.jenis === 'keputusan_izin') {
      router.push('/praktikan/status-izin');
    }
  }, [uid, respons, percobaan, rootNavigation?.key]);
}

export function useNotifikasi(): NotifikasiContextValue {
  const value = useContext(NotifikasiContext);
  if (!value) throw new Error('useNotifikasi harus dipakai di dalam NotifikasiProvider');
  return value;
}
