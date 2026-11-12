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

/** Kisi menu 3 kolom dengan ubin ikon, gaya beranda aplikasi kampus. */
export function MenuGrid({ items }: { items: MenuItem[] }) {
  return (
    <Card style={styles.card}>
      <View style={styles.grid}>
        {items.map((item) => (
          <Pressable
            key={item.key}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            onPress={item.onPress}
            style={({ pressed }) => [styles.item, pressed && styles.pressed]}
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
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  item: { width: '33.3333%', minHeight: 64, alignItems: 'center' },
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
  label: { ...typography.captionBold, color: colors.textPrimary },
});
