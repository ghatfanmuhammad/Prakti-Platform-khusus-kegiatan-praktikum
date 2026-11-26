import type { StatusIzin } from '../services/izinService';
import type { StatusTone } from '../theme';
import { StatusBadge } from './StatusBadge';

const TONE: Record<StatusIzin, StatusTone> = {
  Menunggu: 'warning',
  Disetujui: 'success',
  Ditolak: 'danger',
};

/** Badge status pengajuan izin (SRS-010/011), memakai StatusBadge generik (SRS-030). */
export function IzinStatusBadge({ status }: { status: StatusIzin }) {
  return <StatusBadge label={status} tone={TONE[status] ?? 'warning'} accessibilityLabel={`Status izin: ${status}`} />;
}
