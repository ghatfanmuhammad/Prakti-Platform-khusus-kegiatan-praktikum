import { useCallback } from 'react';

import { useApp } from '@/context/app-context';

/** Buka/tutup sesi (SRS-004). State sesi diambil dari Context bersama (SRS-002). */
export function useSessionManager() {
  const { jadwal: sessions, setJadwal: setSessions } = useApp();

  /**
   * Membuka sesi praktikum yang berstatus 'belum_dibuka'.
   * Sesi yang berstatus 'ditutup' atau sudah 'dibuka' ditolak di level fungsi.
   */
  const bukaSesi = useCallback((id: string) => {
    setSessions((prevSessions) =>
      prevSessions.map((session) => {
        if (session.id !== id) return session;

        // Validasi: hanya boleh jika status saat ini 'belum_dibuka'
        if (session.status !== 'belum_dibuka') {
          console.warn(`[SRS-004] Sesi ${id} tidak dapat dibuka karena statusnya adalah "${session.status}".`);
          return session;
        }

        return { ...session, status: 'dibuka' };
      })
    );
  }, [setSessions]);

  /**
   * Menutup sesi praktikum yang berstatus 'dibuka'.
   * Sesi yang sudah 'ditutup' tidak dapat ditutup ulang.
   */
  const tutupSesi = useCallback((id: string) => {
    setSessions((prevSessions) =>
      prevSessions.map((session) => {
        if (session.id !== id) return session;

        // Validasi: hanya boleh jika status saat ini 'dibuka'
        if (session.status !== 'dibuka') {
          console.warn(`[SRS-004] Sesi ${id} tidak dapat ditutup karena statusnya adalah "${session.status}".`);
          return session;
        }

        return { ...session, status: 'ditutup' };
      })
    );
  }, [setSessions]);

  return {
    sessions,
    bukaSesi,
    tutupSesi,
  };
}
