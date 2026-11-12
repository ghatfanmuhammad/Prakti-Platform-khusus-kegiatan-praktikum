import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '../theme';
import type { SessionStatus } from '../types';

interface Config {
  label: string;
  text: string;
  background: string;
  border: string;
  dot: string;
}

const CONFIG: Record<SessionStatus, Config> = {
  belum_dibuka: {
    label: 'Belum dibuka',
    text: colors.neutralText,
    background: colors.neutralBg,
    border: colors.divider,
    dot: colors.neutralDot,
  },
  dibuka: {
    label: 'Dibuka',
    text: colors.successText,
    background: colors.successBg,
    border: colors.successBorder,
    dot: colors.success,
  },
  ditutup: {
    label: 'Ditutup',
    text: colors.danger,
    background: colors.dangerBg,
    border: colors.dangerBorder,
    dot: colors.danger,
  },
};

/** Status sesi: selalu berupa warna dan teks, tidak hanya warna. */
export function StatusPill({ status }: { status: SessionStatus }) {
  const config = CONFIG[status];
  return (
    <View
      style={[styles.pill, { backgroundColor: config.background, borderColor: config.border }]}
      accessibilityLabel={`Status sesi: ${config.label}`}
    >
      <View style={[styles.dot, { backgroundColor: config.dot }]} />
      <Text style={[styles.label, { color: config.text }]}>{config.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: spacing.sm - 2 },
  label: { ...typography.captionBold },
});
