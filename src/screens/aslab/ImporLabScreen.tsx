import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
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
import { EmptyState } from '../../components/EmptyState';
import { SegmentedControl } from '../../components/SegmentedControl';
import { useCurrentAslab, usePrakti } from '../../context/PraktiContext';
import { DaftarTinjauan } from '../../features/impor/DaftarTinjauan';
import { parseCsv } from '../../features/impor/csv';
import {
  buatRevalidatorLab,
  petakanCsvLab,
  type BarisLabImpor,
} from '../../features/impor/pencocokan';
import {
  barisSiapSimpan,
  buatBarisTinjauan,
  terimaSemuaValid,
  toggleStatusBaris,
  tolakSemua,
  ubahBaris,
  type BarisTinjauan,
  type HasilSimpanMassal,
} from '../../features/impor/review';
import {
  pilihFileCsv,
  TEMPLATE_LAB,
  unduhTemplateCsv,
} from '../../features/impor/template';
import { useLabPraktikum } from '../../features/laboratorium/hooks';
import { ambilLokasiSekarang } from '../../features/laboratorium/lokasi';
import {
  NOMINAL_DENDA_DEFAULT,
  RADIUS_DEFAULT,
  TOLERANSI_DEFAULT,
} from '../../features/laboratorium/models';
import {
  formatLabError,
  simpanLabPraktikum,
} from '../../features/laboratorium/repository';
import { colors, radius, spacing, typography } from '../../theme';

type Mode = 'bulk' | 'single';

const MODE_OPTIONS: { key: Mode; label: string }[] = [
  { key: 'bulk', label: 'Bulk CSV' },
  { key: 'single', label: 'Tambah Satu' },
];

const SINGLE_KOSONG: Omit<BarisLabImpor, 'namaPraktikum'> = {
  kode: '',
  namaLab: '',
  lokasi: '',
  lat: '',
  lng: '',
  radiusMeter: String(RADIUS_DEFAULT),
  toleransiMenit: String(TOLERANSI_DEFAULT),
  nominalDenda: String(NOMINAL_DENDA_DEFAULT),
};

/**
 * Insert single dan bulk Lab per mata kuliah (SRS-021).
 * Seluruh baris diikat ke satu mata kuliah dan ditinjau per baris sebelum disimpan.
 */
