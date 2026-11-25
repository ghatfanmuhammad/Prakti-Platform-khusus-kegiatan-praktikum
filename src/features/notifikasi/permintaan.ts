/** Only document identifiers cross the client/server boundary; never tokens or recipient UIDs. */
export type PermintaanNotifikasi =
  | { jenis: 'sesi_dibuka' | 'sesi_dijadwal_ulang'; classId: string; sessionId: string }
  | { jenis: 'jadwal_berubah'; classId: string; scheduleId: string }
  | { jenis: 'keputusan_izin'; izinId: string };
