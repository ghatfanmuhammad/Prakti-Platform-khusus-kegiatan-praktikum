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
import { useLaboratorium } from '../../features/laboratorium/hooks';
import { ambilLokasiSekarang } from '../../features/laboratorium/lokasi';
import {
  RADIUS_DEFAULT,
  type LabFormValues,
  type Laboratorium,
} from '../../features/laboratorium/models';
import { formatLabError, hapusLab, simpanLab } from '../../features/laboratorium/repository';
import { colors, radius, spacing, typography } from '../../theme';

const KOSONG: LabFormValues = {
  nama: '',
  latitude: '',
  longitude: '',
  radiusMeter: String(RADIUS_DEFAULT),
};

/** Kelola laboratorium: nama, koordinat, dan radius presensi (SRS-014, hanya asisten). */
export function KelolaLabScreen({ navigation }: { navigation: any }) {
  const { data, loading, error, retry } = useLaboratorium();
  const [editor, setEditor] = useState<{ id: string | null; values: LabFormValues } | null>(null);
  const [hapus, setHapus] = useState<Laboratorium | null>(null);
  const [busy, setBusy] = useState(false);
  const [pesanForm, setPesanForm] = useState<string | null>(null);
  const [pesanHalaman, setPesanHalaman] = useState<string | null>(null);

  const bukaTambah = () => {
    setPesanForm(null);
    setEditor({ id: null, values: KOSONG });
  };
  const bukaUbah = (lab: Laboratorium) => {
    setPesanForm(null);
    setEditor({
      id: lab.id,
      values: {
        nama: lab.nama,
        latitude: String(lab.latitude),
        longitude: String(lab.longitude),
        radiusMeter: String(lab.radiusMeter),
      },
    });
  };
  const ubahField = (key: keyof LabFormValues, value: string) =>
    setEditor((e) => (e ? { ...e, values: { ...e.values, [key]: value } } : e));

  async function gunakanLokasiSaya() {
    setBusy(true);
    setPesanForm(null);
    try {
      const { latitude, longitude } = await ambilLokasiSekarang();
      ubahField('latitude', latitude.toFixed(6));
      ubahField('longitude', longitude.toFixed(6));
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
      await simpanLab(editor.id, editor.values);
      setEditor(null);
    } catch (err) {
      setPesanForm(formatLabError(err));
    } finally {
      setBusy(false);
    }
  }

  async function konfirmasiHapus() {
    if (!hapus) return;
    setBusy(true);
    try {
      await hapusLab(hapus.id);
      setHapus(null);
    } catch (err) {
      setHapus(null);
      setPesanHalaman(formatLabError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.root}>
      <AppHeader subtitle="Kelola Laboratorium" onBack={() => navigation.goBack()} />
      <View style={styles.container}>
        {pesanHalaman ? <Text style={styles.error}>{pesanHalaman}</Text> : null}

        {loading ? (
          <ActivityIndicator color={colors.navy} style={{ marginTop: spacing.xl }} />
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
                icon="location-outline"
                title="Belum ada laboratorium"
                description="Tambahkan laboratorium beserta koordinat dan radius presensinya."
              />
            }
            renderItem={({ item }) => (
              <Card style={styles.item}>
                <Text style={styles.nama}>{item.nama}</Text>
                <Text style={styles.meta}>
                  {item.latitude.toFixed(6)}, {item.longitude.toFixed(6)}
                </Text>
                <Text style={styles.meta}>Radius presensi {item.radiusMeter} m</Text>
                <View style={styles.aksi}>
                  <Button label="Ubah" variant="outline" icon="create-outline" onPress={() => bukaUbah(item)} style={styles.flex} />
                  <Button label="Hapus" variant="danger" icon="trash-outline" onPress={() => setHapus(item)} style={styles.flex} />
                </View>
              </Card>
            )}
          />
        )}

        {!loading && !error ? (
          <View style={styles.footer}>
            <Button label="Tambah Laboratorium" icon="add" onPress={bukaTambah} />
          </View>
        ) : null}
      </View>

      <Modal visible={!!editor} animationType="slide" transparent onRequestClose={() => setEditor(null)}>
        <View style={styles.overlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheet}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.sheetTitle}>{editor?.id ? 'Ubah Laboratorium' : 'Tambah Laboratorium'}</Text>

              <Text style={styles.label}>Nama laboratorium</Text>
              <TextInput
                style={styles.input}
                value={editor?.values.nama ?? ''}
                onChangeText={(v) => ubahField('nama', v)}
                placeholder="Lab Komputer 1"
                placeholderTextColor={colors.textSecondary}
                maxLength={80}
                editable={!busy}
              />

              <Text style={styles.label}>Latitude</Text>
              <TextInput
                style={styles.input}
                value={editor?.values.latitude ?? ''}
                onChangeText={(v) => ubahField('latitude', v)}
                placeholder="-7.050000"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numbers-and-punctuation"
                editable={!busy}
              />

              <Text style={styles.label}>Longitude</Text>
              <TextInput
                style={styles.input}
                value={editor?.values.longitude ?? ''}
                onChangeText={(v) => ubahField('longitude', v)}
                placeholder="110.440000"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numbers-and-punctuation"
                editable={!busy}
              />

              <Pressable onPress={gunakanLokasiSaya} disabled={busy} style={styles.lokasiBtn}>
                <Ionicons name="locate-outline" size={18} color={colors.navy} />
                <Text style={styles.lokasiText}>Gunakan lokasi saya sekarang</Text>
              </Pressable>

              <Text style={styles.label}>Radius presensi (meter)</Text>
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

              {pesanForm ? <Text style={styles.error}>{pesanForm}</Text> : null}

              <View style={styles.aksi}>
                <Button label="Batal" variant="outline" onPress={() => setEditor(null)} disabled={busy} style={styles.flex} />
                <Button label={busy ? 'Menyimpan…' : 'Simpan'} onPress={simpan} disabled={busy} style={styles.flex} />
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <ConfirmModal
        visible={!!hapus}
        title="Hapus laboratorium?"
        message={`"${hapus?.nama ?? ''}" akan dihapus. Jadwal yang memakai laboratorium ini tidak akan tampil di peta.`}
        confirmLabel="Hapus"
        tone="danger"
        onConfirm={konfirmasiHapus}
        onCancel={() => setHapus(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1 },
  list: { padding: spacing.lg, gap: spacing.md, flexGrow: 1 },
  center: { padding: spacing.xl, gap: spacing.md, alignItems: 'center' },
  item: { gap: spacing.xs },
  nama: { ...typography.subtitle, color: colors.textPrimary },
  meta: { ...typography.body, color: colors.textSecondary },
  aksi: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  flex: { flex: 1 },
  footer: { padding: spacing.lg, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    padding: spacing.lg,
    maxHeight: '90%',
  },
  sheetTitle: { ...typography.title, color: colors.textPrimary, marginBottom: spacing.md },
  label: { ...typography.captionBold, color: colors.textSecondary, marginTop: spacing.md, marginBottom: spacing.xs },
  input: {
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    color: colors.textPrimary,
    backgroundColor: colors.background,
  },
  lokasiBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  lokasiText: { ...typography.bodyBold, color: colors.navy },
  error: { ...typography.body, color: colors.danger, marginTop: spacing.md },
});