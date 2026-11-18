import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Button } from '../../components/Button';
import { colors, spacing, typography } from '../../theme';

export function PracticumLoading({
  error,
  onRetry,
}: {
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <View style={styles.content} accessibilityLiveRegion="polite">
      {error ? (
        <>
          <Text style={styles.message}>{error}</Text>
          <Button label="Coba lagi" onPress={onRetry} variant="outline" />
        </>
      ) : (
        <>
          <ActivityIndicator color={colors.navy} />
          <Text style={styles.message}>Memuat data praktikum…</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.xl, alignItems: 'center', gap: spacing.md },
  message: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
});
