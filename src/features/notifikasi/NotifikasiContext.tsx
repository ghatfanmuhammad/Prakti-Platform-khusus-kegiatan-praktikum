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
  useState,
  type ReactNode,
} from 'react';
import { AppState, Platform } from 'react-native';

import { usePrakti } from '../../context/PraktiContext';
import { navigationRef } from '../../navigation/navigationRef';
import { hapusTokenPerangkat, simpanTokenPerangkat } from '../../services/notifikasiService';
import type { DataNotifikasi } from './pesan';
import { aturTampilanNotifikasi, daftarkanPerangkat, type StatusPush } from './registrasiPush';

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
  const terdaftar = useRef<{ uid: string; token: string } | null>(null);
  const permintaan = useRef(0);

  const daftar = useCallback(
    async (mintaIzin: boolean) => {
      if (!uid) return;
      const nomor = ++permintaan.current;
      setHasil((prev) => (prev?.uid === uid && !mintaIzin ? prev : { uid, status: { kind: 'memeriksa' } }));
      let status = await daftarkanPerangkat(mintaIzin);
      if (status.kind === 'aktif') {
        try {
          await simpanTokenPerangkat(uid, status.token, Platform.OS === 'ios' ? 'ios' : 'android');
          terdaftar.current = { uid, token: status.token };
        } catch (err) {
          console.warn('Gagal menyimpan token push:', err);
          status = {
            kind: 'gagal',
            pesan: 'Perangkat gagal didaftarkan ke server PRAKTI. Periksa koneksi internet lalu coba lagi.',
          };
        }
      }
      if (nomor === permintaan.current) setHasil({ uid, status });
    },
    [uid],
  );

  useEffect(() => {
    if (uid) void daftar(true);
  }, [uid, daftar]);

  const status = uid && hasil?.uid === uid ? hasil.status : uid ? ({ kind: 'memeriksa' } as const) : null;
  const statusRef = useRef(status);
  statusRef.current = status;

  // Setelah pengguna mengubah izin di Pengaturan lalu kembali ke aplikasi, periksa ulang tanpa dialog
  useEffect(() => {
    if (!uid) return;
    const sub = AppState.addEventListener('change', (state) => {
      const kind = statusRef.current?.kind;
      if (state === 'active' && (kind === 'izin_ditolak' || kind === 'gagal')) void daftar(false);
    });
    return () => sub.remove();
  }, [uid, daftar]);

  const daftarUlang = useCallback(() => void daftar(true), [daftar]);

  const lepasPerangkat = useCallback(async () => {
    const token = terdaftar.current;
    terdaftar.current = null;
    if (!token) return;
    try {
      await hapusTokenPerangkat(token.uid, token.token);
    } catch (err) {
      console.warn('Gagal menghapus token push:', err);
    }
  }, []);

  useBukaLayarDariNotifikasi(uid);

  return (
    <NotifikasiContext.Provider value={{ status, daftarUlang, lepasPerangkat }}>
      {children}
    </NotifikasiContext.Provider>
  );
}

/** Mengetuk notifikasi membuka layar terkait (juga saat aplikasi dibuka dari notifikasi). */
function useBukaLayarDariNotifikasi(uid: string | null) {
  const respons = Notifications.useLastNotificationResponse();
  const ditangani = useRef<string | null>(null);
  const [percobaan, setPercobaan] = useState(0);

  useEffect(() => {
    if (!uid || !respons || respons.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const id = respons.notification.request.identifier;
    if (ditangani.current === id) return;
    // Navigator praktikan bisa belum siap sesaat setelah login dipulihkan
    if (!navigationRef.isReady()) {
      if (percobaan >= 20) return;
      const timer = setTimeout(() => setPercobaan((n) => n + 1), 300);
      return () => clearTimeout(timer);
    }
    ditangani.current = id;
    const data = respons.notification.request.content.data as Partial<DataNotifikasi> | undefined;
    if (data?.jenis === 'sesi_dibuka' && typeof data.sesiId === 'string') {
      navigationRef.navigate('Presensi', { sesiId: data.sesiId });
    } else if (data?.jenis === 'jadwal_berubah') {
      navigationRef.navigate('Schedule');
    } else if (data?.jenis === 'keputusan_izin') {
      navigationRef.navigate('StatusIzin');
    }
  }, [uid, respons, percobaan]);
}

export function useNotifikasi(): NotifikasiContextValue {
  const value = useContext(NotifikasiContext);
  if (!value) throw new Error('useNotifikasi harus dipakai di dalam NotifikasiProvider');
  return value;
}
