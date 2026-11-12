import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { palette } from '@/constants/palette';

type Props = {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
};

export function BottomSheet({ visible, title, onClose, children }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Tutup"
        />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.handle} />
          <Text style={styles.title}>{title}</Text>
          {children}
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
            <Text style={styles.closeLabel}>Tutup</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export function BarisInfo({ label, nilai }: { label: string; nilai: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{nilai}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(18, 38, 58, 0.45)' },
  sheet: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 560,
    backgroundColor: palette.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.line,
    marginBottom: 14,
  },
  title: { fontSize: 20, fontWeight: '700', color: palette.ink, marginBottom: 12 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.line,
  },
  rowLabel: { fontSize: 15, color: palette.muted },
  rowValue: { flexShrink: 1, fontSize: 15, fontWeight: '600', color: palette.ink, textAlign: 'right' },
  closeButton: {
    marginTop: 18,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: palette.mist,
  },
  closeLabel: { fontSize: 16, fontWeight: '600', color: palette.ink },
  pressed: { opacity: 0.6 },
});
