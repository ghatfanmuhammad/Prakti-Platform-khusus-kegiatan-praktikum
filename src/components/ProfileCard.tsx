import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '../theme';

interface Props {
  nama: string;
  /** Baris kuning di bawah nama, misalnya NIM atau jabatan. */
  highlight: string;
  detail: string;
}

export function ProfileCard({ nama, highlight, detail }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.avatar}>
        <Ionicons name="person-outline" size={28} color="#E8EBFA" />
      </View>
      <View style={styles.text}>
        <Text style={styles.name} numberOfLines={2}>
          {nama}
        </Text>
        <Text style={styles.highlight}>{highlight}</Text>
        <Text style={styles.detail}>{detail}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.navyDeep,
    borderRadius: radius.lg,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.navyMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.lg,
  },
  text: { flex: 1 },
  name: { fontSize: 17, lineHeight: 22, fontWeight: '700', color: colors.textOnNavy },
  highlight: { ...typography.captionBold, color: colors.accent, marginTop: 2 },
  detail: { ...typography.caption, color: colors.textOnNavyMuted, marginTop: 2 },
});
