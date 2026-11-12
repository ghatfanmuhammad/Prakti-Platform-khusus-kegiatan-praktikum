import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '../../components/AppHeader';
import { EmptyState } from '../../components/EmptyState';
import { useCurrentPraktikan, usePrakti } from '../../context/PraktiContext';
import type { AppStackParamList } from '../../navigation/types';
import { cardShadow, colors, radius, spacing, typography } from '../../theme';
import { formatJamDetik, formatTanggal } from '../../utils/date';
import { riwayatPraktikan } from '../../utils/selectors';

type Props = NativeStackScreenProps<AppStackParamList, 'History'>;

export function HistoryScreen({ navigation }: Props) {
  const praktikan = useCurrentPraktikan();
  const { sesi, presensi } = usePrakti();
  if (!praktikan) return null;

  const data = riwayatPraktikan(presensi, sesi, praktikan.id);

  return (
    <View style={styles.root}>
      <AppHeader subtitle="Riwayat Kehadiran" onBack={navigation.goBack} />
      <FlatList
        data={data}
        keyExtractor={(i) => i.sesi.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.gap} />}
        ListEmptyComponent={
          <EmptyState
            icon="time-outline"
            title="Belum ada riwayat"
            description="Riwayat muncul setelah kamu melakukan presensi."
          />
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Ionicons name="checkmark-circle" size={28} color={colors.success} />
            <View style={styles.text}>
              <Text style={styles.title}>
                {item.sesi.praktikum} · Kelas {item.sesi.kelas}
              </Text>
              <Text style={styles.meta}>{formatTanggal(item.sesi.tanggal)}</Text>
              <Text style={styles.time}>Hadir pukul {formatJamDetik(item.presensi.waktuHadir)}</Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.lg, flexGrow: 1 },
  gap: { height: spacing.md },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
    ...cardShadow,
  },
  text: { flex: 1 },
  title: { ...typography.bodyBold, color: colors.textPrimary },
  meta: { ...typography.caption, color: colors.textSecondary },
  time: { ...typography.captionBold, color: colors.successText, marginTop: 2 },
});
