import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AppHeader } from '../../components/AppHeader';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ConfirmModal } from '../../components/ConfirmModal';
import { EmptyState } from '../../components/EmptyState';
import { IconButton } from '../../components/IconButton';
import { useCurrentAslab, usePrakti } from '../../context/PraktiContext';
import { useLaboratorium, useLabPraktikum } from '../../features/laboratorium/hooks';
import { ambilLokasiSekarang } from '../../features/laboratorium/lokasi';
import {
  NOMINAL_DENDA_DEFAULT,
  RADIUS_DEFAULT,
  TOLERANSI_DEFAULT,
  type LabPraktikum,
  type LabPraktikumFormValues,
} from '../../features/laboratorium/models';
import {
  formatLabError,
  hapusLabPraktikum,
  simpanLabPraktikum,
} from '../../features/laboratorium/repository';
import { colors, radius, spacing, typography } from '../../theme';

const KOSONG: LabPraktikumFormValues = {
  kode: '',
  namaLab: '',
  namaPraktikum: '',
  lokasi: '',
  lat: '',
  lng: '',
  radiusMeter: String(RADIUS_DEFAULT),
  toleransiMenit: String(TOLERANSI_DEFAULT),
  nominalDenda: String(NOMINAL_DENDA_DEFAULT),
};

function formatRupiah(nilai: number): string {
  return `Rp${Math.round(nilai).toLocaleString('id-ID')}`;
}

/**
 * Kelola Lab & Kebijakan Presensi milik Aslab (SRS-020).
 * Mengelola nama, mata kuliah, lokasi/ruang fisik, koordinat, radius, toleransi keterlambatan, dan nominal denda.
 */
