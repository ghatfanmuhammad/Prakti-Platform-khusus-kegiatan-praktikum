import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '../theme';

export function DateChip({ label }: { label: string }) {
  return (
    <View style={styles.chip}>
      <Ionicons name="calendar-outline" size={14} color={colors.neutralText} />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: spacing.xs,
  },
  label: { ...typography.caption, color: colors.neutralText, marginLeft: spacing.sm - 2 },
});
