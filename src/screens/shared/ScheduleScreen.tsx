import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '../../components/AppHeader';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { FilterChips, type ChipOption } from '../../components/FilterChips';
import { SessionCard } from '../../components/SessionCard';
import { usePrakti } from '../../context/PraktiContext';
import { DataPraktikumScreen } from '../../features/data-praktikum/DataPraktikumScreen';
import { PracticumLoading } from '../../features/data-praktikum/PracticumLoading';
import type { ScreenProps } from '../../navigation/types';
import { colors, spacing, typography } from '../../theme';
import { cariPresensi, presensiSesi, sesiMilikAsisten, urutkanSesi } from '../../utils/selectors';

type Filter = 'semua' | 'dibuka' | 'belum_dibuka' | 'ditutup';

const OPSI: ChipOption<Filter>[] = [
  { key: 'semua', label: 'Semua' },
  { key: 'dibuka', label: 'Dibuka' },
  { key: 'belum_dibuka', label: 'Belum dibuka' },
  { key: 'ditutup', label: 'Ditutup' },
];

type Props = ScreenProps<'Schedule'>;

export function ScheduleScreen({ navigation }: Props) {
  const { currentUser, sesi, presensi, pesertaSesi, practicum, retryPracticum } = usePrakti();
  const [showData, setShowData] = useState(false);
  const [filter, setFilter] = useState<Filter>('semua');

  const milik =
    currentUser?.role === 'asprak' && !practicum
      ? sesiMilikAsisten(sesi, currentUser.asisten.id)
      : urutkanSesi(sesi);
  const data = filter === 'semua' ? milik : milik.filter((s) => s.status === filter);

  if (showData && practicum) {
    return <DataPraktikumScreen onBack={() => setShowData(false)} />;
  }

  return (
    <View style={styles.root}>
      <AppHeader subtitle="Jadwal Praktikum" onBack={navigation.goBack} />
      {practicum ? (
        <Button
<<<<<<< HEAD
          label={currentUser?.role === 'aslab' ? 'Kelola data praktikum' : 'Lihat jadwal per kelas'}
          icon={currentUser?.role === 'aslab' ? 'settings-outline' : 'list-outline'}

=======
          label={currentUser?.role === 'asprak' ? 'Kelola data praktikum' : 'Lihat jadwal per kelas'}
          icon={currentUser?.role === 'asprak' ? 'settings-outline' : 'list-outline'}
>>>>>>> origin/main
          variant="outline"
          style={styles.manage}
          onPress={() => setShowData(true)}
        />
      ) : null}
      {practicum && (practicum.loading || practicum.error) ? (
        <PracticumLoading error={practicum.error} onRetry={retryPracticum} />
      ) : (
        <>
          <FilterChips options={OPSI} selected={filter} onSelect={setFilter} />
          <FlatList
            data={data}
            keyExtractor={(s) => s.id}
            contentContainerStyle={styles.list}
            ItemSeparatorComponent={() => <View style={styles.gap} />}
            ListEmptyComponent={
              <EmptyState
                icon="calendar-outline"
                title="Belum ada jadwal"
                description="Tidak ada sesi yang cocok dengan filter ini."
              />
            }
            renderItem={({ item }) => {
              let footer = null;
<<<<<<< HEAD
              if (currentUser?.role === 'aslab' || currentUser?.role === 'asprak' || currentUser?.role === 'asisten') {
=======
              if (currentUser?.role === 'asprak') {
>>>>>>> origin/main
                footer = (
                  <Text style={styles.footer}>
                    {presensiSesi(presensi, item.id).length}/{pesertaSesi(item).length} hadir
                  </Text>
                );
              } else if (currentUser?.role === 'praktikan' && cariPresensi(presensi, item.id, currentUser.praktikan.id)) {
                footer = (
                  <View style={styles.footerRow}>
                    <Ionicons name="checkmark-circle" size={16} color={colors.successText} />
                    <Text style={[styles.footer, { color: colors.successText }]}>Sudah hadir</Text>
                  </View>
                );
              }
              return (
                <SessionCard
                  sesi={item}
                  footer={footer}
                  onPress={() => navigation.navigate('SessionDetail', { sesiId: item.id })}
                />
              );
            }}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  manage: { marginHorizontal: spacing.lg, marginTop: spacing.md },
  list: { padding: spacing.lg, flexGrow: 1 },
  gap: { height: spacing.md },
  footer: { ...typography.captionBold, color: colors.textPrimary },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
