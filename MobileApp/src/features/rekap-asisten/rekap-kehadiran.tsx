import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import type { StatusSesi } from '@/features/presensi';

import { DetailKehadiranModal } from './detail-kehadiran-modal';
import type { KehadiranPraktikan } from './types';
import { formatJamHadir, urutkanBerdasarkanWaktuHadir } from './utils';

type Props = {
  namaPraktikum: string;
  statusSesi: StatusSesi;
  /** Praktikan yang sudah presensi pada sesi ini. */
  daftarHadir: KehadiranPraktikan[];
};

const KETERANGAN_KOSONG: Record<StatusSesi, string> = {
  belum_dibuka: 'Sesi belum dibuka. Praktikan dapat presensi setelah sesi dibuka.',
  dibuka: 'Belum ada praktikan yang melakukan presensi. Daftar akan terisi saat praktikan presensi.',
  ditutup: 'Sesi sudah ditutup tanpa ada praktikan yang melakukan presensi.',
};

/** Halaman rekap kehadiran praktikan pada satu sesi untuk asisten (SRS-006). */
export function RekapKehadiran({ namaPraktikum, statusSesi, daftarHadir }: Props) {
  const [dipilih, setDipilih] = useState<number | null>(null);

  const daftar = urutkanBerdasarkanWaktuHadir(daftarHadir);

  return (
    <View style={styles.wadah}>
      <FlatList
        data={daftar}
        keyExtractor={(item) => item.praktikanId}
        contentContainerStyle={[styles.konten, daftar.length === 0 && styles.kontenKosong]}
        ListHeaderComponent={
          <View style={styles.header}>
            <ThemedText type="smallBold">{namaPraktikum}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {daftar.length} praktikan hadir
            </ThemedText>
          </View>
        }
        ListEmptyComponent={
          <ThemedView type="backgroundElement" style={styles.kosong}>
            <ThemedText type="smallBold">Belum ada praktikan yang hadir</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.teksTengah}>
              {KETERANGAN_KOSONG[statusSesi]}
            </ThemedText>
          </ThemedView>
        }
        renderItem={({ item, index }) => (
          <Pressable
            onPress={() => setDipilih(index)}
            accessibilityRole="button"
            accessibilityHint="Menampilkan detail kehadiran"
            style={({ pressed }) => pressed && styles.ditekan}>
            <ThemedView type="backgroundElement" style={styles.item}>
              <ThemedText type="smallBold" style={styles.nomor}>
                {index + 1}
              </ThemedText>
              <View style={styles.identitas}>
                <ThemedText type="smallBold" numberOfLines={1}>
                  {item.nama}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {item.nim}
                </ThemedText>
              </View>
              <ThemedText type="smallBold" style={styles.teksHijau}>
                {formatJamHadir(item.waktuHadir)}
              </ThemedText>
            </ThemedView>
          </Pressable>
        )}
      />

      <DetailKehadiranModal
        kehadiran={dipilih !== null ? (daftar[dipilih] ?? null) : null}
        urutan={(dipilih ?? 0) + 1}
        namaPraktikum={namaPraktikum}
        onTutup={() => setDipilih(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wadah: {
    flex: 1,
  },
  konten: {
    padding: Spacing.three,
    gap: Spacing.two,
  },
  kontenKosong: {
    flexGrow: 1,
  },
  header: {
    gap: Spacing.half,
    marginBottom: Spacing.two,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: 16,
    padding: Spacing.three,
  },
  nomor: {
    width: 24,
    textAlign: 'center',
  },
  identitas: {
    flex: 1,
    gap: Spacing.half,
  },
  teksHijau: {
    color: '#1f9d55',
  },
  ditekan: {
    opacity: 0.7,
  },
  kosong: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: 16,
    padding: Spacing.four,
  },
  teksTengah: {
    textAlign: 'center',
  },
});
