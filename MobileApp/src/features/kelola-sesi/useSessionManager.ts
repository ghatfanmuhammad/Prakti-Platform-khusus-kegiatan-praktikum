// SEMENTARA, ganti dengan state sesi di Context dari chore/setup-project saat sudah di-merge
import { useState, useCallback } from 'react';
import { DUMMY_SESSIONS, Session } from '@/features/jadwal/temp-data';

export function useSessionManager(initialSessions: Session[] = DUMMY_SESSIONS) {
  const [sessions, setSessions] = useState<Session[]>(initialSessions);

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
  }, []);

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
  }, []);

  /**
   * Fungsi pembantu untuk mereset data sesi kembali ke dummy awal (berguna untuk pengujian)
   */
  const resetSessions = useCallback(() => {
    setSessions(initialSessions);
  }, [initialSessions]);

  return {
    sessions,
    setSessions,
    bukaSesi,
    tutupSesi,
    resetSessions,
  };
}
