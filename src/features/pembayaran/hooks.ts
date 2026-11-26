import { useEffect, useState } from 'react';

import { usePrakti } from '../../context/PraktiContext';
import { formatMuatError, subscribeDenda, subscribePembayaran, type HasilLangganan } from '../../services/pembayaranService';
import type { Denda, Pembayaran } from './kontrak';

interface StatusLangganan<T> {
  daftar: T[];
  loading: boolean;
  error: string | null;
  dariCache: boolean;
  /** false di mode demo: tagihan butuh akun Firebase. */
  tersedia: boolean;
  ulangi: () => void;
}

type Langganan<T> = (
  uid: string,
  onData: (hasil: HasilLangganan<T>) => void,
  onError: (err: unknown) => void,
) => () => void;

function useLangganan<T>(langganan: Langganan<T>, nama: string): StatusLangganan<T> {
  const { currentUser, practicum } = usePrakti();
  const uid = currentUser?.role === 'praktikan' && practicum ? currentUser.praktikan.id : null;
  const [state, setState] = useState<{ uid: string | null; daftar: T[]; dariCache: boolean; error: string | null } | null>(null);
  const [percobaan, setPercobaan] = useState(0);

  useEffect(() => {
    if (!uid) return;
    // Data Firestore tersimpan di cache SDK, jadi riwayat tetap tampil setelah aplikasi dibuka ulang.
    return langganan(
      uid,
      (hasil) => setState({ uid, daftar: hasil.daftar, dariCache: hasil.dariCache, error: null }),
      (err) => {
        console.warn(`Gagal memuat ${nama}:`, err);
        setState({ uid, daftar: [], dariCache: false, error: formatMuatError(err) });
      },
    );
  }, [uid, percobaan, langganan, nama]);

  const aktif = state && state.uid === uid ? state : null;
  return {
    daftar: aktif?.daftar ?? [],
    loading: !!uid && !aktif,
    error: aktif?.error ?? null,
    dariCache: aktif?.dariCache ?? false,
    tersedia: !!uid,
    ulangi: () => {
      setState(null);
      setPercobaan((n) => n + 1);
    },
  };
}

export const useDenda = () => useLangganan<Denda>(subscribeDenda, 'tagihan');
export const usePembayaran = () => useLangganan<Pembayaran>(subscribePembayaran, 'riwayat pembayaran');
