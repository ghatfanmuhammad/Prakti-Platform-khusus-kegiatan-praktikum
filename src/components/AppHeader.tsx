import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing, TOUCH_TARGET, typography } from '../theme';
import { IconButton } from './IconButton';

interface Props {
  /** Nama layar, tampil di bawah judul aplikasi. */
  subtitle: string;
  onBack?: () => void;
  /** Tombol di sisi kanan, misalnya lonceng notifikasi. */
  right?: ReactNode;
}

export function AppHeader({ subtitle, onBack, right }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.row}>
        <View style={styles.side}>
          {onBack ? <IconButton icon="arrow-back" label="Kembali" onPress={onBack} /> : null}
        </View>
        <View style={styles.center}>
          <Text style={styles.title}>PRAKTI</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        <View style={[styles.side, styles.sideRight]}>{right}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.navy },
  row: {
    height: 72,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
  },
  side: { width: TOUCH_TARGET },
  sideRight: { alignItems: 'flex-end' },
  center: { flex: 1, alignItems: 'center' },
  title: { ...typography.headerTitle, color: colors.textOnNavy },
  subtitle: { ...typography.headerSubtitle, color: colors.textOnNavyMuted },
});
