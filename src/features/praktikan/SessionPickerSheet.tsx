import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '../../components/BottomSheet';
import { colors, radius, spacing, typography } from '../../theme';
import type { Sesi } from '../../types';

interface Props {
  visible: boolean;
  options: Sesi[];
  onClose: () => void;
  onPick: (sesi: Sesi) => void;
}

/** Muncul bila ada lebih dari satu sesi dibuka yang belum dipresensi. */
export function SessionPickerSheet({ visible, options, onClose, onPick }: Props) {
  return (
    <BottomSheet visible={visible} title="Pilih sesi" onClose={onClose}>
      <Text style={styles.hint}>Ada beberapa sesi yang sedang dibuka. Pilih sesi yang ingin dipresensi.</Text>
      <View style={styles.list}>
        {options.map((sesi) => (
          <Pressable
            key={sesi.id}
            accessibilityRole="button"
            onPress={() => onPick(sesi)}
            style={({ pressed }) => [styles.item, pressed && styles.pressed]}
          >
            <Text style={styles.name}>{sesi.praktikum}</Text>
            <Text style={styles.meta}>
              Kelas {sesi.kelas} · {sesi.mulai} - {sesi.selesai} · {sesi.ruang}
            </Text>
          </Pressable>
        ))}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  hint: { ...typography.body, color: colors.textSecondary },
  list: { marginTop: spacing.md, gap: spacing.sm },
  item: {
    minHeight: 56,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radius.md,
    padding: spacing.md,
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
  name: { ...typography.bodyBold, color: colors.textPrimary },
  meta: { ...typography.caption, color: colors.textSecondary },
});
