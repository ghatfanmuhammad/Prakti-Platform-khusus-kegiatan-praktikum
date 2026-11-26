import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '../../components/AppHeader';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { LoadingState } from '../../components/LoadingState';
import { usePembayaran } from '../../features/pembayaran/hooks';
import { formatRupiah } from '../../features/pembayaran/kontrak';
import { PembayaranStatusBadge } from '../../features/pembayaran/StatusPembayaranBadge';
import type { AppStackParamList } from '../../navigation/types';
import { colors, spacing, typography } from '../../theme';
import { formatTanggal } from '../../utils/date';

type Props = NativeStackScreenProps<AppStackParamList, 'RiwayatPembayaran'>;

const METODE: Record<string, string> = {
  bank_transfer: 'Transfer bank (VA)',
  echannel: 'Mandiri Bill',
  qris: 'QRIS',
  gopay: 'GoPay',
  shopeepay: 'ShopeePay',
  credit_card: 'Kartu kredit',
  cstore: 'Minimarket',
};

function formatWaktu(ts: unknown): string {
  const t = ts as { toDate?: () => Date } | null | undefined;
  if (!t?.toDate) return '-';
  return t.toDate().toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function Baris({ label, nilai }: { label: string; nilai: string }) {
  return (
    <View style={styles.baris}>
      <Text style={styles.barisLabel}>{label}</Text>
      <Text style={styles.barisNilai}>{nilai}</Text>
    </View>
  );
}

/** [SRS-029] Riwayat transaksi pembayaran denda, dibaca dari Firestore (tetap ada setelah aplikasi dibuka ulang). */
export function RiwayatPembayaranScreen({ navigation }: Props) {
  const { daftar, loading, error, tersedia, ulangi } = usePembayaran();

  return (
    <View style={styles.root}>
      <AppHeader subtitle="Riwayat Pembayaran" onBack={() => navigation.goBack()} />
      {!tersedia ? (
        <EmptyState
          icon="receipt-outline"
          title="Riwayat butuh akun"
          description="Masuk dengan akun praktikan untuk melihat riwayat pembayaran."
        />
      ) : loading ? (
        <LoadingState label="Memuat riwayat pembayaran..." />
      ) : error ? (
        <ErrorState message={error} onRetry={ulangi} />
      ) : (
        <FlatList
          data={daftar}
          keyExtractor={(item) => item.orderId}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <EmptyState
              icon="receipt-outline"
              title="Belum ada pembayaran"
              description="Transaksi pembayaran denda yang kamu buat akan tercatat di sini."
            />
          }
          renderItem={({ item }) => (
            <Card style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.sesi}>{item.sesiNama}</Text>
                <PembayaranStatusBadge status={item.status} />
              </View>
              <Text style={styles.nominal}>{formatRupiah(item.nominal)}</Text>
              <View style={styles.detail}>
                <Baris label="Tanggal tagihan" nilai={formatTanggal(item.tanggalTagihan)} />
                <Baris label="Waktu transaksi" nilai={formatWaktu(item.createdAt)} />
                {item.status === 'success' ? <Baris label="Dibayar" nilai={formatWaktu(item.dibayarPada)} /> : null}
                {item.metode ? <Baris label="Metode" nilai={METODE[item.metode] ?? item.metode} /> : null}
                <Baris label="No. order" nilai={item.orderId} />
              </View>
            </Card>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.lg, paddingBottom: spacing.xl * 2, gap: spacing.md },
  card: { padding: spacing.md },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  sesi: { ...typography.title, color: colors.textPrimary, flex: 1 },
  nominal: { ...typography.subtitle, color: colors.textPrimary, marginTop: spacing.xs },
  detail: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.xs,
  },
  baris: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  barisLabel: { ...typography.caption, color: colors.textSecondary },
  barisNilai: { ...typography.captionBold, color: colors.textPrimary, flexShrink: 1, textAlign: 'right' },
});
