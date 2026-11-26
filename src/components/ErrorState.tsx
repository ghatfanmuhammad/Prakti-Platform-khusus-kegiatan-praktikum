import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '../theme';
import { Button } from './Button';

interface Props {
  message: string;
  title?: string;
  onRetry?: () => void;
}

/** [SRS-030] Pola galat yang seragam: ikon, judul, penjelasan, dan tombol coba lagi. */
export function ErrorState({ message, title = 'Gagal Memuat', onRetry }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.card} accessibilityRole="alert">
        <Ionicons name="cloud-offline-outline" size={40} color={colors.danger} />
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
        {onRetry ? <Button label="Coba Lagi" icon="refresh" onPress={onRetry} style={styles.button} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  card: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    padding: spacing.xl,
  },
  title: { ...typography.title, color: colors.danger, marginTop: spacing.sm },
  message: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xs },
  button: { marginTop: spacing.lg, alignSelf: 'stretch' },
});
