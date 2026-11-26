import type { NavigatorScreenParams } from '@react-navigation/native';

export type TabParamList = {
  Beranda: undefined;
  Profil: undefined;
};

/** Satu daftar rute dipakai bersama oleh navigator asisten dan praktikan. */
export type AppStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
  Schedule: undefined;
  SessionDetail: { sesiId: string };
  /** Hanya asisten. sesiId kosong berarti sesi paling relevan. */
  Recap: { sesiId?: string } | undefined;
  /** Hanya asisten: Pemeriksaan pengajuan izin praktikan (SRS-011). */
  PemeriksaanIzin: undefined;
  /** Peta laboratorium (SRS-015/016), semua peran. */
  Maps: undefined;
  /** Hanya Aslab: kelola Lab, lokasi, dan kebijakan presensi (SRS-020). */
  KelolaLab: undefined;
  /** Hanya Aslab: bulk & single insert Lab per mata kuliah (SRS-021). */
  ImporLab: undefined;
  /** Hanya Aslab: insert & pindah praktikan antar-Lab (SRS-022). */
  ImporPraktikan: { classId?: string } | undefined;
  /** Hanya Aslab: tugaskan & pindah Asprak antar-Lab (SRS-023). */
  ImporAsprak: { classId?: string } | undefined;
  /** Hanya praktikan: halaman presensi untuk satu sesi (SRS-012). */
  Presensi: { sesiId: string };
  /** Hanya praktikan. */
  History: undefined;
  /** Hanya praktikan: status pengajuan izin & keputusan asisten (SRS-011). */
  StatusIzin: undefined;
  /** Hanya praktikan: form pengajuan izin (SRS-010). */
  AjukanIzin: undefined;
};


/** Compatibility props for existing screens, backed exclusively by Expo Router. */
export interface AppNavigation {
  navigate: <K extends keyof AppStackParamList>(name: K, params?: AppStackParamList[K]) => void;
  popTo: <K extends keyof AppStackParamList>(name: K, params?: AppStackParamList[K]) => void;
  goBack: () => void;
}
export type ScreenProps<K extends keyof AppStackParamList> = { navigation: AppNavigation; route: { params: AppStackParamList[K] } };
