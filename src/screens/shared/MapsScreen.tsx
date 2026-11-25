import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '../../components/AppHeader';
import { Button } from '../../components/Button';
import { StatusPill } from '../../components/StatusPill';
import { usePrakti } from '../../context/PraktiContext';
import { aktivitasLab } from '../../features/laboratorium/aktivitas';
import { useLaboratorium } from '../../features/laboratorium/hooks';
import { LabMap } from '../../features/laboratorium/LabMap';
import { useLokasiPengguna } from '../../features/laboratorium/lokasi';
import { titikLab, type Laboratorium } from '../../features/laboratorium/models';
import { colors, radius, spacing, typography } from '../../theme';
import type { Sesi } from '../../types';
import { formatTanggalRelatif } from '../../utils/date';
import { formatJarak, jarakMeter } from '../../utils/geo';

function BarisSesi({ judul, sesi }: { judul: string; sesi: Sesi }) {
  return (
    <View style={styles.sesi}>
      <Text style={styles.sesiJudul}>{judul}</Text>
      <Text style={styles.sesiNama}>{sesi.praktikum} · Kelas {sesi.kelas}</Text>
      <Text style={styles.meta}>
        {formatTanggalRelatif(sesi.tanggal)} · {sesi.mulai} - {sesi.selesai}
      </Text>
      <StatusPill status={sesi.status} />
    </View>
  );
}

/** Peta laboratorium Informatika: marker lab, posisi pengguna, dan aktivitas praktikum (SRS-015, 016, 018). */
export function MapsScreen({ navigation }: { navigation: any }) {
  const { data: labs, loading, error, retry } = useLaboratorium();
  const { sesi } = usePrakti();
  const lokasi = useLokasiPengguna();
  const [terpilihId, setTerpilihId] = useState<string | null>(null);
  // Menyegarkan "praktikum berikutnya" tiap menit tanpa menunggu data Firestore berubah.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  const terpilih = labs.find((l) => l.id === terpilihId) ?? null;
  const aktivitas = useMemo(
    () => (terpilih ? aktivitasLab(terpilih, sesi) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [terpilih, sesi, tick],
  );

  const pilih = (lab: Laboratorium) => setTerpilihId(lab.id);

  return (
    <View style={styles.root}>
      <AppHeader subtitle="Peta Laboratorium" onBack={() => navigation.goBack()} />

      {/* Status lokasi (SRS-018): pesan jelas + aksi perbaikan */}
      {lokasi.pesan ? (
        <View style={styles.banner}>
          <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
          <Text style={styles.bannerText}>{lokasi.pesan}</Text>
          <Pressable onPress={lokasi.status === 'izin-ditolak' && !lokasi.bisaMintaLagi ? lokasi.bukaPengaturan : lokasi.ulangi}>
            <Text style={styles.bannerAksi}>
              {lokasi.status === 'izin-ditolak' && !lokasi.bisaMintaLagi ? 'Pengaturan' : 'Coba lagi'}
            </Text>
          </Pressable>
        </View>
      ) : lokasi.status === 'memuat' || lokasi.status === 'menunggu' ? (
        <View style={styles.bannerNetral}>
          <ActivityIndicator size="small" color={colors.navy} />
          <Text style={styles.bannerNetralText}>Mencari lokasi Anda…</Text>
        </View>
      ) : null}

      <View style={styles.petaBox}>
        {loading ? (
          <ActivityIndicator color={colors.navy} style={styles.tengah} />
        ) : (
          <LabMap labs={labs} pengguna={lokasi.koordinat} terpilihId={terpilihId} onPilih={pilih} />
        )}
      </View>

      <ScrollView style={styles.panel} contentContainerStyle={styles.panelIsi}>
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            <Button label="Coba Lagi" variant="outline" onPress={retry} />
          </View>
        ) : null}

        {!loading && !error && labs.length === 0 ? (
          <Text style={styles.meta}>Belum ada laboratorium. Asisten dapat menambahkannya di menu Kelola Lab.</Text>
        ) : null}

        {terpilih && aktivitas ? (
          <View style={styles.detail}>
            <Text style={styles.labNama}>{terpilih.nama}</Text>
            <Text style={styles.meta}>
              Radius presensi {terpilih.radiusMeter} m
              {lokasi.koordinat ? ` · Jarak dari Anda ${formatJarak(jarakMeter(lokasi.koordinat, titikLab(terpilih)))}` : ''}
            </Text>
            {aktivitas.berlangsung.length === 0 && !aktivitas.berikutnya ? (
              <Text style={styles.meta}>Belum ada praktikum terjadwal di laboratorium ini.</Text>
            ) : null}
            {aktivitas.berlangsung.length === 0 && aktivitas.berikutnya ? (
              <Text style={styles.meta}>Tidak ada praktikum yang sedang berlangsung.</Text>
            ) : null}
            {aktivitas.berlangsung.map((s) => (
              <BarisSesi key={s.id} judul="Sedang berlangsung" sesi={s} />
            ))}
            {aktivitas.berikutnya ? <BarisSesi judul="Berikutnya" sesi={aktivitas.berikutnya} /> : null}
          </View>
        ) : labs.length > 0 ? (
          <Text style={styles.petunjuk}>Pilih marker atau laboratorium di bawah untuk melihat aktivitasnya.</Text>
        ) : null}

        {labs.map((lab) => (
          <Pressable
            key={lab.id}
            accessibilityRole="button"
            onPress={() => pilih(lab)}
            style={[styles.labItem, lab.id === terpilihId && styles.labItemAktif]}
          >
            <Ionicons name="location-outline" size={18} color={colors.navy} />
            <Text style={styles.labItemNama}>{lab.nama}</Text>
            {lokasi.koordinat ? (
              <Text style={styles.meta}>{formatJarak(jarakMeter(lokasi.koordinat, titikLab(lab)))}</Text>
            ) : null}
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  petaBox: { flex: 1.1, backgroundColor: colors.tile },
  tengah: { flex: 1 },
  panel: { flex: 1, backgroundColor: colors.surface },
  panelIsi: { padding: spacing.lg, gap: spacing.md },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.dangerBg,
    borderBottomWidth: 1,
    borderBottomColor: colors.dangerBorder,
  },
  bannerText: { ...typography.body, color: colors.danger, flex: 1 },
  bannerAksi: { ...typography.bodyBold, color: colors.navy },
  bannerNetral: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, justifyContent: 'center', backgroundColor: colors.neutralBg },
  bannerNetralText: { ...typography.caption, color: colors.neutralText },
  detail: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  labNama: { ...typography.title, color: colors.textPrimary },
  meta: { ...typography.body, color: colors.textSecondary },
  petunjuk: { ...typography.body, color: colors.textSecondary },
  sesi: { gap: 4, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.divider, alignItems: 'flex-start' },
  sesiJudul: { ...typography.captionBold, color: colors.navyMuted },
  sesiNama: { ...typography.bodyBold, color: colors.textPrimary },
  labItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  labItemAktif: { borderColor: colors.navy, backgroundColor: colors.background },
  labItemNama: { ...typography.bodyBold, color: colors.textPrimary, flex: 1 },
  errorBox: { gap: spacing.sm },
  errorText: { ...typography.body, color: colors.danger },
});