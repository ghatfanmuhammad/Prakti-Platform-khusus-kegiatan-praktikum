import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { colors, radius, spacing, typography } from '../theme';

export interface ChipOption<T extends string> {
  key: T;
  label: string;
}

interface Props<T extends string> {
  options: ChipOption<T>[];
  selected: T;
  onSelect: (key: T) => void;
}

export function FilterChips<T extends string>({ options, selected, onSelect }: Props<T>) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.content}
    >
      {options.map((option) => {
        const active = option.key === selected;
        return (
          <Pressable
            key={option.key}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(option.key)}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // Jangan ikut mengisi ruang kosong saat daftar di bawahnya pendek/kosong (terutama di web).
  scroll: { flexGrow: 0, flexShrink: 0 },
  content: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, alignItems: 'center' },
  chip: {
    height: 36,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  chipActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  label: { ...typography.captionBold, color: colors.textPrimary },
  labelActive: { color: colors.textOnNavy },
});
