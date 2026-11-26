import { ScrollView, Text } from 'react-native';
import { router } from 'expo-router';
import { AppHeader } from '../../components/AppHeader';
import { Button } from '../../components/Button';
import { usePrakti } from '../../context/PraktiContext';
import { spacing } from '../../theme';

export function AslabHomeScreen() {
  const { currentUser } = usePrakti();
  return <><AppHeader subtitle="Beranda Aslab" /><ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
    <Text>{currentUser?.role === 'aslab' ? currentUser.asisten.nama : ''}</Text>
    <Button label="Lab dan kelas milik saya" onPress={() => router.push('/aslab/data')} />
    <Button label="Rekap kelas" onPress={() => router.push('/aslab/rekap')} />
    <Button label="Profil" onPress={() => router.push('/aslab/profile')} />
  </ScrollView></>;
}
