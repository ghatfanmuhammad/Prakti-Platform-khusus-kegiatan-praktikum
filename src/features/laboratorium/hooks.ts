import { useEffect, useState } from 'react';

import type { Laboratorium } from './models';
import { formatLabError, subscribeLaboratorium } from './repository';

export interface LabState {
  data: Laboratorium[];
  loading: boolean;
  error: string | null;
  /** Panggil untuk memasang ulang listener setelah gagal. */
  retry: () => void;
}

/** Daftar laboratorium real-time (dipakai layar kelola lab, Maps, dan form jadwal). */
export function useLaboratorium(): LabState {
  const [data, setData] = useState<Laboratorium[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [percobaan, setPercobaan] = useState(0);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const unsubscribe = subscribeLaboratorium(
      (daftar) => {
        setData(daftar);
        setLoading(false);
      },
      (err) => {
        console.warn('Gagal memuat laboratorium:', err);
        setError(formatLabError(err));
        setLoading(false);
      },
    );
    return unsubscribe;
  }, [percobaan]);

  return { data, loading, error, retry: () => setPercobaan((n) => n + 1) };
}