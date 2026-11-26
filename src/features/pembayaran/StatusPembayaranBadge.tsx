import { StatusBadge } from '../../components/StatusBadge';
import type { StatusTone } from '../../theme';
import { LABEL_DENDA, LABEL_PEMBAYARAN, type StatusDenda, type StatusPembayaran } from './kontrak';

const TONE_DENDA: Record<StatusDenda, StatusTone> = {
  belum_dibayar: 'info',
  pending: 'warning',
  lunas: 'success',
  gagal: 'danger',
  dibebaskan: 'neutral',
};

const TONE_PEMBAYARAN: Record<StatusPembayaran, StatusTone> = {
  pending: 'warning',
  success: 'success',
  failed: 'danger',
};

export function DendaStatusBadge({ status }: { status: StatusDenda }) {
  const label = LABEL_DENDA[status] ?? status;
  return <StatusBadge label={label} tone={TONE_DENDA[status] ?? 'neutral'} accessibilityLabel={`Status tagihan: ${label}`} />;
}

export function PembayaranStatusBadge({ status }: { status: StatusPembayaran }) {
  const label = LABEL_PEMBAYARAN[status] ?? status;
  return <StatusBadge label={label} tone={TONE_PEMBAYARAN[status] ?? 'neutral'} accessibilityLabel={`Status pembayaran: ${label}`} />;
}
