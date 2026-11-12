import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { cardShadow, colors, radius, spacing, typography } from '../theme';
import type { Sesi } from '../types';
import { formatTanggal } from '../utils/date';
import { InfoRow } from './InfoRow';
import { StatusPill } from './StatusPill';

interface Props {
  sesi: Sesi;
  onPress: () => void;
  /** Konten tambahan di bawah, misalnya jumlah hadir atau penanda "Sudah hadir". */
  footer?: ReactNode;
}

export function SessionCard({ sesi, onPress, footer }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${sesi.praktikum} kelas ${sesi.kelas}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.titleRow}>
        <View style={styles.titleText}>
          <Text style={styles.title}>{sesi.praktikum}</Text>
          <Text style={styles.kelas}>Kelas {sesi.kelas}</Text>
        </View>
        <StatusPill status={sesi.status} />
      </View>
      <View style={styles.info}>
        <InfoRow
          icon="calendar-outline"
          text={`${formatTanggal(sesi.tanggal)} · ${sesi.mulai} - ${sesi.selesai}`}
        />
        <InfoRow icon="location-outline" text={sesi.ruang} />
      </View>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...cardShadow,
  },
  pressed: { opacity: 0.85 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  titleText: { flex: 1, marginRight: spacing.md },
  title: { ...typography.subtitle, color: colors.textPrimary },
  kelas: { ...typography.captionBold, color: colors.accentText },
  info: { marginTop: spacing.md, gap: spacing.xs },
  footer: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