export function KelolaLabScreen({ navigation }: { navigation: any }) {
  const aslab = useCurrentAslab();
  const { practicum } = usePrakti();
  const isDemo = !practicum;
  const { data, loading, error, retry } = useLabPraktikum(aslab?.id ?? null, isDemo);
  const ruangFisik = useLaboratorium(isDemo);

  const [editor, setEditor] = useState<{
    id: string | null;
    selectedLabId: string | null;
    values: LabPraktikumFormValues;
  } | null>(null);
  const [hapusTarget, setHapusTarget] = useState<LabPraktikum | null>(null);
  const [busy, setBusy] = useState(false);
  const [pesanForm, setPesanForm] = useState<string | null>(null);
  const [pesanHalaman, setPesanHalaman] = useState<string | null>(null);

  if (!aslab) return null;

  const bukaTambah = () => {
    setPesanForm(null);
    setPesanHalaman(null);
    setEditor({ id: null, selectedLabId: null, values: { ...KOSONG } });
  };

  const bukaUbah = (lab: LabPraktikum) => {
    setPesanForm(null);
    setPesanHalaman(null);
    setEditor({
      id: lab.id,
      selectedLabId: lab.labId || null,
      values: {
        kode: lab.kode,
        namaLab: lab.namaLab,
        namaPraktikum: lab.namaPraktikum,
        lokasi: lab.lokasi === '-' ? '' : lab.lokasi,
        lat: lab.lat !== null ? String(lab.lat) : '',
        lng: lab.lng !== null ? String(lab.lng) : '',
        radiusMeter: String(lab.radiusMeter ?? RADIUS_DEFAULT),
        toleransiMenit: String(lab.toleransiMenit),
        nominalDenda: String(lab.nominalDenda),
      },
    });
  };

  const ubahField = (key: keyof LabPraktikumFormValues, value: string) =>
    setEditor((e) => (e ? { ...e, values: { ...e.values, [key]: value } } : e));

  const pilihRuangFisik = (roomId: string | null) => {
    setEditor((e) => {
      if (!e) return e;
      if (!roomId) {
        return {
          ...e,
          selectedLabId: null,
          values: {
            ...e.values,
            lokasi: '',
            lat: '',
            lng: '',
            radiusMeter: String(RADIUS_DEFAULT),
          },
        };
      }
      const room = ruangFisik.data.find((r) => r.id === roomId);
      if (!room) return e;
      return {
        ...e,
        selectedLabId: room.id,
        values: {
          ...e.values,
          lokasi: room.nama,
          lat: String(room.lat),
          lng: String(room.lng),
          radiusMeter: String(room.radiusMeter),
        },
      };
    });
  };

  async function gunakanLokasiSaya() {
    setBusy(true);
    setPesanForm(null);
    try {
      const { latitude, longitude } = await ambilLokasiSekarang();
      ubahField('lat', latitude.toFixed(6));
      ubahField('lng', longitude.toFixed(6));
    } catch (err) {
      setPesanForm(err instanceof Error ? err.message : 'Gagal mengambil lokasi.');
    } finally {
      setBusy(false);
    }
  }

  async function simpan() {
    if (!editor) return;
    setBusy(true);
    setPesanForm(null);
    try {
      await simpanLabPraktikum(editor.id, editor.values, {
        selectedLabId: editor.selectedLabId,
      });
      setEditor(null);
    } catch (err) {
      setPesanForm(formatLabError(err));
    } finally {
      setBusy(false);
    }
  }

  async function konfirmasiHapus() {
    if (!hapusTarget) return;
    setBusy(true);
    setPesanHalaman(null);
    try {
      await hapusLabPraktikum(hapusTarget.id);
      setHapusTarget(null);
    } catch (err) {
      setHapusTarget(null);
      setPesanHalaman(formatLabError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.root}>
      <AppHeader
        subtitle="Kelola Lab & Kebijakan"
        onBack={() => navigation.goBack()}
        right={
          <IconButton
            icon="cloud-upload-outline"
            label="Impor CSV Lab"
            onPress={() => navigation.navigate('ImporLab')}
          />
        }
      />

      <View style={styles.container}>
        {pesanHalaman ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
            <Text style={styles.errorBannerText}>{pesanHalaman}</Text>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.navy} />
            <Text style={styles.meta}>Memuat daftar Lab…</Text>
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Text style={styles.error}>{error}</Text>
            <Button label="Coba Lagi" variant="outline" onPress={retry} />
          </View>
        ) : (
          <FlatList
            data={data}
            keyExtractor={(lab) => lab.id}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <EmptyState
                icon="business-outline"
                title="Belum ada Lab"
                description="Tambahkan Lab baru secara langsung atau impor banyak Lab sekaligus lewat CSV."
              />
            }
            renderItem={({ item }) => (
              <Card style={styles.item}>
                <View style={styles.cardTop}>
                  <View style={styles.flex}>
                    <Text style={styles.nama}>{item.namaLab}</Text>
                    <Text style={styles.matkul}>{item.namaPraktikum}</Text>
                  </View>
                  <View style={styles.kodeBadge}>
                    <Text style={styles.kodeText}>{item.kode}</Text>
                  </View>
                </View>

                <Text style={styles.meta}>
                  Lokasi: {item.lokasi}
                  {item.lat !== null && item.lng !== null
                    ? ` (${item.lat.toFixed(5)}, ${item.lng.toFixed(5)})`
                    : ''}
                </Text>
                <Text style={styles.meta}>
                  Radius {item.radiusMeter ?? '-'} m · Toleransi {item.toleransiMenit} menit · Denda{' '}
                  {formatRupiah(item.nominalDenda)}
                </Text>
                <Text style={styles.stats}>
                  {item.participantCount} peserta · {item.scheduleCount} jadwal · {item.sessionCount}{' '}
                  sesi
                </Text>

                <View style={styles.aksi}>
                  <Button
                    label="Ubah"
                    variant="outline"
                    icon="create-outline"
                    onPress={() => bukaUbah(item)}
                    style={styles.flex}
                  />
                  <Button
                    label="Hapus"
                    variant="danger"
                    icon="trash-outline"
                    onPress={() => setHapusTarget(item)}
                    style={styles.flex}
                  />
                </View>
                <View style={styles.aksiSecondary}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => navigation.navigate('ImporPraktikan', { classId: item.id })}
                    style={styles.linkBtn}
                  >
                    <Ionicons name="people-outline" size={16} color={colors.navy} />
                    <Text style={styles.linkText}>Kelola Praktikan</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => navigation.navigate('ImporAsprak', { classId: item.id })}
                    style={styles.linkBtn}
                  >
                    <Ionicons name="school-outline" size={16} color={colors.navy} />
                    <Text style={styles.linkText}>Kelola Asprak</Text>
                  </Pressable>
                </View>
              </Card>
            )}
          />
        )}

        {!loading && !error ? (
          <View style={styles.footer}>
            <Button
              label="Tambah Lab"
              icon="add"
              onPress={bukaTambah}
              style={styles.flex}
            />
            <Button
              label="Bulk CSV"
              variant="outline"
              icon="document-text-outline"
              onPress={() => navigation.navigate('ImporLab')}
            />
          </View>
        ) : null}
      </View>

      <Modal
        visible={!!editor}
        animationType="slide"
        transparent
        onRequestClose={() => {
          if (!busy) setEditor(null);
        }}
      >
        <View style={styles.overlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.sheet}
          >
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.sheetTitle}>
                {editor?.id ? 'Ubah Lab & Kebijakan' : 'Tambah Lab Baru'}
              </Text>

              <Text style={styles.label}>Nama Lab</Text>
              <TextInput
                style={styles.input}
                value={editor?.values.namaLab ?? ''}
                onChangeText={(v) => ubahField('namaLab', v)}
                placeholder="cth. Lab A"
                placeholderTextColor={colors.textSecondary}
                maxLength={120}
                editable={!busy}
              />

              <Text style={styles.label}>Kode Lab</Text>
              <TextInput
                style={styles.input}
                value={editor?.values.kode ?? ''}
                onChangeText={(v) => ubahField('kode', v)}
                placeholder="cth. BD-A"
                placeholderTextColor={colors.textSecondary}
                maxLength={40}
                autoCapitalize="characters"
                editable={!busy}
              />

              <Text style={styles.label}>Mata Kuliah</Text>
              <TextInput
                style={styles.input}
                value={editor?.values.namaPraktikum ?? ''}
                onChangeText={(v) => ubahField('namaPraktikum', v)}
                placeholder="cth. Basis Data"
                placeholderTextColor={colors.textSecondary}
                maxLength={120}
                editable={!busy}
              />

              <Text style={styles.label}>Ruang Fisik Laboratorium</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipsRow}
              >
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ checked: editor?.selectedLabId === null }}
                  disabled={busy}
                  onPress={() => pilihRuangFisik(null)}
                  style={[
                    styles.chip,
                    editor?.selectedLabId === null && styles.chipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      editor?.selectedLabId === null && styles.chipTextActive,
                    ]}
                  >
                    + Lokasi Baru
                  </Text>
                </Pressable>
                {ruangFisik.data.map((room) => {
                  const selected = editor?.selectedLabId === room.id;
                  return (
                    <Pressable
                      key={room.id}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      disabled={busy}
                      onPress={() => pilihRuangFisik(room.id)}
                      style={[styles.chip, selected && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextActive]}>
                        {room.nama}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <Text style={styles.label}>Nama Lokasi / Ruangan</Text>
              <TextInput
                style={styles.input}
                value={editor?.values.lokasi ?? ''}
                onChangeText={(v) => ubahField('lokasi', v)}
                placeholder="cth. Lab Komputer 1"
                placeholderTextColor={colors.textSecondary}
                maxLength={80}
                editable={!busy}
              />

              <View style={styles.row2}>
                <View style={styles.flex}>
                  <Text style={styles.label}>Latitude</Text>
                  <TextInput
                    style={styles.input}
                    value={editor?.values.lat ?? ''}
                    onChangeText={(v) => ubahField('lat', v)}
                    placeholder="-7.050000"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="numbers-and-punctuation"
                    editable={!busy}
                  />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.label}>Longitude</Text>
                  <TextInput
                    style={styles.input}
                    value={editor?.values.lng ?? ''}
                    onChangeText={(v) => ubahField('lng', v)}
                    placeholder="110.440000"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="numbers-and-punctuation"
                    editable={!busy}
                  />
                </View>
              </View>

              <Pressable onPress={gunakanLokasiSaya} disabled={busy} style={styles.lokasiBtn}>
                <Ionicons name="locate-outline" size={18} color={colors.navy} />
                <Text style={styles.lokasiText}>Gunakan lokasi saya sekarang</Text>
              </Pressable>

              <Text style={styles.label}>Radius Presensi (10–1000 m)</Text>
              <TextInput
                style={styles.input}
                value={editor?.values.radiusMeter ?? ''}
                onChangeText={(v) => ubahField('radiusMeter', v)}
                keyboardType="number-pad"
                placeholder="50"
                placeholderTextColor={colors.textSecondary}
                maxLength={4}
                editable={!busy}
              />

              <View style={styles.row2}>
                <View style={styles.flex}>
                  <Text style={styles.label}>Toleransi (0–120 mnt)</Text>
                  <TextInput
                    style={styles.input}
                    value={editor?.values.toleransiMenit ?? ''}
                    onChangeText={(v) => ubahField('toleransiMenit', v)}
                    keyboardType="number-pad"
                    placeholder="15"
                    placeholderTextColor={colors.textSecondary}
                    maxLength={3}
                    editable={!busy}
                  />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.label}>Nominal Denda (Rp)</Text>
                  <TextInput
                    style={styles.input}
                    value={editor?.values.nominalDenda ?? ''}
                    onChangeText={(v) => ubahField('nominalDenda', v)}
                    keyboardType="number-pad"
                    placeholder="10000"
                    placeholderTextColor={colors.textSecondary}
                    maxLength={9}
                    editable={!busy}
                  />
                </View>
              </View>

              {pesanForm ? <Text style={styles.error}>{pesanForm}</Text> : null}

              <View style={styles.aksi}>
                <Button
                  label="Batal"
                  variant="outline"
                  onPress={() => setEditor(null)}
                  disabled={busy}
                  style={styles.flex}
                />
                <Button
                  label={busy ? 'Menyimpan…' : 'Simpan'}
                  onPress={simpan}
                  disabled={busy}
                  style={styles.flex}
                />
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <ConfirmModal
        visible={!!hapusTarget}
        title="Hapus Lab?"
        message={`"${hapusTarget?.namaLab ?? ''}" akan dihapus. Lab yang masih memiliki peserta atau sesi berjalan tidak bisa dihapus.`}
        confirmLabel="Hapus"
        tone="danger"
        onConfirm={konfirmasiHapus}
        onCancel={() => !busy && setHapusTarget(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1 },
  list: { padding: spacing.lg, gap: spacing.md, flexGrow: 1 },
  center: { flex: 1, padding: spacing.xl, gap: spacing.md, alignItems: 'center', justifyContent: 'center' },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.dangerBg,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
  },
  errorBannerText: { ...typography.caption, color: colors.danger, flex: 1 },
  item: { gap: spacing.xs },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  nama: { ...typography.subtitle, color: colors.textPrimary },
  matkul: { ...typography.bodyBold, color: colors.navyMuted },
  kodeBadge: {
    backgroundColor: colors.tile,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  kodeText: { ...typography.captionBold, color: colors.navy },
  meta: { ...typography.body, color: colors.textSecondary },
  stats: { ...typography.captionBold, color: colors.textPrimary, marginTop: 2 },
  aksi: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  aksiSecondary: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  linkBtn: {
    flex: 1,
    minHeight: 40,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.background,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
  },
  linkText: { ...typography.captionBold, color: colors.navy },
  flex: { flex: 1 },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    padding: spacing.lg,
    maxHeight: '92%',
  },
  sheetTitle: { ...typography.title, color: colors.textPrimary, marginBottom: spacing.sm },
  label: {
    ...typography.captionBold,
    color: colors.textSecondary,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    minHeight: 44,
    color: colors.textPrimary,
    backgroundColor: colors.background,
  },
  chipsRow: { gap: spacing.sm, paddingVertical: spacing.xs },
  chip: {
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  chipText: { ...typography.captionBold, color: colors.textPrimary },
  chipTextActive: { color: colors.surface },
  row2: { flexDirection: 'row', gap: spacing.sm },
  lokasiBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    minHeight: 36,
  },
  lokasiText: { ...typography.bodyBold, color: colors.navy },
  error: { ...typography.body, color: colors.danger, marginTop: spacing.md },
});
