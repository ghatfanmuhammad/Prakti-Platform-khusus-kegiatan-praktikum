import type { StatusTone } from '../theme';
import type { SessionStatus } from '../types';
import { StatusBadge } from './StatusBadge';

const CONFIG: Record<SessionStatus, { label: string; tone: StatusTone }> = {
  belum_dibuka: { label: 'Belum dibuka', tone: 'neutral' },
  dibuka: { label: 'Dibuka', tone: 'success' },
  ditutup: { label: 'Ditutup', tone: 'danger' },
};

/** Status sesi: selalu berupa warna dan teks, tidak hanya warna. */
export function StatusPill({ status }: { status: SessionStatus }) {
  const config = CONFIG[status];
  return <StatusBadge label={config.label} tone={config.tone} dot accessibilityLabel={`Status sesi: ${config.label}`} />;
}
