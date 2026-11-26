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
import { BottomSheet } from '../../components/BottomSheet';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ConfirmModal } from '../../components/ConfirmModal';
import { EmptyState } from '../../components/EmptyState';
import { SegmentedControl } from '../../components/SegmentedControl';
import { useCurrentAslab, usePrakti } from '../../context/PraktiContext';
import { errorMessage } from '../../features/data-praktikum/errors';
import type { Pengampu, RiwayatPindah } from '../../features/data-praktikum/models';
import {
  hapusAsprak,
  pindahAsprak,
  subscribePengampuKelas,
  tambahAsprak,
} from '../../features/data-praktikum/pengampu';
import {
  ambilDaftarAkunPengguna,
  subscribeRiwayatPindah,
} from '../../features/data-praktikum/repository';
import { DaftarTinjauan } from '../../features/impor/DaftarTinjauan';
import { parseCsv } from '../../features/impor/csv';
import {
  buatRevalidatorAsprak,
  cariAkunAsprak,
  lengkapiAsprak,
  petakanCsvAsprak,
  type AkunPenggunaRingkas,
  type BarisAsprakImpor,
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
  TEMPLATE_ASPRAK,
  unduhTemplateCsv,
} from '../../features/impor/template';
import { useLabPraktikum } from '../../features/laboratorium/hooks';
import { colors, radius, spacing, typography } from '../../theme';

type TabMode = 'daftar' | 'single' | 'bulk';

const TAB_OPTIONS: { key: TabMode; label: string }[] = [
  { key: 'daftar', label: 'Pengampu & Pindah' },
  { key: 'single', label: 'Tugaskan Satu' },
  { key: 'bulk', label: 'Bulk CSV' },
];

/**
 * Penugasan, impor (single & bulk), dan pemindahan Asprak antar-Lab oleh Aslab (SRS-023).
 */
