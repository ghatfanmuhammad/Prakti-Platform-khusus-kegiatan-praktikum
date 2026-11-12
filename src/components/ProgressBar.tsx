import { StyleSheet, View } from 'react-native';

import { colors } from '../theme';

interface Props {
  /** Nilai 0 sampai 1. */
  value: number;
  trackColor?: string;
}

export function ProgressBar({ value, trackColor = colors.tile }: Props) {
  const lebar = Math.min(1, Math.max(0, value)) * 100;
  return (
    <View style={[styles.track, { backgroundColor: trackColor }]}>
      <View style={[styles.fill, { width: `${lebar}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, backgroundColor: colors.success },
});
