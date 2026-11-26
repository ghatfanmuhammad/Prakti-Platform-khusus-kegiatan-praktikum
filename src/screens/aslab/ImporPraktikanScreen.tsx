import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import { SegmentedControl } from '../../components/SegmentedControl';
import { useCurrentAslab, usePrakti } from '../../context/PraktiContext';
import { PindahPraktikanSheet } from '../../features/data-praktikum/PindahPraktikanSheet';
import { errorMessage } from '../../features/data-praktikum/errors';
import type { Participant, RiwayatPindah } from '../../features/data-praktikum/models';
import {
  ambilDaftarAkunPengguna,
  deleteRecord,
  saveRecord,
  subscribeRiwayatPindah,
} from '../../features/data-praktikum/repository';
import { DaftarTinjauan } from '../../features/impor/DaftarTinjauan';
import { parseCsv } from '../../features/impor/csv';
import {
  buatRevalidatorPraktikan,
  cariAkunPraktikan,
  lengkapiPraktikan,
  petakanCsvPraktikan,
  type AkunPenggunaRingkas,
  type BarisPraktikanImpor,
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
  TEMPLATE_PRAKTIKAN,
  unduhTemplateCsv,
} from '../../features/impor/template';
import { useLabPraktikum } from '../../features/laboratorium/hooks';
import { colors, radius, spacing, typography } from '../../theme';

type TabMode = 'daftar' | 'single' | 'bulk';

const TAB_OPTIONS: { key: TabMode; label: string }[] = [
  { key: 'daftar', label: 'Daftar & Pindah' },
  { key: 'single', label: 'Tambah Satu' },
  { key: 'bulk', label: 'Bulk CSV' },
];

/**
 * Manajemen, impor (single & bulk), dan pemindahan praktikan antar-Lab oleh Aslab (SRS-022).
 */
