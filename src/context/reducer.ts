import { PRESENSI_AWAL, SESI_AWAL } from '../data';
import type { CurrentUser, Presensi, Sesi } from '../types';

export interface PraktiState {
  currentUser: CurrentUser | null;
  sesi: Sesi[];
  presensi: Presensi[];
}

export type PraktiAction =
  | { type: 'MASUK'; user: CurrentUser }
  | { type: 'KELUAR' }
  | { type: 'BUKA_SESI'; sesiId: string; topik: string | null; kode: string }
  | { type: 'TUTUP_SESI'; sesiId: string }
  | { type: 'TAMBAH_PRESENSI'; presensi: Presensi };

export const initialState: PraktiState = {
  currentUser: null,
  sesi: SESI_AWAL,
  presensi: PRESENSI_AWAL,
};

const ubahSesi = (daftar: Sesi[], sesiId: string, ubah: (sesi: Sesi) => Sesi): Sesi[] =>
  daftar.map((s) => (s.id === sesiId ? ubah(s) : s));

export function praktiReducer(state: PraktiState, action: PraktiAction): PraktiState {
  switch (action.type) {
    case 'MASUK':
      return { ...state, currentUser: action.user };

    case 'KELUAR':
      return { ...state, currentUser: null };

    case 'BUKA_SESI':
      // Hanya sesi yang belum dibuka yang boleh dibuka; sesi yang ditutup tidak bisa dibuka ulang.
      return {
        ...state,
        sesi: ubahSesi(state.sesi, action.sesiId, (s) =>
          s.status === 'belum_dibuka'
            ? { ...s, status: 'dibuka', topik: action.topik, kode: action.kode }
            : s,
        ),
      };

    case 'TUTUP_SESI':
      return {
        ...state,
        sesi: ubahSesi(state.sesi, action.sesiId, (s) =>
          s.status === 'dibuka' ? { ...s, status: 'ditutup' } : s,
        ),
      };

    case 'TAMBAH_PRESENSI': {
      const { sesiId, praktikanId } = action.presensi;
      const sudahAda = state.presensi.some(
        (p) => p.sesiId === sesiId && p.praktikanId === praktikanId,
      );
      return sudahAda ? state : { ...state, presensi: [...state.presensi, action.presensi] };
    }
  }
}
