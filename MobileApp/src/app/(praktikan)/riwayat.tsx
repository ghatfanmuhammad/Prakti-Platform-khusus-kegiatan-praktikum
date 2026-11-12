// SRS-006: Riwayat kehadiran praktikan
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { BarisInfo, BottomSheet } from '@/components/bottom-sheet';
import { palette } from '@/constants/palette';
import { useApp } from '@/context/app-context';
import type { Jadwal } from '@/data/dummy';
import { formatJam, formatTanggal } from '@/utils/waktu';

type ItemRiwayat = { id: string; jadwal: Jadwal; waktuHadir: string };

export default function RiwayatPraktikanScreen() {
  const { pengguna, jadwal, presensi } = useApp();
  const [dipilih, setDipilih] = useState<ItemRiwayat | null>(null);

  const riwayat = useMemo<ItemRiwayat[]>(() => {
    if (!pengguna) return [];
    return presensi
      .filter((p) => p.praktikanId === pengguna.id)
      .flatMap((p) => {
        const j = jadwal.find((item) => item.id === p.jadwalId);
        return j ? [{ id: p.id, jadwal: j, waktuHadir: p.waktuHadir }] : [];
      })
      .sort((a, b) => b.waktuHadir.localeCompare(a.waktuHadir));
  }, [pengguna, jadwal, presensi]);

  return (
    <View style={styles.screen}>
      <FlatList
        data={riwayat}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          riwayat.length > 0 ? (
            <Text style={styles.summary}>{riwayat.length} sesi tercatat hadir</Text>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Belum ada riwayat kehadiran</Text>
            <Text style={styles.emptyBody}>
              Presensimu akan muncul di sini setelah kamu hadir di sesi yang dibuka asisten.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => setDipilih(item)}
            accessibilityRole="button"
            accessibilityLabel={`${item.jadwal.praktikum}, hadir pukul ${formatJam(item.waktuHadir)}. Buka detail`}
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>{item.jadwal.praktikum}</Text>
              <Text style={styles.cardDate}>{formatTanggal(item.jadwal.tanggal)}</Text>
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeLabel}>Hadir {formatJam(item.waktuHadir)}</Text>
            </View>
          </Pressable>
        )}
      />

      <BottomSheet
        visible={dipilih !== null}
        title={dipilih?.jadwal.praktikum ?? ''}
        onClose={() => setDipilih(null)}>
        {dipilih ? (
          <View>
            <BarisInfo label="Kelas" nilai={dipilih.jadwal.kelas} />
            <BarisInfo label="Tanggal" nilai={formatTanggal(dipilih.jadwal.tanggal)} />
            <BarisInfo label="Jadwal sesi" nilai={`${dipilih.jadwal.jamMulai} - ${dipilih.jadwal.jamSelesai}`} />
            <BarisInfo label="Ruang" nilai={dipilih.jadwal.ruang} />
            <BarisInfo label="Waktu hadir" nilai={formatJam(dipilih.waktuHadir)} />
            <BarisInfo label="Status" nilai="Hadir" />
          </View>
        ) : null}
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.mist },
  listContent: { flexGrow: 1, width: '100%', maxWidth: 560, alignSelf: 'center', padding: 16, gap: 10 },
  summary: { fontSize: 15, color: palette.muted, marginBottom: 4 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.white,
  },
  cardPressed: { backgroundColor: palette.tealSoft },
  cardText: { flex: 1, gap: 4 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: palette.ink },
  cardDate: { fontSize: 14, color: palette.muted },
  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: palette.greenSoft },
  badgeLabel: { fontSize: 13, fontWeight: '700', color: palette.green },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: palette.ink, textAlign: 'center' },
  emptyBody: { fontSize: 15, color: palette.muted, textAlign: 'center' },
});
