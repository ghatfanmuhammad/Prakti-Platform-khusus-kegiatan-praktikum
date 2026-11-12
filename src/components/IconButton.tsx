import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';

import { colors, TOUCH_TARGET } from '../theme';
import type { IconName } from './icons';

interface Props {
  icon: IconName;
  /** Label untuk pembaca layar. */
  label: string;
  onPress: () => void;
  color?: string;
  size?: number;
}

export function IconButton({ icon, label, onPress, color = colors.textOnNavy, size = 22 }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={size} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: TOUCH_TARGET,
    height: TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
});
