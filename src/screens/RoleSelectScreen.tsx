import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IdentityPickerSheet } from '../features/auth/IdentityPickerSheet';
import { cardShadow, colors, radius, spacing, typography } from '../theme';
import type { Role } from '../types';
import type { IconName } from '../components/icons';

const PERAN: { role: Role; title: string; desc: string; icon: IconName }[] = [
  {
    role: 'asisten',
    title: 'Masuk sebagai Asisten',
    desc: 'Buka sesi, pantau kehadiran, tutup sesi',
    icon: 'school-outline',
  },
  {
    role: 'praktikan',
    title: 'Masuk sebagai Praktikan',
    desc: 'Presensi dengan QR dan lihat riwayat',
    icon: 'person-outline',
  },
];

type Props = {
  /** Kembali ke layar login Firebase (SRS-007). */
  onSwitchToFirebase?: () => void;
};

export function RoleSelectScreen({ onSwitchToFirebase }: Props) {
  const insets = useSafeAreaInsets();
  const [role, setRole] = useState<Role | null>(null);

  return (
    <View style={styles.root}>
      <View style={[styles.hero, { paddingTop: insets.top + spacing.xl }]}>
        <Text style={styles.logo}>PRAKTI</Text>
        <Text style={styles.tagline}>Platform khusus kegiatan praktikum</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.heading}>Pilih peran untuk demo</Text>
        {PERAN.map((p) => (
          <Pressable
            key={p.role}
            accessibilityRole="button"
            onPress={() => setRole(p.role)}
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
          >
            <View style={styles.iconBox}>
              <Ionicons name={p.icon} size={26} color={colors.navy} />
            </View>
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>{p.title}</Text>
              <Text style={styles.cardDesc}>{p.desc}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </Pressable>
        ))}
        <Text style={styles.note}>Data dummy tersimpan di perangkat dan akan kembali awal saat aplikasi dimuat ulang.</Text>
        {onSwitchToFirebase && (
          <Pressable accessibilityRole="button" onPress={onSwitchToFirebase} style={styles.switchBtn}>
            <Text style={styles.switchText}>Masuk dengan akun (Firebase)</Text>
          </Pressable>
        )}
      </View>
      <IdentityPickerSheet role={role} onClose={() => setRole(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  hero: {
    backgroundColor: colors.navy,
    paddingBottom: spacing.xl * 2,
    paddingHorizontal: spacing.xl,
    borderBottomLeftRadius: radius.sheet,
    borderBottomRightRadius: radius.sheet,
  },
  logo: { fontSize: 36, fontWeight: '800', letterSpacing: 3, color: colors.textOnNavy },
  tagline: { ...typography.body, color: colors.textOnNavyMuted, marginTop: spacing.xs },
  body: { flex: 1, padding: spacing.lg, gap: spacing.md },
  heading: { ...typography.title, color: colors.textPrimary, marginTop: spacing.sm },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...cardShadow,
  },
  pressed: { opacity: 0.85 },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.tile,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.lg,
  },
  cardText: { flex: 1 },
  cardTitle: { ...typography.subtitle, color: colors.textPrimary },
  cardDesc: { ...typography.caption, color: colors.textSecondary },
  note: { ...typography.caption, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm },
  switchBtn: { alignSelf: 'center', paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  switchText: { ...typography.body, color: colors.navy, fontWeight: '600', textDecorationLine: 'underline' },
});
