import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { formatWaktuHadir } from '@/features/presensi/utils';

import type { KehadiranPraktikan } from './types';

type Props = {
  /** Praktikan yang dipilih; null berarti modal tertutup. */
  kehadiran: KehadiranPraktikan | null;
  urutan: number;
  namaPraktikum: string;
  onTutup: () => void;
};

/** Modal informasi pendukung saat item rekap ditekan (SRS-006). */
export function DetailKehadiranModal({ kehadiran, urutan, namaPraktikum, onTutup }: Props) {
  return (
    <Modal visible={kehadiran !== null} transparent animationType="fade" onRequestClose={onTutup}>
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onTutup}
          accessibilityLabel="Tutup detail kehadiran"
        />
        {kehadiran && (
          <ThemedView style={styles.card}>
            <ThemedText type="subtitle" style={styles.judul}>
              Detail Kehadiran
            </ThemedText>

            <View style={styles.daftarInfo}>
              <BarisInfo label="Nama" nilai={kehadiran.nama} />
              <BarisInfo label="NIM" nilai={kehadiran.nim} />
              <BarisInfo label="Praktikum" nilai={namaPraktikum} />
              <BarisInfo label="Waktu hadir" nilai={formatWaktuHadir(kehadiran.waktuHadir)} />
              <BarisInfo label="Urutan hadir" nilai={`Ke-${urutan}`} />
            </View>

            <Pressable
              onPress={onTutup}
              accessibilityRole="button"
              style={({ pressed }) => [styles.tombol, pressed && styles.ditekan]}>
              <ThemedText type="smallBold" style={styles.teksPutih}>
                Tutup
              </ThemedText>
            </Pressable>
          </ThemedView>
        )}
      </View>
    </Modal>
  );
}

function BarisInfo({ label, nilai }: { label: string; nilai: string }) {
  return (
    <View style={styles.baris}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="smallBold" style={styles.nilai}>
        {nilai}
      </ThemedText>
    </View>
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
  daftarInfo: {
    gap: Spacing.two,
  },
  baris: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  nilai: {
    flexShrink: 1,
    textAlign: 'right',
  },
  tombol: {
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    marginTop: Spacing.two,
    backgroundColor: '#3c87f7',
  },
  teksPutih: {
    color: '#ffffff',
  },
  ditekan: {
    opacity: 0.7,
  },
});
