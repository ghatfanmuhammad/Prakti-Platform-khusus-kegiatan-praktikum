// SRS-003 & SRS-004: detail sesi + buka/tutup sesi oleh asisten
import { useLocalSearchParams, useRouter } from 'expo-router';

import { DetailSesiScreen } from '@/features/jadwal';
import { useSessionManager } from '@/features/kelola-sesi';

export default function DetailSesiAsisten() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { sessions, bukaSesi, tutupSesi } = useSessionManager();
  const session = sessions.find((s) => s.id === id) ?? null;

  return (
    <DetailSesiScreen
      session={session}
      onBack={() => router.back()}
      onBukaSesi={bukaSesi}
      onTutupSesi={tutupSesi}
    />
  );
}