export function ImporPraktikanScreen({
  navigation,
  route,
}: {
  navigation: any;
  route?: { params?: { classId?: string } };
}) {
  const aslab = useCurrentAslab();
  const { practicum } = usePrakti();
  const isDemo = !practicum;
  const labs = useLabPraktikum(aslab?.id ?? null, isDemo);

  const [chosenClassId, setChosenClassId] = useState<string | null>(
    route?.params?.classId ?? null,
  );
  const [tab, setTab] = useState<TabMode>('daftar');

  // Daftar akun terdaftar untuk pencocokan NIM/email
  const [usersState, setUsersState] = useState<{
    attempt: number;
    data: AkunPenggunaRingkas[];
    loading: boolean;
    error: string | null;
  }>({ attempt: 0, data: [], loading: true, error: null });

  const [riwayat, setRiwayat] = useState<RiwayatPindah[]>([]);

  // Single insert state
  const [singleNim, setSingleNim] = useState('');
  const [singleEmail, setSingleEmail] = useState('');

  // Bulk insert state
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<BarisTinjauan<BarisPraktikanImpor>[]>([]);
  const [editingRow, setEditingRow] = useState<BarisTinjauan<BarisPraktikanImpor> | null>(null);
  const [hasilSimpan, setHasilSimpan] = useState<HasilSimpanMassal | null>(null);

  // Move & delete sheets
  const [pindahTarget, setPindahTarget] = useState<Participant | null>(null);
  const [hapusTarget, setHapusTarget] = useState<Participant | null>(null);

  const [busy, setBusy] = useState(false);
  const [pesan, setPesan] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!aslab || isDemo) return;
    let active = true;
    ambilDaftarAkunPengguna()
      .then((data) => {
        if (active) {
          setUsersState((prev) => ({ ...prev, data, loading: false, error: null }));
        }
      })
      .catch((err) => {
        if (active) {
          setUsersState((prev) => ({
            ...prev,
            loading: false,
            error: errorMessage(err),
          }));
        }
      });
    return () => {
      active = false;
    };
  }, [aslab, isDemo, usersState.attempt]);

  useEffect(() => {
    if (!aslab || isDemo) return;
    return subscribeRiwayatPindah(
      aslab.id,
      'praktikan',
      (items) => setRiwayat(items),
      () => {},
    );
  }, [aslab, isDemo]);

  const activeLab =
    labs.data.find((l) => l.id === chosenClassId) ?? labs.data[0] ?? null;
  const activeClassId = activeLab?.id ?? null;

  const roster = useMemo(() => {
    const list = practicum?.participants.data ?? [];
    return list
      .filter((p) => p.classId === activeClassId)
      .sort((a, b) => a.nama.localeCompare(b.nama, 'id'));
  }, [practicum?.participants.data, activeClassId]);

  const existingUids = useMemo(
    () => new Set(roster.map((p) => p.uid)),
    [roster],
  );

  const revalidator = useMemo(
    () => buatRevalidatorPraktikan(usersState.data, existingUids),
    [usersState.data, existingUids],
  );

  const singleMatch = useMemo(() => {
    if (!singleNim.trim() && !singleEmail.trim()) return null;
    const match = cariAkunPraktikan(singleNim, singleEmail, usersState.data);
    if (match.akun && existingUids.has(match.akun.uid)) {
      return { akun: match.akun, error: 'Praktikan sudah terdaftar di Lab ini.' };
    }
    return match;
  }, [singleNim, singleEmail, usersState.data, existingUids]);

  const labMap = useMemo(
    () => new Map(labs.data.map((l) => [l.id, `${l.namaLab} (${l.namaPraktikum})`])),
    [labs.data],
  );
  const userMap = useMemo(
    () => new Map(usersState.data.map((u) => [u.uid, `${u.name} (${u.nimOrCode})`])),
    [usersState.data],
  );

  if (!aslab) return null;

  async function handleUnduhTemplate() {
    setBusy(true);
    setErrorMsg(null);
    setPesan(null);
    try {
      await unduhTemplateCsv(TEMPLATE_PRAKTIKAN);
      setPesan(`Template ${TEMPLATE_PRAKTIKAN.filename} siap dibagikan/disimpan.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal membuat template CSV.');
    } finally {
      setBusy(false);
    }
  }

  async function handlePilihCsv() {
    if (!activeClassId) {
      setErrorMsg('Pilih Lab terlebih dahulu.');
      return;
    }
    setBusy(true);
    setErrorMsg(null);
    setPesan(null);
    setHasilSimpan(null);
    try {
      const file = await pilihFileCsv();
      if (!file) return;
      const parsed = parseCsv(file.content);
      const mapped = petakanCsvPraktikan(parsed.rows).map((item) => ({
        ...item,
        data: lengkapiPraktikan(item.data, usersState.data),
      }));
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

  async function handleSimpanSingle() {
    if (!activeLab) {
      setErrorMsg('Pilih Lab tujuan terlebih dahulu.');
      return;
    }
    if (!singleMatch?.akun || singleMatch.error) {
      setErrorMsg(singleMatch?.error ?? 'Masukkan NIM atau email praktikan yang terdaftar.');
      return;
    }

    setBusy(true);
    setErrorMsg(null);
    setPesan(null);
    try {
      const { akun } = singleMatch;
      await saveRecord('peserta', activeLab.id, null, {
        uid: akun.uid,
        nama: akun.name,
        nim: akun.nimOrCode,
      });
      setSingleNim('');
      setSingleEmail('');
      setPesan(`${akun.name} (${akun.nimOrCode}) berhasil dimasukkan ke ${activeLab.namaLab}.`);
    } catch (err) {
      setErrorMsg(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleSimpanBulk() {
    if (!activeLab) {
      setErrorMsg('Pilih Lab tujuan terlebih dahulu.');
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
      const matched = cariAkunPraktikan(row.data.nim, row.data.email, usersState.data);
      if (!matched.akun) {
        galatBaris.push({
          nomorBaris: row.nomorBaris,
          pesan: matched.error ?? 'Akun praktikan tidak ditemukan.',
        });
        continue;
      }
      try {
        await saveRecord('peserta', activeLab.id, null, {
          uid: matched.akun.uid,
          nama: row.data.nama.trim() || matched.akun.name,
          nim: matched.akun.nimOrCode,
        });
        berhasil += 1;
      } catch (err) {
        galatBaris.push({
          nomorBaris: row.nomorBaris,
          pesan: errorMessage(err),
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
      setPesan(`${berhasil} praktikan berhasil ditambahkan ke ${activeLab.namaLab}.`);
    }
    setBusy(false);
  }

  async function handleHapus() {
    if (!hapusTarget || !activeLab) return;
    setBusy(true);
    setErrorMsg(null);
    setPesan(null);
    try {
      await deleteRecord('peserta', activeLab.id, hapusTarget.id);
      setPesan(`${hapusTarget.nama} dihapus dari ${activeLab.namaLab}.`);
      setHapusTarget(null);
    } catch (err) {
      setHapusTarget(null);
      setErrorMsg(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.root}>
      <AppHeader subtitle="Praktikan Lab" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {labs.loading || (!isDemo && usersState.loading) ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.navy} />
            <Text style={styles.helper}>Memuat data Lab dan daftar akun…</Text>
          </View>
        ) : labs.error || usersState.error ? (
          <Card style={styles.card}>
            <Text style={styles.errorText}>{labs.error ?? usersState.error}</Text>
            <Button
              label="Coba Lagi"
              variant="outline"
              onPress={() => {
                labs.retry();
                setUsersState((prev) => ({ ...prev, attempt: prev.attempt + 1, loading: true }));
              }}
            />
          </Card>
        ) : labs.data.length === 0 ? (
          <EmptyState
            icon="business-outline"
            title="Belum ada Lab"
            description="Buat Lab di menu Kelola Lab sebelum memasukkan praktikan."
          />
        ) : (
          <>
            <Card style={styles.card}>
              <Text style={styles.sectionTitle}>Pilih Lab</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipsRow}
              >
                {labs.data.map((lab) => {
                  const selected = lab.id === activeClassId;
                  return (
                    <Pressable
                      key={lab.id}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      disabled={busy}
                      onPress={() => {
                        setChosenClassId(lab.id);
                        setRows([]);
                        setFileName(null);
                        setHasilSimpan(null);
                        setErrorMsg(null);
                        setPesan(null);
                      }}
                      style={[styles.chip, selected && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextActive]}>
                        {lab.namaLab} ({lab.kode})
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              {activeLab ? (
                <Text style={styles.helper}>
                  {activeLab.namaPraktikum} · {roster.length} praktikan terdaftar
                </Text>
              ) : null}
            </Card>

            <SegmentedControl
              options={TAB_OPTIONS}
              value={tab}
              onChange={(next) => {
                setTab(next);
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

            {tab === 'daftar' ? (
              <View style={styles.section}>
                {roster.length === 0 ? (
                  <EmptyState
                    icon="people-outline"
                    title="Belum ada praktikan di Lab ini"
                    description="Gunakan tab Tambah Satu atau Bulk CSV untuk memasukkan praktikan."
                  />
                ) : (
                  roster.map((item) => (
                    <Card key={item.id} style={styles.card}>
                      <Text style={styles.rowTitle}>{item.nama}</Text>
                      <Text style={styles.rowMeta}>NIM: {item.nim}</Text>
                      <View style={styles.actionRow}>
                        <Button
                          label="Pindah Lab"
                          variant="outline"
                          icon="swap-horizontal-outline"
                          disabled={busy || labs.data.length < 2}
                          onPress={() => setPindahTarget(item)}
                          style={styles.flex}
                        />
                        <Button
                          label="Hapus"
                          variant="danger"
                          icon="trash-outline"
                          disabled={busy}
                          onPress={() => setHapusTarget(item)}
                          style={styles.flex}
                        />
                      </View>
                    </Card>
                  ))
                )}

                <Card style={styles.card}>
                  <Text style={styles.sectionTitle}>Riwayat Pemindahan Praktikan</Text>
                  {riwayat.length === 0 ? (
                    <Text style={styles.helper}>Belum ada riwayat pemindahan praktikan.</Text>
                  ) : (
                    riwayat.slice(0, 10).map((item) => (
                      <View key={item.id} style={styles.historyItem}>
                        <Text style={styles.historyTitle}>
                          {userMap.get(item.uid) ?? item.uid}
                        </Text>
                        <Text style={styles.helper}>
                          {labMap.get(item.dariClassId) ?? item.dariClassId} →{' '}
                          {labMap.get(item.keClassId) ?? item.keClassId}
                        </Text>
                        {item.waktu?.toDate ? (
                          <Text style={styles.historyTime}>
                            {item.waktu.toDate().toLocaleString('id-ID')}
                          </Text>
                        ) : null}
                      </View>
                    ))
                  )}
                </Card>
              </View>
            ) : tab === 'single' ? (
              <Card style={styles.card}>
                <Text style={styles.sectionTitle}>Masukkan Satu Praktikan</Text>
                <Text style={styles.helper}>
                  Cocokkan praktikan lewat NIM atau email akun yang sudah terdaftar.
                </Text>

                <Text style={styles.label}>NIM Praktikan</Text>
                <TextInput
                  style={styles.input}
                  value={singleNim}
                  onChangeText={setSingleNim}
                  placeholder="cth. 24060122120001"
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="none"
                  editable={!busy}
                />

                <Text style={styles.label}>atau Email Praktikan</Text>
                <TextInput
                  style={styles.input}
                  value={singleEmail}
                  onChangeText={setSingleEmail}
                  placeholder="cth. praktikan@students.undip.ac.id"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  editable={!busy}
                />

                {singleMatch ? (
                  singleMatch.error ? (
                    <Text style={styles.errorText}>{singleMatch.error}</Text>
                  ) : singleMatch.akun ? (
                    <View style={styles.previewBox}>
                      <Text style={styles.previewTitle}>Akun cocok: {singleMatch.akun.name}</Text>
                      <Text style={styles.helper}>
                        NIM {singleMatch.akun.nimOrCode} · {singleMatch.akun.email}
                      </Text>
                    </View>
                  ) : null
                ) : null}

                <Button
                  label={busy ? 'Menambahkan…' : 'Tambahkan ke Lab'}
                  icon="person-add-outline"
                  disabled={busy || !singleMatch?.akun || !!singleMatch.error}
                  onPress={handleSimpanSingle}
                />
              </Card>
            ) : (
              <View style={styles.section}>
                <Card style={styles.card}>
                  <Text style={styles.sectionTitle}>Impor Massal Praktikan (CSV)</Text>
                  <Text style={styles.helper}>
                    Template khusus praktikan: kolom nim, email, nama. Akun yang belum terdaftar
                    dan duplikat ditandai otomatis.
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
                    description="Unduh template praktikan CSV lalu unggah untuk ditinjau sebelum disimpan."
                  />
                ) : (
                  <DaftarTinjauan
                    rows={rows}
                    busy={busy}
                    saveLabel="Masukkan Praktikan Valid"
                    hasilSimpan={hasilSimpan}
                    onToggleStatus={(id) => setRows((prev) => toggleStatusBaris(prev, id))}
                    onEditRow={(row) => setEditingRow(row)}
                    onAcceptAllValid={() => setRows((prev) => terimaSemuaValid(prev))}
                    onRejectAll={() => setRows((prev) => tolakSemua(prev))}
                    onSave={handleSimpanBulk}
                    renderRowContent={(row) => {
                      const info = lengkapiPraktikan(row.data, usersState.data);
                      return (
                        <View style={styles.rowDetail}>
                          <Text style={styles.rowTitle}>
                            {info.matchedNama || row.data.nama || '(Nama kosong)'}
                          </Text>
                          <Text style={styles.rowMeta}>
                            NIM: {info.matchedNim || row.data.nim || '-'} · Email:{' '}
                            {info.matchedEmail || row.data.email || '-'}
                          </Text>
                        </View>
                      );
                    }}
                  />
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>

      <PindahPraktikanSheet
        visible={!!pindahTarget}
        participant={pindahTarget}
        dariLab={activeLab}
        daftarLab={labs.data}
        onClose={() => setPindahTarget(null)}
        onSuccess={(msg) => setPesan(msg)}
      />

      <ConfirmModal
        visible={!!hapusTarget}
        title="Keluarkan praktikan?"
        message={`${hapusTarget?.nama ?? ''} akan dikeluarkan dari ${activeLab?.namaLab ?? 'Lab ini'}.`}
        confirmLabel="Keluarkan"
        tone="danger"
        onConfirm={handleHapus}
        onCancel={() => !busy && setHapusTarget(null)}
      />

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
              {editingRow ? (
                <View style={styles.formGap}>
                  <Text style={styles.label}>NIM</Text>
                  <TextInput
                    style={styles.input}
                    value={editingRow.data.nim}
                    onChangeText={(v) =>
                      setEditingRow((prev) =>
                        prev ? { ...prev, data: { ...prev.data, nim: v } } : prev,
                      )
                    }
                    placeholder="NIM praktikan"
                    placeholderTextColor={colors.textSecondary}
                    autoCapitalize="none"
                  />
                  <Text style={styles.label}>Email</Text>
                  <TextInput
                    style={styles.input}
                    value={editingRow.data.email}
                    onChangeText={(v) =>
                      setEditingRow((prev) =>
                        prev ? { ...prev, data: { ...prev.data, email: v } } : prev,
                      )
                    }
                    placeholder="email@students.undip.ac.id"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                  <Text style={styles.label}>Nama (opsional, otomatis dari akun)</Text>
                  <TextInput
                    style={styles.input}
                    value={editingRow.data.nama}
                    onChangeText={(v) =>
                      setEditingRow((prev) =>
                        prev ? { ...prev, data: { ...prev.data, nama: v } } : prev,
                      )
                    }
                    placeholder="Nama praktikan"
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>
              ) : null}
              <View style={styles.actionRow}>
                <Button
                  label="Batal"
                  variant="outline"
                  onPress={() => setEditingRow(null)}
                  style={styles.flex}
                />
                <Button
                  label="Terapkan"
                  onPress={() => {
                    if (!editingRow) return;
                    const enriched = lengkapiPraktikan(editingRow.data, usersState.data);
                    setRows((prev) =>
                      ubahBaris(prev, editingRow.id, enriched, revalidator),
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl * 2 },
  center: { padding: spacing.xl, alignItems: 'center', gap: spacing.md },
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
  chipsRow: { gap: spacing.sm, paddingVertical: spacing.xs },
  chip: {
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    backgroundColor: colors.background,
  },
  chipActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  chipText: { ...typography.captionBold, color: colors.textPrimary },
  chipTextActive: { color: colors.surface },
  actionRow: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  fileInfo: { ...typography.captionBold, color: colors.navyMuted },
  previewBox: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.successBg,
    borderWidth: 1,
    borderColor: colors.successBorder,
    gap: 2,
  },
  previewTitle: { ...typography.bodyBold, color: colors.successText },
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
  historyItem: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    gap: 2,
  },
  historyTitle: { ...typography.bodyBold, color: colors.textPrimary },
  historyTime: { ...typography.caption, color: colors.navyMuted },
  formGap: { gap: spacing.xs, marginBottom: spacing.md },
  overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    padding: spacing.lg,
    maxHeight: '90%',
  },
  sheetTitle: { ...typography.title, color: colors.textPrimary, marginBottom: spacing.sm },
});
