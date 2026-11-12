// SRS-003: daftar jadwal praktikum
import { useRouter } from 'expo-router';

import { useApp } from '@/context/app-context';
import { JadwalScreen } from '@/features/jadwal';

export default function JadwalList() {
  const router = useRouter();
  const { jadwal } = useApp();
  return (
    <JadwalScreen
      sessions={jadwal}
      onPressItem={(id) => router.push({ pathname: '/(praktikan)/jadwal/[id]', params: { id } })}
    />
  );
}
