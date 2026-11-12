import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, spacing, typography } from '../theme';
import type { IconName } from './icons';

type Variant = 'primary' | 'outline' | 'danger' | 'ghost';

interface Palette {
  background: string;
  border: string;
  text: string;
}

const PALETTES: Record<Variant, Palette> = {
  primary: { background: colors.navy, border: colors.navy, text: colors.textOnNavy },
  outline: { background: colors.surface, border: colors.navy, text: colors.navy },
  danger: { background: colors.danger, border: colors.danger, text: colors.textOnNavy },
  ghost: { background: 'transparent', border: 'transparent', text: colors.navy },
};

const DISABLED: Palette = {
  background: colors.disabledBg,
  border: colors.disabledBg,
  text: colors.disabledText,
};

interface Props {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
}

export function Button({ label, onPress, variant = 'primary', disabled = false, icon, style }: Props) {
  const palette = disabled ? DISABLED : PALETTES[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: palette.background, borderColor: palette.border },
        pressed && styles.pressed,
        style,
      ]}
    >
      {icon ? <Ionicons name={icon} size={18} color={palette.text} style={styles.icon} /> : null}
      <Text style={[styles.label, { color: palette.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1.5,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.85 },
  icon: { marginRight: spacing.sm },
  label: { ...typography.button },
});
