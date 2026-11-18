import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '../theme';
import { Card } from './Card';
import type { IconName } from './icons';

export interface MenuItem {
  key: string;
  label: string;
  icon: IconName;
  onPress: () => void;
}

/** Maksimal menu per baris; lebih dari ini akan turun ke baris berikutnya. */
const MAKS_KOLOM = 4;

/** Kisi menu ubin ikon (hingga 4 kolom sejajar), gaya beranda aplikasi kampus. */
export function MenuGrid({ items }: { items: MenuItem[] }) {
  const kolom = Math.max(1, Math.min(items.length, MAKS_KOLOM));
  const lebar = `${100 / kolom}%` as const;

  return (
    <Card style={styles.card}>
      <View style={styles.grid}>
        {items.map((item) => (
          <Pressable
            key={item.key}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            onPress={item.onPress}
            style={({ pressed }) => [styles.item, { width: lebar }, pressed && styles.pressed]}
          >
            <View style={styles.tile}>
              <Ionicons name={item.icon} size={22} color={colors.navy} />
            </View>
            <Text style={styles.label}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { paddingHorizontal: spacing.sm, paddingVertical: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.md },
  item: { minHeight: 64, alignItems: 'center', paddingHorizontal: 2 },
  pressed: { opacity: 0.6 },
  tile: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.tile,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  label: { ...typography.captionBold, color: colors.textPrimary, textAlign: 'center' },
});