export function ImporAsprakScreen({
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

  const [usersState, setUsersState] = useState<{
    attempt: number;
    data: AkunPenggunaRingkas[];
    loading: boolean;
    error: string | null;
  }>({ attempt: 0, data: [], loading: true, error: null });

  const [pengampuList, setPengampuList] = useState<Pengampu[]>([]);
  const [pengampuError, setPengampuError] = useState<string | null>(null);
  const [riwayat, setRiwayat] = useState<RiwayatPindah[]>([]);

  // Single assign state
  const [singleEmail, setSingleEmail] = useState('');
  const [singleKode, setSingleKode] = useState('');

  // Bulk CSV state
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<BarisTinjauan<BarisAsprakImpor>[]>([]);
  const [editingRow, setEditingRow] = useState<BarisTinjauan<BarisAsprakImpor> | null>(null);
  const [hasilSimpan, setHasilSimpan] = useState<HasilSimpanMassal | null>(null);

  // Move & remove state
  const [pindahTarget, setPindahTarget] = useState<Pengampu | null>(null);
  const [keClassId, setKeClassId] = useState<string | null>(null);
  const [pindahError, setPindahError] = useState<string | null>(null);
  const [hapusTarget, setHapusTarget] = useState<Pengampu | null>(null);

  const [busy, setBusy] = useState(false);
  const [pesan, setPesan] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const activeLab =
    labs.data.find((l) => l.id === chosenClassId) ?? labs.data[0] ?? null;
  const activeClassId = activeLab?.id ?? null;

  useEffect(() => {
    if (!aslab || isDemo) return;
    let active = true;
    ambilDaftarAkunPengguna()
      .then((data) => {
        if (active) setUsersState((prev) => ({ ...prev, data, loading: false, error: null }));
      })
      .catch((err) => {
        if (active) {
          setUsersState((prev) => ({ ...prev, loading: false, error: errorMessage(err) }));
        }
      });
    return () => {
      active = false;
    };
  }, [aslab, isDemo, usersState.attempt]);

  useEffect(() => {
    if (!activeClassId || isDemo) return;
    return subscribePengampuKelas(
      activeClassId,
      (items) => {
        setPengampuList(items);
        setPengampuError(null);
      },
      (err) => setPengampuError(errorMessage(err)),
    );
  }, [activeClassId, isDemo]);

  useEffect(() => {
    if (!aslab || isDemo) return;
    return subscribeRiwayatPindah(
      aslab.id,
      'asprak',
      (items) => setRiwayat(items),
      () => {},
    );
  }, [aslab, isDemo]);

  const existingUids = useMemo(
    () => new Set(pengampuList.map((p) => p.uid)),
    [pengampuList],
  );

  const revalidator = useMemo(
    () => buatRevalidatorAsprak(usersState.data, existingUids),
    [usersState.data, existingUids],
  );

  const singleMatch = useMemo(() => {
    if (!singleEmail.trim() && !singleKode.trim()) return null;
    const match = cariAkunAsprak(singleEmail, singleKode, usersState.data);
    if (match.akun && existingUids.has(match.akun.uid)) {
      return { akun: match.akun, error: 'Asprak sudah ditugaskan di Lab ini.' };
    }
    return match;
  }, [singleEmail, singleKode, usersState.data, existingUids]);

  const kandidatTujuan = useMemo(
    () => labs.data.filter((l) => l.id !== activeClassId),
    [labs.data, activeClassId],
  );
  const selectedTujuan =
    kandidatTujuan.find((l) => l.id === keClassId) ?? kandidatTujuan[0] ?? null;

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
      await unduhTemplateCsv(TEMPLATE_ASPRAK);
      setPesan(`Template ${TEMPLATE_ASPRAK.filename} siap dibagikan/disimpan.`);
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
      const mapped = petakanCsvAsprak(parsed.rows).map((item) => ({
        ...item,
        data: lengkapiAsprak(item.data, usersState.data),
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
      setErrorMsg(singleMatch?.error ?? 'Masukkan email atau kode Asprak yang terdaftar.');
      return;
    }

    setBusy(true);
    setErrorMsg(null);
    setPesan(null);
    try {
      const { akun } = singleMatch;
      await tambahAsprak(activeLab.id, {
        uid: akun.uid,
        nama: akun.name,
        kode: akun.nimOrCode,
        email: akun.email,
      });
      setSingleEmail('');
      setSingleKode('');
      setPesan(`${akun.name} (${akun.nimOrCode}) berhasil ditugaskan ke ${activeLab.namaLab}.`);
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
      const matched = cariAkunAsprak(row.data.email, row.data.kodeAsprak, usersState.data);
      if (!matched.akun) {
        galatBaris.push({
          nomorBaris: row.nomorBaris,
          pesan: matched.error ?? 'Akun Asprak tidak ditemukan.',
        });
        continue;
      }
      try {
        await tambahAsprak(activeLab.id, {
          uid: matched.akun.uid,
          nama: row.data.nama.trim() || matched.akun.name,
          kode: matched.akun.nimOrCode,
          email: matched.akun.email,
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
      setPesan(`${berhasil} Asprak berhasil ditugaskan ke ${activeLab.namaLab}.`);
    }
    setBusy(false);
  }

  async function handleKonfirmasiPindah() {
    if (!pindahTarget || !activeLab || !selectedTujuan) return;
    setBusy(true);
    setPindahError(null);
    setErrorMsg(null);
    setPesan(null);
    try {
      await pindahAsprak({
        uid: pindahTarget.uid,
        dariClassId: activeLab.id,
        keClassId: selectedTujuan.id,
      });
      setPesan(
        `${pindahTarget.nama} dipindahkan ke ${selectedTujuan.namaLab}. Akses ke Lab lama langsung dicabut.`,
      );
      setPindahTarget(null);
      setKeClassId(null);
    } catch (err) {
      setPindahError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleHapus() {
    if (!hapusTarget || !activeLab) return;
    setBusy(true);
    setErrorMsg(null);
    setPesan(null);
    try {
      await hapusAsprak(activeLab.id, hapusTarget.uid);
      setPesan(`Penugasan ${hapusTarget.nama} di ${activeLab.namaLab} telah dilepas.`);
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
      <AppHeader subtitle="Asprak Pengampu Lab" onBack={() => navigation.goBack()} />

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
            description="Buat Lab di menu Kelola Lab sebelum menugaskan Asprak."
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
                  {activeLab.namaPraktikum} · {pengampuList.length} Asprak pengampu
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

            {errorMsg || pengampuError ? (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
                <Text style={styles.errorText}>{errorMsg ?? pengampuError}</Text>
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
                {pengampuList.length === 0 ? (
                  <EmptyState
                    icon="school-outline"
                    title="Belum ada Asprak di Lab ini"
                    description="Tugaskan akun berperan Asprak lewat tab Tugaskan Satu atau Bulk CSV."
                  />
                ) : (
                  pengampuList.map((item) => (
                    <Card key={item.id} style={styles.card}>
                      <Text style={styles.rowTitle}>{item.nama}</Text>
                      <Text style={styles.rowMeta}>
                        Kode: {item.kode}
                        {item.email ? ` · ${item.email}` : ''}
                      </Text>
                      <View style={styles.actionRow}>
                        <Button
                          label="Pindah Lab"
                          variant="outline"
                          icon="swap-horizontal-outline"
                          disabled={busy || labs.data.length < 2}
                          onPress={() => {
                            setPindahError(null);
                            setKeClassId(null);
                            setPindahTarget(item);
                          }}
                          style={styles.flex}
                        />
                        <Button
                          label="Lepas"
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
                  <Text style={styles.sectionTitle}>Riwayat Pemindahan Asprak</Text>
                  {riwayat.length === 0 ? (
                    <Text style={styles.helper}>Belum ada riwayat pemindahan Asprak.</Text>
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
                <Text style={styles.sectionTitle}>Tugaskan Satu Asprak</Text>
                <Text style={styles.helper}>
                  Hanya akun terdaftar dengan peran Asprak yang dapat ditugaskan.
                </Text>

                <Text style={styles.label}>Email Asprak</Text>
                <TextInput
                  style={styles.input}
                  value={singleEmail}
                  onChangeText={setSingleEmail}
                  placeholder="cth. asprak@staff.undip.ac.id"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  editable={!busy}
                />

                <Text style={styles.label}>atau Kode Asprak</Text>
                <TextInput
                  style={styles.input}
                  value={singleKode}
                  onChangeText={setSingleKode}
                  placeholder="cth. ASP-01"
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="characters"
                  editable={!busy}
                />

                {singleMatch ? (
                  singleMatch.error ? (
                    <Text style={styles.errorText}>{singleMatch.error}</Text>
                  ) : singleMatch.akun ? (
                    <View style={styles.previewBox}>
                      <Text style={styles.previewTitle}>Akun Asprak cocok: {singleMatch.akun.name}</Text>
                      <Text style={styles.helper}>
                        Kode {singleMatch.akun.nimOrCode} · {singleMatch.akun.email}
                      </Text>
                    </View>
                  ) : null
                ) : null}

                <Button
                  label={busy ? 'Menugaskan…' : 'Tugaskan ke Lab'}
                  icon="person-add-outline"
                  disabled={busy || !singleMatch?.akun || !!singleMatch.error}
                  onPress={handleSimpanSingle}
                />
              </Card>
            ) : (
              <View style={styles.section}>
                <Card style={styles.card}>
                  <Text style={styles.sectionTitle}>Impor Massal Asprak (CSV)</Text>
                  <Text style={styles.helper}>
                    Template khusus Asprak: kolom email, kode_asprak, nama. Akun selain peran Asprak
                    akan ditandai error.
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
                    description="Unduh template Asprak CSV lalu unggah untuk ditinjau sebelum ditugaskan."
                  />
                ) : (
                  <DaftarTinjauan
                    rows={rows}
                    busy={busy}
                    saveLabel="Tugaskan Asprak Valid"
                    hasilSimpan={hasilSimpan}
                    onToggleStatus={(id) => setRows((prev) => toggleStatusBaris(prev, id))}
                    onEditRow={(row) => setEditingRow(row)}
                    onAcceptAllValid={() => setRows((prev) => terimaSemuaValid(prev))}
                    onRejectAll={() => setRows((prev) => tolakSemua(prev))}
                    onSave={handleSimpanBulk}
                    renderRowContent={(row) => {
                      const info = lengkapiAsprak(row.data, usersState.data);
                      return (
                        <View style={styles.rowDetail}>
                          <Text style={styles.rowTitle}>
                            {info.matchedNama || row.data.nama || '(Nama kosong)'}
                          </Text>
                          <Text style={styles.rowMeta}>
                            Kode: {info.matchedKode || row.data.kodeAsprak || '-'} · Email:{' '}
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

      <BottomSheet
        visible={!!pindahTarget}
        title="Pindah Asprak antar-Lab"
        onClose={() => {
          if (!busy) {
            setPindahError(null);
            setPindahTarget(null);
          }
        }}
      >
        {pindahTarget && activeLab ? (
          <View style={styles.sheetContent}>
            <View style={styles.infoBox}>
              <Text style={styles.rowTitle}>{pindahTarget.nama}</Text>
              <Text style={styles.rowMeta}>Kode: {pindahTarget.kode}</Text>
              <Text style={styles.rowMeta}>
                Lab asal: {activeLab.namaLab} · {activeLab.namaPraktikum}
              </Text>
            </View>

            <Text style={styles.label}>Pilih Lab tujuan</Text>
            <ScrollView style={styles.modalList} nestedScrollEnabled>
              {kandidatTujuan.map((lab) => {
                const selected = selectedTujuan?.id === lab.id;
                return (
                  <Pressable
                    key={lab.id}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    disabled={busy}
                    onPress={() => setKeClassId(lab.id)}
                    style={[styles.option, selected && styles.optionSelected]}
                  >
                    <Text style={[styles.optionTitle, selected && styles.optionTitleSelected]}>
                      {lab.namaLab} ({lab.kode})
                    </Text>
                    <Text style={[styles.optionMeta, selected && styles.optionMetaSelected]}>
                      {lab.namaPraktikum}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Text style={styles.helper}>
              Asprak yang masih memiliki sesi berstatus dibuka di Lab asal tidak dapat dipindah.
              Setelah pindah, akses ke Lab lama langsung hilang.
            </Text>

            {pindahError ? <Text style={styles.errorText}>{pindahError}</Text> : null}
            {busy ? <ActivityIndicator color={colors.navy} /> : null}

            <View style={styles.actionRow}>
              <Button
                label="Batal"
                variant="outline"
                disabled={busy}
                onPress={() => {
                  setPindahError(null);
                  setPindahTarget(null);
                }}
                style={styles.flex}
              />
              <Button
                label={busy ? 'Memindahkan…' : 'Pindahkan'}
                disabled={busy || !selectedTujuan}
                onPress={handleKonfirmasiPindah}
                style={styles.flex}
              />
            </View>
          </View>
        ) : null}
      </BottomSheet>

      <ConfirmModal
        visible={!!hapusTarget}
        title="Lepas Asprak?"
        message={`${hapusTarget?.nama ?? ''} akan dilepas dari ${activeLab?.namaLab ?? 'Lab ini'}.`}
        confirmLabel="Lepas"
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
                  <Text style={styles.label}>Email Asprak</Text>
                  <TextInput
                    style={styles.input}
                    value={editingRow.data.email}
                    onChangeText={(v) =>
                      setEditingRow((prev) =>
                        prev ? { ...prev, data: { ...prev.data, email: v } } : prev,
                      )
                    }
                    placeholder="asprak@staff.undip.ac.id"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                  <Text style={styles.label}>Kode Asprak</Text>
                  <TextInput
                    style={styles.input}
                    value={editingRow.data.kodeAsprak}
                    onChangeText={(v) =>
                      setEditingRow((prev) =>
                        prev ? { ...prev, data: { ...prev.data, kodeAsprak: v } } : prev,
                      )
                    }
                    placeholder="ASP-01"
                    placeholderTextColor={colors.textSecondary}
                    autoCapitalize="characters"
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
                    placeholder="Nama Asprak"
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
                    const enriched = lengkapiAsprak(editingRow.data, usersState.data);
                    setRows((prev) => ubahBaris(prev, editingRow.id, enriched, revalidator));
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
  sheetContent: { gap: spacing.md },
  infoBox: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 2,
  },
  modalList: { maxHeight: 200 },
  option: {
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
    gap: 2,
  },
  optionSelected: { backgroundColor: colors.navy, borderColor: colors.navy },
  optionTitle: { ...typography.bodyBold, color: colors.textPrimary },
  optionTitleSelected: { color: colors.surface },
  optionMeta: { ...typography.caption, color: colors.textSecondary },
  optionMetaSelected: { color: colors.textOnNavyMuted },
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
