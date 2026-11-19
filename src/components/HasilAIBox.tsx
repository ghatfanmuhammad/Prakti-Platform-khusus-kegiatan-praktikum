import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import type { PengajuanIzin } from '../services/izinService';
import { colors, radius, spacing, typography } from '../theme';

interface Props {
  izin: PengajuanIzin;
  /** Bila diisi, tombol "Klasifikasi Ulang" muncul saat AI gagal/belum ada hasil. */
  onKlasifikasiUlang?: () => void;
  memproses?: boolean;
}

/** "positif" → "Positif" untuk ditampilkan. */
function kapital(teks: string): string {
  return teks.charAt(0).toUpperCase() + teks.slice(1);
}

/**
 * Menampilkan prediksi sentimen alasan izin dari model AI.
 * Selalu diberi label sebagai informasi pendukung, bukan keputusan.
 */
export function HasilAIBox({ izin, onKlasifikasiUlang, memproses = false }: Props) {
  const berhasil = izin.statusAI === 'berhasil' && !!izin.kategoriAI;
  const persen =
    typeof izin.confidenceAI === 'number' ? `${Math.round(izin.confidenceAI * 100)}%` : null;

  return (
    <View style={styles.box}>
      <View style={styles.header}>
        <Ionicons name="sparkles-outline" size={16} color={colors.navy} />
        <Text style={styles.judul}>Prediksi Sentimen (AI)</Text>
      </View>

      {berhasil ? (
        <View style={styles.hasilRow}>
          <View style={styles.chip}>
            <Text style={styles.chipText}>{kapital(izin.kategoriAI!)}</Text>
          </View>
          {persen ? <Text style={styles.confidence}>keyakinan {persen}</Text> : null}
        </View>
      ) : (
        <Text style={styles.gagal}>
          {izin.statusAI === 'gagal'
            ? `Tidak tersedia: ${izin.pesanAI ?? 'klasifikasi AI gagal.'}`
            : 'Belum dianalisis.'}
        </Text>
      )}

      <Text style={styles.disclaimer}>
        Informasi pendukung saja. Keputusan tetap di tangan asisten.
      </Text>

      {!berhasil && onKlasifikasiUlang ? (
        <Pressable
          disabled={memproses}
          style={[styles.ulangBtn, memproses && styles.ulangBtnDisabled]}
          onPress={onKlasifikasiUlang}
        >
          {memproses ? (
            <ActivityIndicator size="small" color={colors.navy} />
          ) : (
            <>
              <Ionicons name="refresh" size={14} color={colors.navy} />
              <Text style={styles.ulangText}>Analisis Ulang</Text>
            </>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginTop: spacing.xs,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.xs },
  judul: { ...typography.caption, color: colors.navy, fontWeight: '700' },
  hasilRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  chip: {
    backgroundColor: colors.tile,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  chipText: { ...typography.captionBold, color: colors.navy },
  confidence: { ...typography.caption, color: colors.textSecondary },
  gagal: { ...typography.caption, color: colors.textSecondary },
  disclaimer: {
    ...typography.caption,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginTop: spacing.xs,
    fontSize: 11,
  },
  ulangBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.navy,
    minWidth: 140,
  },
  ulangBtnDisabled: { opacity: 0.6 },
  ulangText: { ...typography.caption, color: colors.navy, fontWeight: '700' },
});
