import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '../../theme';
import type { LabMapProps } from './LabMap';

/**
 * Cadangan untuk web: react-native-maps tidak mendukung web, jadi peta hanya tampil di
 * aplikasi mobile. Daftar laboratorium tetap tersedia di bawah peta pada MapsScreen.
 */
export function LabMap(_props: LabMapProps) {
  return (
    <View style={styles.box}>
      <Ionicons name="map-outline" size={36} color={colors.navyMuted} />
      <Text style={styles.text}>
        Peta interaktif hanya tersedia di aplikasi mobile. Pilih laboratorium dari daftar di bawah.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, backgroundColor: colors.tile, gap: spacing.sm },
  text: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
});