// SRS-003 & SRS-005: detail sesi + presensi praktikan
import { useLocalSearchParams, useRouter } from 'expo-router';

import { useApp } from '@/context/app-context';
import { DetailSesiScreen } from '@/features/jadwal';
import { PresensiPanel } from '@/features/presensi';

export default function DetailSesiPraktikan() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { pengguna, jadwal, presensi, catatPresensi } = useApp();
  const session = jadwal.find((s) => s.id === id) ?? null;
  const catatan = presensi.find((p) => p.jadwalId === id && p.praktikanId === pengguna?.id) ?? null;

  return (
    <DetailSesiScreen
      session={session}
      onBack={() => router.back()}
      actionSlot={
        session ? (
          <PresensiPanel
            namaPraktikum={session.praktikum}
            statusSesi={session.status}
            catatan={catatan}
            onPresensi={(waktuHadir) => catatPresensi(session.id, waktuHadir)}
          />
        ) : null
      }
    />
  );
}
