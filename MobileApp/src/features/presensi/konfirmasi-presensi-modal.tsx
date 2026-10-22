import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

type Props = {
  visible: boolean;
  namaPraktikum: string;
  onKonfirmasi: () => void;
  onBatal: () => void;
};

/** Modal konfirmasi sebelum presensi dicatat (SRS-005). */
export function KonfirmasiPresensiModal({ visible, namaPraktikum, onKonfirmasi, onBatal }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onBatal}>
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onBatal}
          accessibilityLabel="Tutup konfirmasi presensi"
        />
        <ThemedView style={styles.card}>
          <ThemedText type="subtitle" style={styles.judul}>
            Konfirmasi Presensi
          </ThemedText>
          <ThemedText themeColor="textSecondary">
            Catat kehadiran kamu pada praktikum {namaPraktikum} sekarang? Presensi tidak dapat
            diulang pada sesi yang sama.
          </ThemedText>

          <View style={styles.aksi}>
            <Pressable
              onPress={onBatal}
              accessibilityRole="button"
              style={({ pressed }) => [styles.tombol, styles.tombolBatal, pressed && styles.ditekan]}>
              <ThemedText type="smallBold">Batal</ThemedText>
            </Pressable>
            <Pressable
              onPress={onKonfirmasi}
              accessibilityRole="button"
              style={({ pressed }) => [styles.tombol, styles.tombolUtama, pressed && styles.ditekan]}>
              <ThemedText type="smallBold" style={styles.teksPutih}>
                Ya, Presensi
              </ThemedText>
            </Pressable>
          </View>
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 16,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  judul: {
    fontSize: 22,
    lineHeight: 30,
  },
  aksi: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  tombol: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
  },
  tombolBatal: {
    backgroundColor: 'rgba(128,128,128,0.2)',
  },
  tombolUtama: {
    backgroundColor: '#3c87f7',
  },
  teksPutih: {
    color: '#ffffff',
  },
  ditekan: {
    opacity: 0.7,
  },
});
