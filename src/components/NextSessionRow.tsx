import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '../theme';
import type { Sesi } from '../types';
import { formatTanggal } from '../utils/date';
import { StatusPill } from './StatusPill';

interface Props {
  sesi: Sesi;
  onPress: () => void;
}

/** Baris ringkas untuk sesi berikutnya di bawah kartu sesi utama. */
export function NextSessionRow({ sesi, onPress }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Sesi berikutnya: ${sesi.praktikum}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.text}>
        <Text style={styles.title}>{sesi.praktikum}</Text>
        <Text style={styles.meta}>
          Kelas {sesi.kelas} · {formatTanggal(sesi.tanggal)} · {sesi.mulai} - {sesi.selesai} ·{' '}
          {sesi.ruang}
        </Text>
      </View>
      <StatusPill status={sesi.status} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  pressed: { opacity: 0.7 },
  text: { flex: 1, marginRight: spacing.md },
  title: { ...typography.bodyBold, color: colors.textPrimary },
  meta: { ...typography.caption, color: colors.textSecondary },
});
