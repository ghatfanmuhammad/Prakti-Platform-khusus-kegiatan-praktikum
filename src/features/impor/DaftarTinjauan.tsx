import { Ionicons } from '@expo/vector-icons';
import { type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { colors, radius, spacing, typography } from '../../theme';
import {
  ringkasTinjauan,
  type BarisTinjauan,
  type HasilSimpanMassal,
} from './review';

interface Props<T> {
  rows: BarisTinjauan<T>[];
  busy?: boolean;
  saveLabel?: string;
  hasilSimpan?: HasilSimpanMassal | null;
  renderRowContent: (row: BarisTinjauan<T>) => ReactNode;
  onToggleStatus: (id: string) => void;
  onEditRow: (row: BarisTinjauan<T>) => void;
  onAcceptAllValid: () => void;
  onRejectAll: () => void;
  onSave: () => void;
}

/**
 * Komponen daftar tinjauan impor CSV yang bisa di-scroll (SRS-021, 022, 023).
 * Menampilkan status, kesalahan per baris, dan aksi terima / tolak / ubah.
 */
export function DaftarTinjauan<T>({
  rows,
  busy = false,
  saveLabel = 'Simpan Baris Diterima',
  hasilSimpan = null,
  renderRowContent,
  onToggleStatus,
  onEditRow,
  onAcceptAllValid,
  onRejectAll,
  onSave,
}: Props<T>) {
  const ringkasan = ringkasTinjauan(rows);

  return (
    <View style={styles.wrapper}>
      <Card style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Ringkasan Tinjauan ({ringkasan.total} baris)</Text>
        <View style={styles.badgeGrid}>
          <View style={[styles.statPill, { backgroundColor: colors.successBg, borderColor: colors.successBorder }]}>
            <Text style={[styles.statText, { color: colors.successText }]}>
              Valid: {ringkasan.valid}
            </Text>
          </View>
          <View style={[styles.statPill, { backgroundColor: colors.dangerBg, borderColor: colors.dangerBorder }]}>
            <Text style={[styles.statText, { color: colors.danger }]}>
              Bermasalah: {ringkasan.bermasalah}
            </Text>
          </View>
          <View style={[styles.statPill, { backgroundColor: colors.neutralBg, borderColor: colors.divider }]}>
            <Text style={[styles.statText, { color: colors.navy }]}>
              Siap simpan: {ringkasan.siapSimpan}
            </Text>
          </View>
          <View style={[styles.statPill, { backgroundColor: colors.neutralBg, borderColor: colors.divider }]}>
            <Text style={[styles.statText, { color: colors.neutralText }]}>
              Ditolak: {ringkasan.ditolak}
            </Text>
          </View>
        </View>
        <View style={styles.bulkActions}>
          <Pressable
            accessibilityRole="button"
            disabled={busy || ringkasan.valid === 0}
            onPress={onAcceptAllValid}
            style={[styles.quickBtn, (busy || ringkasan.valid === 0) && styles.disabled]}
          >
            <Text style={styles.quickBtnText}>Terima semua valid</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={busy || ringkasan.total === 0}
            onPress={onRejectAll}
            style={[styles.quickBtn, (busy || ringkasan.total === 0) && styles.disabled]}
          >
            <Text style={styles.quickBtnText}>Tolak semua</Text>
          </Pressable>
        </View>
      </Card>

      {hasilSimpan ? (
        <Card style={styles.resultCard}>
          <Text style={styles.resultTitle}>Ringkasan Penyimpanan</Text>
          <Text style={styles.resultLine}>Berhasil disimpan: {hasilSimpan.berhasil}</Text>
          <Text style={styles.resultLine}>Dilewati (ditolak / belum valid): {hasilSimpan.dilewati}</Text>
          <Text style={[styles.resultLine, hasilSimpan.gagal > 0 && { color: colors.danger }]}>
            Gagal saat menyimpan: {hasilSimpan.gagal}
          </Text>
          {hasilSimpan.galatBaris.map((err, idx) => (
            <Text key={`${err.nomorBaris}-${idx}`} style={styles.errorText}>
              • Baris #{err.nomorBaris}: {err.pesan}
            </Text>
          ))}
        </Card>
      ) : null}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.list}
        nestedScrollEnabled
      >
        {rows.map((row) => {
          const hasError = row.errors.length > 0;
          const accepted = row.status === 'diterima' && !hasError;
          return (
            <Card
              key={row.id}
              style={[
                styles.rowCard,
                hasError && styles.rowCardError,
                row.status === 'ditolak' && !hasError && styles.rowCardRejected,
              ]}
            >
              <View style={styles.rowHeader}>
                <Text style={styles.rowNumber}>Baris #{row.nomorBaris}</Text>
                <View
                  style={[
                    styles.statusBadge,
                    accepted
                      ? styles.statusAccepted
                      : hasError
                        ? styles.statusError
                        : styles.statusRejected,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      {
                        color: accepted
                          ? colors.successText
                          : hasError
                            ? colors.danger
                            : colors.neutralText,
                      },
                    ]}
                  >
                    {accepted ? 'Diterima' : hasError ? 'Perlu perbaikan' : 'Ditolak'}
                  </Text>
                </View>
              </View>

              <View style={styles.rowBody}>{renderRowContent(row)}</View>

              {hasError ? (
                <View style={styles.errorBox}>
                  {row.errors.map((err, idx) => (
                    <Text key={idx} style={styles.errorText}>
                      • {err}
                    </Text>
                  ))}
                </View>
              ) : null}

              <View style={styles.rowActions}>
                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={() => onToggleStatus(row.id)}
                  style={[styles.actionBtn, styles.actionOutline, busy && styles.disabled]}
                >
                  <Ionicons
                    name={row.status === 'diterima' ? 'close-circle-outline' : 'checkmark-circle-outline'}
                    size={16}
                    color={colors.navy}
                  />
                  <Text style={styles.actionOutlineText}>
                    {row.status === 'diterima' ? 'Tolak' : 'Terima'}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={() => onEditRow(row)}
                  style={[styles.actionBtn, styles.actionPrimary, busy && styles.disabled]}
                >
                  <Ionicons name="create-outline" size={16} color={colors.surface} />
                  <Text style={styles.actionPrimaryText}>
                    {hasError ? 'Lengkapi' : 'Ubah'}
                  </Text>
                </Pressable>
              </View>
            </Card>
          );
        })}
      </ScrollView>

      <Button
        label={busy ? 'Menyimpan…' : `${saveLabel} (${ringkasan.siapSimpan})`}
        icon="cloud-upload-outline"
        disabled={busy || ringkasan.siapSimpan === 0}
        onPress={onSave}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.md },
  summaryCard: { gap: spacing.sm },
  summaryTitle: { ...typography.subtitle, color: colors.textPrimary },
  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  statPill: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statText: { ...typography.captionBold },
  bulkActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  quickBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.background,
    minHeight: 36,
    justifyContent: 'center',
  },
  quickBtnText: { ...typography.captionBold, color: colors.navy },
  resultCard: { gap: 4, borderColor: colors.navy, backgroundColor: colors.background },
  resultTitle: { ...typography.subtitle, color: colors.textPrimary, marginBottom: 4 },
  resultLine: { ...typography.body, color: colors.textPrimary },
  scroll: { maxHeight: 420 },
  list: { gap: spacing.sm, paddingBottom: spacing.sm },
  rowCard: { gap: spacing.sm },
  rowCardError: { borderColor: colors.dangerBorder },
  rowCardRejected: { opacity: 0.78 },
  rowHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  rowNumber: { ...typography.captionBold, color: colors.textSecondary },
  statusBadge: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  statusAccepted: { backgroundColor: colors.successBg, borderColor: colors.successBorder },
  statusError: { backgroundColor: colors.dangerBg, borderColor: colors.dangerBorder },
  statusRejected: { backgroundColor: colors.neutralBg, borderColor: colors.divider },
  statusText: { ...typography.captionBold },
  rowBody: { gap: 2 },
  errorBox: {
    backgroundColor: colors.dangerBg,
    borderColor: colors.dangerBorder,
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: spacing.sm,
    gap: 2,
  },
  errorText: { ...typography.caption, color: colors.danger },
  rowActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  actionBtn: {
    flex: 1,
    minHeight: 40,
    borderRadius: radius.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
  },
  actionOutline: {
    borderWidth: 1,
    borderColor: colors.navy,
    backgroundColor: colors.surface,
  },
  actionOutlineText: { ...typography.captionBold, color: colors.navy },
  actionPrimary: {
    backgroundColor: colors.navy,
  },
  actionPrimaryText: { ...typography.captionBold, color: colors.surface },
  disabled: { opacity: 0.5 },
});
