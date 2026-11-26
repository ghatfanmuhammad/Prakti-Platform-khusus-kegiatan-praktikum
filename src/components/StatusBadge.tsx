import { StyleSheet, Text, View } from 'react-native';

import { radius, spacing, statusTones, typography, type StatusTone } from '../theme';

interface Props {
  label: string;
  tone: StatusTone;
  /** Titik warna di depan label (dipakai status sesi). */
  dot?: boolean;
  /** Label aksesibilitas, mis. "Status pembayaran: Lunas". */
  accessibilityLabel?: string;
}

/**
 * [SRS-030] Badge status generik untuk semua layar. Status selalu tampil sebagai teks dan warna,
 * tidak hanya warna.
 */
export function StatusBadge({ label, tone, dot = false, accessibilityLabel }: Props) {
  const gaya = statusTones[tone];
  return (
    <View
      style={[styles.badge, { backgroundColor: gaya.background, borderColor: gaya.border }]}
      accessibilityLabel={accessibilityLabel ?? label}
    >
      {dot ? <View style={[styles.dot, { backgroundColor: gaya.dot }]} /> : null}
      <Text style={[styles.label, { color: gaya.text }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexShrink: 0,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: spacing.sm - 2 },
  label: { ...typography.captionBold },
});
