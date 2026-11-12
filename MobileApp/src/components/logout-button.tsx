import { Pressable, StyleSheet, Text } from 'react-native';

import { palette } from '@/constants/palette';
import { useApp } from '@/context/app-context';

export function LogoutButton() {
  const { keluar } = useApp();
  return (
    <Pressable
      onPress={keluar}
      accessibilityRole="button"
      accessibilityLabel="Keluar dan kembali ke pemilihan peran"
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
      <Text style={styles.label}>Keluar</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { paddingHorizontal: 16, paddingVertical: 8 },
  pressed: { opacity: 0.5 },
  label: { color: palette.teal, fontSize: 16, fontWeight: '600' },
});
