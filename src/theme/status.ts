import { colors } from './colors';

/**
 * [SRS-030] Nada warna status yang dipakai semua badge.
 * warning = menunggu/pending (kuning), success = lunas/berhasil (hijau),
 * danger = gagal/ditolak (merah), neutral = dibebaskan/nonaktif (abu-abu), info = perlu tindakan (biru).
 */
export type StatusTone = 'warning' | 'success' | 'danger' | 'neutral' | 'info';

export const statusTones: Record<StatusTone, { text: string; background: string; border: string; dot: string }> = {
  warning: { text: colors.warningText, background: colors.warningBg, border: colors.warningBorder, dot: colors.warning },
  success: { text: colors.successText, background: colors.successBg, border: colors.successBorder, dot: colors.success },
  danger: { text: colors.danger, background: colors.dangerBg, border: colors.dangerBorder, dot: colors.danger },
  neutral: { text: colors.neutralText, background: colors.neutralBg, border: colors.divider, dot: colors.neutralDot },
  info: { text: colors.infoText, background: colors.infoBg, border: colors.infoBorder, dot: colors.navy },
};
