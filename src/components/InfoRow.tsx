import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '../theme';
import type { IconName } from './icons';

interface Props {
  icon: IconName;
  text: string;
}

export function InfoRow({ icon, text }: Props) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={14} color={colors.textSecondary} />
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  text: { ...typography.body, color: colors.textSecondary, marginLeft: spacing.sm, flexShrink: 1 },
});
