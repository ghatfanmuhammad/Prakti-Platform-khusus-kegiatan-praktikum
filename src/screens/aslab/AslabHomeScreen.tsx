<<<<<<< HEAD
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '../../components/AppHeader';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { MenuGrid } from '../../components/MenuGrid';
import { ProfileCard } from '../../components/ProfileCard';
import { useCurrentAslab, usePrakti } from '../../context/PraktiContext';
import { PracticumLoading } from '../../features/data-praktikum/PracticumLoading';
import { useLabPraktikum } from '../../features/laboratorium/hooks';
import type { AppStackParamList, TabParamList } from '../../navigation/types';
import { colors, spacing, typography } from '../../theme';

type Props = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'Beranda'>,
  NativeStackScreenProps<AppStackParamList>
>;

/** Beranda utama Aslab untuk mengelola Lab, praktikan, Asprak, jadwal, dan peta (SRS-020..023). */
export function AslabHomeScreen({ navigation }: Props) {
  const aslab = useCurrentAslab();
  const { practicum } = usePrakti();
  const labs = useLabPraktikum(aslab?.id ?? null, !practicum);
  if (!aslab) return null;

  return (
    <View style={styles.root}>
      <AppHeader subtitle="Beranda Aslab" />
      <ScrollView contentContainerStyle={styles.content}>
        <ProfileCard
          nama={aslab.nama}
          highlight="Aslab"
          detail={`${labs.data.length} Lab dikelola`}
        />

        <MenuGrid
          items={[
            {
              key: 'kelolalab',
              label: 'Kelola Lab',
              icon: 'business-outline',
              onPress: () => navigation.navigate('KelolaLab'),
            },
            {
              key: 'imporlab',
              label: 'Impor Lab',
              icon: 'cloud-upload-outline',
              onPress: () => navigation.navigate('ImporLab'),
            },
            {
              key: 'praktikan',
              label: 'Praktikan',
              icon: 'people-outline',
              onPress: () => navigation.navigate('ImporPraktikan'),
            },
            {
              key: 'asprak',
              label: 'Asprak',
              icon: 'school-outline',
              onPress: () => navigation.navigate('ImporAsprak'),
            },
            {
              key: 'jadwal',
              label: 'Jadwal',
              icon: 'calendar-outline',
              onPress: () => navigation.navigate('Schedule'),
            },
            {
              key: 'maps',
              label: 'Maps',
              icon: 'map-outline',
              onPress: () => navigation.navigate('Maps'),
            },
            {
              key: 'profil',
              label: 'Profil',
              icon: 'person-outline',
              onPress: () => navigation.navigate('Tabs', { screen: 'Profil' }),
            },
          ]}
        />

        <Text style={styles.section}>Lab Saya</Text>
        {labs.loading || labs.error ? (
          <PracticumLoading error={labs.error} onRetry={labs.retry} />
        ) : labs.data.length === 0 ? (
          <EmptyState
            icon="business-outline"
            title="Belum ada Lab"
            description="Tambahkan Lab melalui menu Kelola Lab atau Impor Lab."
          />
        ) : (
          labs.data.map((lab) => (
            <Card key={lab.id} style={styles.labCard}>
              <Text style={styles.labTitle}>
                {lab.namaLab} ({lab.kode})
              </Text>
              <Text style={styles.labSub}>{lab.namaPraktikum}</Text>
              <Text style={styles.labMeta}>
                {lab.lokasi} · Toleransi {lab.toleransiMenit} mnt · Denda Rp
                {lab.nominalDenda.toLocaleString('id-ID')}
              </Text>
              <Text style={styles.labMeta}>
                {lab.participantCount} peserta · {lab.scheduleCount} jadwal · {lab.sessionCount} sesi
              </Text>
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl },
  section: { ...typography.title, color: colors.textPrimary },
  labCard: { gap: 4 },
  labTitle: { ...typography.subtitle, color: colors.textPrimary },
  labSub: { ...typography.bodyBold, color: colors.navyMuted },
  labMeta: { ...typography.caption, color: colors.textSecondary },
});
=======
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
>>>>>>> origin/main
