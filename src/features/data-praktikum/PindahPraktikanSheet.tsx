import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { BottomSheet } from '../../components/BottomSheet';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { colors, radius, spacing, typography } from '../../theme';
import type { LabPraktikum } from '../laboratorium/models';
import { errorMessage } from './errors';
import type { Participant } from './models';
import { pindahPraktikan } from './repository';

interface Props {
  visible: boolean;
  participant: Participant | null;
  dariLab: LabPraktikum | null;
  daftarLab: LabPraktikum[];
  onClose: () => void;
  onSuccess: (pesan: string) => void;
}

/**
 * Lembar pemindahan praktikan antar-Lab dalam satu transaksi (SRS-022).
 * Jadwal dan riwayat presensi di Lab asal tetap dipertahankan.
 */
export function PindahPraktikanSheet({
  visible,
  participant,
  dariLab,
  daftarLab,
  onClose,
  onSuccess,
}: Props) {
  const [keClassId, setKeClassId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const kandidatTujuan = daftarLab.filter((lab) => lab.id !== dariLab?.id);
  const selectedTujuan =
    kandidatTujuan.find((lab) => lab.id === keClassId) ?? kandidatTujuan[0] ?? null;

  async function konfirmasiPindah() {
    if (!participant || !dariLab || !selectedTujuan) return;
    setBusy(true);
    setError(null);
    try {
      await pindahPraktikan({
        uid: participant.uid,
        dariClassId: dariLab.id,
        keClassId: selectedTujuan.id,
      });
      setKeClassId(null);
      onSuccess(
        `${participant.nama} dipindahkan ke ${selectedTujuan.namaLab} (${selectedTujuan.namaPraktikum}).`,
      );
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet
      visible={visible}
      title="Pindah Praktikan antar-Lab"
      onClose={() => {
        if (!busy) {
          setError(null);
          onClose();
        }
      }}
    >
      {participant && dariLab ? (
        <View style={styles.content}>
          <View style={styles.infoBox}>
            <Text style={styles.name}>{participant.nama}</Text>
            <Text style={styles.meta}>NIM {participant.nim}</Text>
            <Text style={styles.meta}>
              Lab asal: {dariLab.namaLab} · {dariLab.namaPraktikum}
            </Text>
          </View>

          <Text style={styles.label}>Pilih Lab tujuan</Text>
          {kandidatTujuan.length === 0 ? (
            <EmptyState
              icon="business-outline"
              title="Belum ada Lab tujuan lain"
              description="Tambahkan Lab lain terlebih dahulu di menu Kelola Lab."
            />
          ) : (
            <ScrollView style={styles.list} nestedScrollEnabled>
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
                      {lab.namaPraktikum} · {lab.participantCount} peserta
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          <Text style={styles.note}>
            Pemindahan tercatat di riwayat. Jadwal di Lab asal tidak ikut dipindah dan riwayat
            presensi sebelumnya tetap aman.
          </Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {busy ? <ActivityIndicator color={colors.navy} /> : null}

          <View style={styles.actions}>
            <Button
              label="Batal"
              variant="outline"
              disabled={busy}
              onPress={() => {
                setError(null);
                onClose();
              }}
              style={styles.flex}
            />
            <Button
              label={busy ? 'Memindahkan…' : 'Pindahkan'}
              disabled={busy || !selectedTujuan}
              onPress={konfirmasiPindah}
              style={styles.flex}
            />
          </View>
        </View>
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md },
  infoBox: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 2,
  },
  name: { ...typography.subtitle, color: colors.textPrimary },
  meta: { ...typography.body, color: colors.textSecondary },
  label: { ...typography.captionBold, color: colors.textSecondary },
  list: { maxHeight: 220 },
  option: {
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
    gap: 2,
  },
  optionSelected: {
    backgroundColor: colors.navy,
    borderColor: colors.navy,
  },
  optionTitle: { ...typography.bodyBold, color: colors.textPrimary },
  optionTitleSelected: { color: colors.surface },
  optionMeta: { ...typography.caption, color: colors.textSecondary },
  optionMetaSelected: { color: colors.textOnNavyMuted },
  note: { ...typography.caption, color: colors.textSecondary },
  error: { ...typography.body, color: colors.danger },
  actions: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
});
