import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '../../components/AppHeader';
import { Card } from '../../components/Card';
import { DateChip } from '../../components/DateChip';
import { EmptyState } from '../../components/EmptyState';
import { InfoRow } from '../../components/InfoRow';
import { MenuGrid } from '../../components/MenuGrid';
import { NextSessionRow } from '../../components/NextSessionRow';
import { ProfileCard } from '../../components/ProfileCard';
import { ProgressBar } from '../../components/ProgressBar';
import { StatusPill } from '../../components/StatusPill';
import { useCurrentPraktikan, usePrakti } from '../../context/PraktiContext';
import { useCheckInFlow } from '../../features/praktikan/CheckInFlow';
import { PraktikanSessionPanel } from '../../features/praktikan/PraktikanSessionPanel';
import type { AppStackParamList, TabParamList } from '../../navigation/types';
import { colors, spacing, typography } from '../../theme';
import { formatTanggalRelatif } from '../../utils/date';
import { sesiBerikutnya, sesiUtama, statistikKehadiran } from '../../utils/selectors';
import { toTitleCase } from '../../utils/text';

type Props = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'Beranda'>,
  NativeStackScreenProps<AppStackParamList>
>;

export function PraktikanHomeScreen({ navigation }: Props) {
  const praktikan = useCurrentPraktikan();
  const { sesi, presensi } = usePrakti();
  const { mulai } = useCheckInFlow();
  if (!praktikan) return null;

  const utama = sesiUtama(sesi);
  const berikut = sesiBerikutnya(sesi, utama);
  const stat = statistikKehadiran(sesi, presensi, praktikan.id);

  return (
    <View style={styles.root}>
      <AppHeader subtitle="Beranda Praktikan" />
      <ScrollView contentContainerStyle={styles.content}>
        <ProfileCard
          nama={toTitleCase(praktikan.nama)}
          highlight={`NIM ${praktikan.nim}`}
          detail="Praktikan"
        />
        <MenuGrid
          items={[
            { key: 'jadwal', label: 'Jadwal', icon: 'calendar-outline', onPress: () => navigation.navigate('Schedule') },
            { key: 'presensi', label: 'Presensi', icon: 'qr-code-outline', onPress: mulai },
            { key: 'riwayat', label: 'Riwayat', icon: 'time-outline', onPress: () => navigation.navigate('History') },
          ]}
        />

        <Card>
          <Text style={styles.cardLabel}>Kehadiran</Text>
          <Text style={styles.stat}>
            {stat.hadir}/{stat.total} sesi selesai
          </Text>
          <ProgressBar value={stat.rasio ?? 0} />
          {stat.rasio === null ? <Text style={styles.cardHint}>Belum ada sesi yang selesai.</Text> : null}
        </Card>

        <Text style={styles.section}>Sesi Mendatang</Text>
        {utama ? (
          <Card>
            <View style={styles.titleRow}>
              <View style={styles.titleText}>
                <Text style={styles.title}>{utama.praktikum}</Text>
                <Text style={styles.kelas}>Kelas {utama.kelas}</Text>
              </View>
              <StatusPill status={utama.status} />
            </View>
            <View style={styles.info}>
              <DateChip label={formatTanggalRelatif(utama.tanggal)} />
              <InfoRow icon="time-outline" text={`${utama.mulai} - ${utama.selesai}`} />
              <InfoRow icon="location-outline" text={utama.ruang} />
            </View>
            <View style={styles.panel}>
              <PraktikanSessionPanel sesi={utama} />
            </View>
            {berikut ? (
              <View style={styles.next}>
                <NextSessionRow
                  sesi={berikut}
                  onPress={() => navigation.navigate('SessionDetail', { sesiId: berikut.id })}
                />
              </View>
            ) : null}
          </Card>
        ) : (
          <EmptyState
            icon="calendar-outline"
            title="Belum ada jadwal"
            description="Belum ada sesi praktikum yang akan datang."
          />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xl * 2 },
  section: { ...typography.title, color: colors.textPrimary },
  cardLabel: { ...typography.caption, color: colors.textSecondary },
  stat: { ...typography.title, color: colors.textPrimary, marginBottom: spacing.sm },
  cardHint: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  titleText: { flex: 1, marginRight: spacing.md },
  title: { ...typography.title, color: colors.textPrimary },
  kelas: { ...typography.captionBold, color: colors.accentText },
  info: { marginTop: spacing.md, gap: spacing.sm },
  panel: { marginTop: spacing.lg },
  next: { marginTop: spacing.lg },
});
