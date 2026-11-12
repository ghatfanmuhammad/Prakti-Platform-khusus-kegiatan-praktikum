import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '../../components/AppHeader';
import { EmptyState } from '../../components/EmptyState';
import { FilterChips } from '../../components/FilterChips';
import { ProgressBar } from '../../components/ProgressBar';
import { SegmentedControl } from '../../components/SegmentedControl';
import { StatusPill } from '../../components/StatusPill';
import { useCurrentAsisten, usePrakti } from '../../context/PraktiContext';
import type { AppStackParamList } from '../../navigation/types';
import { colors, radius, spacing, typography } from '../../theme';
import { formatJamDetik } from '../../utils/date';
import { cariSesi, rekapSesi, sesiMilikAsisten, sesiUntukRekap } from '../../utils/selectors';
import { toTitleCase } from '../../utils/text';

type Tab = 'hadir' | 'belum';

type Props = NativeStackScreenProps<AppStackParamList, 'Recap'>;

export function RecapScreen({ navigation, route }: Props) {
  const asisten = useCurrentAsisten();
  const { sesi, presensi, praktikanList } = usePrakti();
  const [tab, setTab] = useState<Tab>('hadir');
  const [pilihan, setPilihan] = useState<string | undefined>(route.params?.sesiId);

  if (!asisten) return null;

  const milik = sesiMilikAsisten(sesi, asisten.id);
  const aktif = (pilihan ? cariSesi(milik, pilihan) : undefined) ?? sesiUntukRekap(milik);

  if (!aktif) {
    return (
      <View style={styles.root}>
        <AppHeader subtitle="Rekap Kehadiran" onBack={navigation.goBack} />
        <EmptyState
          icon="clipboard-outline"
          title="Belum ada rekap"
          description="Rekap muncul setelah kamu membuka sesi."
        />
      </View>
    );
  }

  const rekap = rekapSesi(presensi, aktif.id, praktikanList);
  const total = praktikanList.length;
  const rows = tab === 'hadir' ? rekap.hadir.map((h) => ({ key: h.praktikan.id, nama: h.praktikan.nama, nim: h.praktikan.nim, waktu: h.presensi.waktuHadir })) : rekap.belumHadir.map((p) => ({ key: p.id, nama: p.nama, nim: p.nim, waktu: null as string | null }));

  return (
    <View style={styles.root}>
      <AppHeader subtitle="Rekap Kehadiran" onBack={navigation.goBack} />
      {milik.length > 1 ? (
        <FilterChips
          options={milik.map((s) => ({ key: s.id, label: `${s.praktikum} ${s.kelas}` }))}
          selected={aktif.id}
          onSelect={setPilihan}
        />
      ) : null}
      <View style={styles.summary}>
        <View style={styles.summaryTop}>
          <Text style={styles.summaryTitle}>
            {aktif.praktikum} · Kelas {aktif.kelas}
          </Text>
          <StatusPill status={aktif.status} />
        </View>
        <Text style={styles.count}>
          {rekap.hadir.length}/{total} hadir
        </Text>
        <ProgressBar value={total === 0 ? 0 : rekap.hadir.length / total} />
      </View>
      <View style={styles.segment}>
        <SegmentedControl<Tab>
          options={[
            { key: 'hadir', label: `Hadir (${rekap.hadir.length})` },
            { key: 'belum', label: `Belum (${rekap.belumHadir.length})` },
          ]}
          value={tab}
          onChange={setTab}
        />
      </View>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.key}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState
            icon={tab === 'hadir' ? 'people-outline' : 'checkmark-done-outline'}
            title={tab === 'hadir' ? 'Belum ada yang hadir' : 'Semua praktikan sudah hadir'}
          />
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.name}>{toTitleCase(item.nama)}</Text>
              <Text style={styles.nim}>{item.nim}</Text>
            </View>
            {item.waktu ? <Text style={styles.time}>{formatJamDetik(item.waktu)}</Text> : null}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  summary: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  summaryTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryTitle: { ...typography.bodyBold, color: colors.textPrimary, flex: 1, marginRight: spacing.sm },
  count: { ...typography.title, color: colors.textPrimary },
  segment: { padding: spacing.lg },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, flexGrow: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowText: { flex: 1 },
  name: { ...typography.bodyBold, color: colors.textPrimary },
  nim: { ...typography.caption, color: colors.textSecondary },
  time: { ...typography.captionBold, color: colors.successText },
});
