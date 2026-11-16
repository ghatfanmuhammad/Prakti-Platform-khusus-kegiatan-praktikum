import { StyleSheet, Text, View } from 'react-native';

import type { StatusIzin } from '../services/izinService';
import { colors, radius, spacing } from '../theme';

const GAYA: Record<StatusIzin, { bg: string; border: string; text: string }> = {
  Disetujui: { bg: colors.successBg, border: colors.successBorder, text: colors.successText },
  Ditolak: { bg: colors.dangerBg, border: colors.dangerBorder, text: colors.danger },
  Menunggu: { bg: colors.neutralBg, border: colors.divider, text: colors.accentText },
};

/** Badge status pengajuan izin (SRS-010/011), dipakai di layar asisten dan praktikan. */
export function IzinStatusBadge({ status }: { status: StatusIzin }) {
  const gaya = GAYA[status] ?? GAYA.Menunggu;
  return (
    <View style={[styles.badge, { backgroundColor: gaya.bg, borderColor: gaya.border }]}>
      <Text style={[styles.text, { color: gaya.text }]}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  text: { fontSize: 12, fontWeight: '700' },
});
