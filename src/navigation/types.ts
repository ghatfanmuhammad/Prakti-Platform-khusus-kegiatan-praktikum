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
  /** Hanya praktikan: halaman presensi untuk satu sesi (SRS-012). */
  Presensi: { sesiId: string };
  /** Hanya praktikan. */
  History: undefined;
  /** Hanya praktikan: status pengajuan izin & keputusan asisten (SRS-011). */
  StatusIzin: undefined;
  /** Hanya praktikan: form pengajuan izin (SRS-010). */
  AjukanIzin: undefined;
};