export function ImporLabScreen({ navigation }: { navigation: any }) {
  const aslab = useCurrentAslab();
  const { practicum } = usePrakti();
  const labs = useLabPraktikum(aslab?.id ?? null, !practicum);

  const [mode, setMode] = useState<Mode>('bulk');
  const [mataKuliah, setMataKuliah] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<BarisTinjauan<BarisLabImpor>[]>([]);
  const [editingRow, setEditingRow] = useState<BarisTinjauan<BarisLabImpor> | null>(null);
  const [singleValues, setSingleValues] = useState(SINGLE_KOSONG);
  const [busy, setBusy] = useState(false);
  const [pesan, setPesan] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [hasilSimpan, setHasilSimpan] = useState<HasilSimpanMassal | null>(null);

  const daftarMataKuliah = useMemo(() => {
    const unik = new Set(labs.data.map((l) => l.namaPraktikum).filter(Boolean));
    return [...unik].sort((a, b) => a.localeCompare(b, 'id'));
  }, [labs.data]);

  const revalidator = useMemo(
    () => buatRevalidatorLab(mataKuliah, labs.data),
    [mataKuliah, labs.data],
  );

  const handleUbahMataKuliah = (nextMatkul: string) => {
    setMataKuliah(nextMatkul);
    setHasilSimpan(null);
    setRows((prev) => {
      if (prev.length === 0) return prev;
      const nextRev = buatRevalidatorLab(nextMatkul, labs.data);
      const boundItems = prev.map((r) => ({
        id: r.id,
        nomorBaris: r.nomorBaris,
        data: { ...r.data, namaPraktikum: nextMatkul.trim() },
      }));
      const errMap = nextRev(boundItems);
      return prev.map((r) => {
        const errors = errMap.get(r.id) ?? [];
        return {
          ...r,
          data: { ...r.data, namaPraktikum: nextMatkul.trim() },
          errors,
          status: errors.length > 0 ? 'ditolak' : r.status,
        };
      });
    });
  };

  if (!aslab) return null;

  async function handleUnduhTemplate() {
    setBusy(true);
    setErrorMsg(null);
    setPesan(null);
    try {
      await unduhTemplateCsv(TEMPLATE_LAB);
      setPesan(`Template ${TEMPLATE_LAB.filename} siap dibagikan/disimpan.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal membuat template CSV.');
    } finally {
      setBusy(false);
    }
  }

  async function handlePilihCsv() {
    setBusy(true);
    setErrorMsg(null);
    setPesan(null);
    setHasilSimpan(null);
    try {
      const file = await pilihFileCsv();
      if (!file) return;
      const parsed = parseCsv(file.content);
      const mapped = petakanCsvLab(parsed.rows, mataKuliah);
      if (mapped.length === 0) {
        throw new Error('File CSV tidak memiliki baris data.');
      }
      setFileName(file.name);
      setRows(buatBarisTinjauan(mapped, revalidator));
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal membaca file CSV.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSimpanBulk() {
    if (!mataKuliah.trim()) {
      setErrorMsg('Isi atau pilih mata kuliah terlebih dahulu sebelum menyimpan.');
      return;
    }
    const targetRows = barisSiapSimpan(rows);
    const dilewati = rows.length - targetRows.length;
    if (targetRows.length === 0) {
      setErrorMsg('Tidak ada baris yang diterima dan valid untuk disimpan.');
      return;
    }

    setBusy(true);
    setErrorMsg(null);
    setPesan(null);
    let berhasil = 0;
    const galatBaris: { nomorBaris: number; pesan: string }[] = [];

    for (const row of targetRows) {
      try {
        await simpanLabPraktikum(null, {
          ...row.data,
          namaPraktikum: mataKuliah.trim(),
        });
        berhasil += 1;
      } catch (err) {
        galatBaris.push({
          nomorBaris: row.nomorBaris,
          pesan: formatLabError(err),
        });
      }
    }

    setHasilSimpan({
      berhasil,
      dilewati,
      gagal: galatBaris.length,
      galatBaris,
    });
    if (berhasil > 0 && galatBaris.length === 0) {
      setPesan(`${berhasil} Lab untuk ${mataKuliah.trim()} berhasil disimpan.`);
    }
    setBusy(false);
  }

  async function handleSimpanSingle() {
    setBusy(true);
    setErrorMsg(null);
    setPesan(null);
    try {
      await simpanLabPraktikum(null, {
        ...singleValues,
        namaPraktikum: mataKuliah.trim(),
      });
      setSingleValues(SINGLE_KOSONG);
      setPesan(`Lab ${singleValues.namaLab.trim()} berhasil ditambahkan ke ${mataKuliah.trim()}.`);
    } catch (err) {
      setErrorMsg(formatLabError(err));
    } finally {
      setBusy(false);
    }
  }

  async function isiLokasiSingle() {
    setBusy(true);
    setErrorMsg(null);
    try {
      const { latitude, longitude } = await ambilLokasiSekarang();
      setSingleValues((prev) => ({
        ...prev,
        lat: latitude.toFixed(6),
        lng: longitude.toFixed(6),
      }));
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal mengambil lokasi.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.root}>
      <AppHeader subtitle="Tambah & Impor Lab" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Mata Kuliah Target</Text>
          <Text style={styles.helper}>
            Seluruh Lab yang ditambahkan pada halaman ini terikat ke satu mata kuliah.
          </Text>
          <TextInput
            style={styles.input}
            value={mataKuliah}
            onChangeText={handleUbahMataKuliah}
            placeholder="cth. Basis Data"
            placeholderTextColor={colors.textSecondary}
            maxLength={120}
            editable={!busy}
          />
          {daftarMataKuliah.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsRow}
            >
              {daftarMataKuliah.map((mk) => {
                const active = mataKuliah.trim().toLowerCase() === mk.toLowerCase();
                return (
                  <Pressable
                    key={mk}
                    accessibilityRole="button"
                    disabled={busy}
                    onPress={() => handleUbahMataKuliah(mk)}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{mk}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}
        </Card>

        <SegmentedControl
          options={MODE_OPTIONS}
          value={mode}
          onChange={(m) => {
            setMode(m);
            setErrorMsg(null);
            setPesan(null);
          }}
        />

        {errorMsg ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        ) : null}

        {pesan ? (
          <View style={styles.successBanner}>
            <Ionicons name="checkmark-circle-outline" size={18} color={colors.successText} />
            <Text style={styles.successText}>{pesan}</Text>
          </View>
        ) : null}

        {mode === 'bulk' ? (
          <View style={styles.section}>
            <Card style={styles.card}>
              <Text style={styles.sectionTitle}>Unggah File CSV Lab</Text>
              <Text style={styles.helper}>
                Kolom: kode, nama_lab, lokasi, latitude, longitude, radius_meter, toleransi_menit,
                nominal_denda.
              </Text>
              <View style={styles.actionRow}>
                <Button
                  label="Unduh Template"
                  variant="outline"
                  icon="download-outline"
                  disabled={busy}
                  onPress={handleUnduhTemplate}
                  style={styles.flex}
                />
                <Button
                  label="Pilih CSV"
                  icon="document-attach-outline"
                  disabled={busy}
                  onPress={handlePilihCsv}
                  style={styles.flex}
                />
              </View>
              {fileName ? <Text style={styles.fileInfo}>File aktif: {fileName}</Text> : null}
            </Card>

            {rows.length === 0 ? (
              <EmptyState
                icon="document-text-outline"
                title="Belum ada baris CSV"
                description="Unduh template CSV, isi daftar Lab, lalu pilih file untuk meninjau setiap baris."
              />
            ) : (
              <DaftarTinjauan
                rows={rows}
                busy={busy}
                saveLabel="Simpan Lab Valid"
                hasilSimpan={hasilSimpan}
                onToggleStatus={(id) => setRows((prev) => toggleStatusBaris(prev, id))}
                onEditRow={(row) => setEditingRow(row)}
                onAcceptAllValid={() => setRows((prev) => terimaSemuaValid(prev))}
                onRejectAll={() => setRows((prev) => tolakSemua(prev))}
                onSave={handleSimpanBulk}
                renderRowContent={(row) => (
                  <View style={styles.rowDetail}>
                    <Text style={styles.rowTitle}>
                      {row.data.namaLab || '(Nama Lab kosong)'} · {row.data.kode || '(Kode kosong)'}
                    </Text>
                    <Text style={styles.rowMeta}>
                      Lokasi: {row.data.lokasi || '-'} ({row.data.lat || '-'}, {row.data.lng || '-'})
                    </Text>
                    <Text style={styles.rowMeta}>
                      Radius {row.data.radiusMeter || '-'} m · Toleransi{' '}
                      {row.data.toleransiMenit || '-'} mnt · Denda Rp{row.data.nominalDenda || '-'}
                    </Text>
                  </View>
                )}
              />
            )}
          </View>
        ) : (
          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Tambah Satu Lab</Text>
            <LabFieldsForm
              values={singleValues}
              busy={busy}
              onChange={(key, value) =>
                setSingleValues((prev) => ({ ...prev, [key]: value }))
              }
              onPickGps={isiLokasiSingle}
            />
            <Button
              label={busy ? 'Menyimpan…' : 'Simpan Lab'}
              icon="save-outline"
              disabled={busy}
              onPress={handleSimpanSingle}
            />
          </Card>
        )}
      </ScrollView>

      <Modal
        visible={!!editingRow}
        animationType="slide"
        transparent
        onRequestClose={() => {
          if (!busy) setEditingRow(null);
        }}
      >
        <View style={styles.overlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.sheet}
          >
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.sheetTitle}>
                Ubah / Lengkapi Baris #{editingRow?.nomorBaris}
              </Text>
              <Text style={styles.helper}>
                Mata kuliah: {mataKuliah.trim() || '(Belum diisi di halaman utama)'}
              </Text>
              {editingRow ? (
                <LabFieldsForm
                  values={editingRow.data}
                  busy={busy}
                  onChange={(key, value) =>
                    setEditingRow((prev) =>
                      prev ? { ...prev, data: { ...prev.data, [key]: value } } : prev,
                    )
                  }
                />
              ) : null}
              <View style={styles.actionRow}>
                <Button
                  label="Batal"
                  variant="outline"
                  disabled={busy}
                  onPress={() => setEditingRow(null)}
                  style={styles.flex}
                />
                <Button
                  label="Terapkan"
                  disabled={busy}
                  onPress={() => {
                    if (!editingRow) return;
                    setRows((prev) =>
                      ubahBaris(
                        prev,
                        editingRow.id,
                        { ...editingRow.data, namaPraktikum: mataKuliah.trim() },
                        revalidator,
                      ),
                    );
                    setEditingRow(null);
                  }}
                  style={styles.flex}
                />
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

function LabFieldsForm({
  values,
  busy,
  onChange,
  onPickGps,
}: {
  values: Omit<BarisLabImpor, 'namaPraktikum'>;
  busy: boolean;
  onChange: (key: keyof Omit<BarisLabImpor, 'namaPraktikum'>, value: string) => void;
  onPickGps?: () => void;
}) {
  return (
    <View style={styles.formGap}>
      <Text style={styles.label}>Kode Lab</Text>
      <TextInput
        style={styles.input}
        value={values.kode}
        onChangeText={(v) => onChange('kode', v)}
        placeholder="BD-A"
        placeholderTextColor={colors.textSecondary}
        editable={!busy}
      />

      <Text style={styles.label}>Nama Lab</Text>
      <TextInput
        style={styles.input}
        value={values.namaLab}
        onChangeText={(v) => onChange('namaLab', v)}
        placeholder="Lab A"
        placeholderTextColor={colors.textSecondary}
        editable={!busy}
      />

      <Text style={styles.label}>Lokasi / Ruangan</Text>
      <TextInput
        style={styles.input}
        value={values.lokasi}
        onChangeText={(v) => onChange('lokasi', v)}
        placeholder="Lab Komputer 1"
        placeholderTextColor={colors.textSecondary}
        editable={!busy}
      />

      <View style={styles.actionRow}>
        <View style={styles.flex}>
          <Text style={styles.label}>Latitude</Text>
          <TextInput
            style={styles.input}
            value={values.lat}
            onChangeText={(v) => onChange('lat', v)}
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
            value={values.lng}
            onChangeText={(v) => onChange('lng', v)}
            placeholder="110.440000"
            placeholderTextColor={colors.textSecondary}
            keyboardType="numbers-and-punctuation"
            editable={!busy}
          />
        </View>
      </View>

      {onPickGps ? (
        <Pressable onPress={onPickGps} disabled={busy} style={styles.gpsBtn}>
          <Ionicons name="locate-outline" size={18} color={colors.navy} />
          <Text style={styles.gpsText}>Gunakan lokasi saya sekarang</Text>
        </Pressable>
      ) : null}

      <Text style={styles.label}>Radius Presensi (10–1000 m)</Text>
      <TextInput
        style={styles.input}
        value={values.radiusMeter}
        onChangeText={(v) => onChange('radiusMeter', v)}
        keyboardType="number-pad"
        placeholder="50"
        placeholderTextColor={colors.textSecondary}
        editable={!busy}
      />

      <View style={styles.actionRow}>
        <View style={styles.flex}>
          <Text style={styles.label}>Toleransi (0–120 mnt)</Text>
          <TextInput
            style={styles.input}
            value={values.toleransiMenit}
            onChangeText={(v) => onChange('toleransiMenit', v)}
            keyboardType="number-pad"
            placeholder="15"
            placeholderTextColor={colors.textSecondary}
            editable={!busy}
          />
        </View>
        <View style={styles.flex}>
          <Text style={styles.label}>Denda (Rp)</Text>
          <TextInput
            style={styles.input}
            value={values.nominalDenda}
            onChangeText={(v) => onChange('nominalDenda', v)}
            keyboardType="number-pad"
            placeholder="10000"
            placeholderTextColor={colors.textSecondary}
            editable={!busy}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl * 2 },
  section: { gap: spacing.md },
  card: { gap: spacing.sm },
  sectionTitle: { ...typography.subtitle, color: colors.textPrimary },
  helper: { ...typography.caption, color: colors.textSecondary },
  label: { ...typography.captionBold, color: colors.textSecondary, marginTop: spacing.xs },
  input: {
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    minHeight: 44,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
  chipsRow: { gap: spacing.sm, paddingTop: spacing.xs },
  chip: {
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    backgroundColor: colors.background,
  },
  chipActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  chipText: { ...typography.captionBold, color: colors.textPrimary },
  chipTextActive: { color: colors.surface },
  actionRow: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  fileInfo: { ...typography.captionBold, color: colors.navyMuted },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.dangerBg,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
  },
  errorText: { ...typography.caption, color: colors.danger, flex: 1 },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.successBg,
    borderWidth: 1,
    borderColor: colors.successBorder,
  },
  successText: { ...typography.captionBold, color: colors.successText, flex: 1 },
  rowDetail: { gap: 2 },
  rowTitle: { ...typography.bodyBold, color: colors.textPrimary },
  rowMeta: { ...typography.caption, color: colors.textSecondary },
  formGap: { gap: spacing.xs, marginBottom: spacing.md },
  gpsBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.xs },
  gpsText: { ...typography.bodyBold, color: colors.navy },
  overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    padding: spacing.lg,
    maxHeight: '90%',
  },
  sheetTitle: { ...typography.title, color: colors.textPrimary, marginBottom: spacing.xs },
});
