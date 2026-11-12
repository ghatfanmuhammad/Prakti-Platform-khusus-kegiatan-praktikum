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
import { StatusPill } from '../../components/StatusPill';
import { useCurrentAsisten, usePrakti } from '../../context/PraktiContext';
import { AsistenSessionPanel } from '../../features/asisten/AsistenSessionPanel';
import type { AppStackParamList, TabParamList } from '../../navigation/types';
import { colors, spacing, typography } from '../../theme';
import { formatTanggalRelatif } from '../../utils/date';
import { sesiBerikutnya, sesiMilikAsisten, sesiUtama } from '../../utils/selectors';

type Props = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'Beranda'>,
  NativeStackScreenProps<AppStackParamList>
>;

export function AsistenHomeScreen({ navigation }: Props) {
  const asisten = useCurrentAsisten();
  const { sesi } = usePrakti();
  if (!asisten) return null;

  const milik = sesiMilikAsisten(sesi, asisten.id);
  const utama = sesiUtama(milik);
  const berikut = sesiBerikutnya(milik, utama);

  return (
    <View style={styles.root}>
      <AppHeader subtitle="Beranda Asisten" />
      <ScrollView contentContainerStyle={styles.content}>
        <ProfileCard nama={asisten.nama} highlight="Asisten Praktikum" detail="Laboratorium Komputer" />
        <MenuGrid
          items={[
            { key: 'jadwal', label: 'Jadwal', icon: 'calendar-outline', onPress: () => navigation.navigate('Schedule') },
            { key: 'rekap', label: 'Rekap', icon: 'list-outline', onPress: () => navigation.navigate('Recap') },
            { key: 'izin', label: 'Cek Izin', icon: 'document-text-outline', onPress: () => navigation.navigate('PemeriksaanIzin') },
            { key: 'profil', label: 'Profil', icon: 'person-outline', onPress: () => navigation.navigate('Tabs', { screen: 'Profil' }) },
          ]}
        />

        <Text style={styles.section}>Sesi Berjalan</Text>
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
              <AsistenSessionPanel sesi={utama} />
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
            title="Belum ada sesi aktif"
            description="Semua sesi sudah selesai. Lihat rekap di menu Jadwal."
          />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg },
  section: { ...typography.title, color: colors.textPrimary },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  titleText: { flex: 1, marginRight: spacing.md },
  title: { ...typography.title, color: colors.textPrimary },
  kelas: { ...typography.captionBold, color: colors.accentText },
  info: { marginTop: spacing.md, gap: spacing.sm },
  panel: { marginTop: spacing.lg },
  next: { marginTop: spacing.lg },
});
