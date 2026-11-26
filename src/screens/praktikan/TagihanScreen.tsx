import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '../../components/AppHeader';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { InfoRow } from '../../components/InfoRow';
import { LoadingState } from '../../components/LoadingState';
import { useToast } from '../../components/Toast';
import { useDenda } from '../../features/pembayaran/hooks';
import { formatRupiah, type Denda } from '../../features/pembayaran/kontrak';
import { DendaStatusBadge } from '../../features/pembayaran/StatusPembayaranBadge';
import type { AppStackParamList } from '../../navigation/types';
import { bayarDenda, formatPembayaranError } from '../../services/pembayaranService';
import { colors, radius, spacing, typography } from '../../theme';
import { formatTanggal } from '../../utils/date';

type Props = NativeStackScreenProps<AppStackParamList, 'Tagihan'>;

const LABEL_TOMBOL: Partial<Record<Denda['status'], string>> = {
  belum_dibayar: 'Bayar',
  pending: 'Lanjutkan Pembayaran',
  gagal: 'Bayar Ulang',
};

const KETERANGAN: Partial<Record<Denda['status'], string>> = {
  pending: 'Menunggu konfirmasi Midtrans. Status diperbarui otomatis.',
  gagal: 'Pembayaran sebelumnya gagal atau kedaluwarsa.',
  dibebaskan: 'Kamu dibebaskan dari denda ini.',
};

/** [SRS-027] Daftar tagihan denda praktikan dan pembayaran lewat Midtrans Snap (Sandbox). */
export function TagihanScreen({ navigation }: Props) {
  const { daftar, loading, error, dariCache, tersedia, ulangi } = useDenda();
  const toast = useToast();
  const [diproses, setDiproses] = useState<string | null>(null);

  const terbuka = daftar.filter((d) => d.status === 'belum_dibayar' || d.status === 'gagal' || d.status === 'pending');
  const total = terbuka.reduce((jumlah, d) => jumlah + d.nominal, 0);

  async function bayar(denda: Denda) {
    if (diproses) return;
    setDiproses(denda.id);
    try {
      const hasil = await bayarDenda(denda.id);
      toast.show(
        hasil === 'kembali'
          ? 'Kembali dari Midtrans. Status tagihan diperbarui setelah pembayaran dikonfirmasi.'
          : 'Halaman pembayaran ditutup. Status akan diperbarui bila pembayaran selesai.',
        'info',
      );
    } catch (err) {
      toast.show(formatPembayaranError(err), 'error');
    } finally {
      setDiproses(null);
    }
  }

  const header = (
    <View style={styles.headerContent}>
      {dariCache ? (
        <View style={styles.offline}>
          <Ionicons name="cloud-offline-outline" size={16} color={colors.danger} />
          <Text style={styles.offlineText}>Sedang offline. Status mungkin belum terbaru.</Text>
        </View>
      ) : null}
      <Card>
        <Text style={styles.ringkasLabel}>Total belum dibayar</Text>
        <Text style={styles.ringkasNominal}>{formatRupiah(total)}</Text>
        <Text style={styles.ringkasHint}>
          {terbuka.length === 0 ? 'Tidak ada tagihan yang perlu dibayar.' : `${terbuka.length} tagihan perlu dibayar.`}
        </Text>
      </Card>
      <Button
        label="Riwayat Pembayaran"
        icon="receipt-outline"
        variant="outline"
        onPress={() => navigation.navigate('RiwayatPembayaran')}
      />
    </View>
  );

  return (
    <View style={styles.root}>
      <AppHeader subtitle="Tagihan" onBack={() => navigation.goBack()} />
      {!tersedia ? (
        <EmptyState
          icon="wallet-outline"
          title="Tagihan butuh akun"
          description="Masuk dengan akun praktikan untuk melihat dan membayar tagihan denda."
        />
      ) : loading ? (
        <LoadingState label="Memuat tagihan..." />
      ) : error ? (
        <ErrorState message={error} onRetry={ulangi} />
      ) : (
        <FlatList
          data={daftar}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={header}
          ListEmptyComponent={
            <EmptyState
              icon="checkmark-circle-outline"
              title="Belum ada tagihan"
              description="Denda keterlambatan akan muncul di sini bila kamu presensi melewati batas toleransi."
            />
          }
          renderItem={({ item }) => {
            const tombol = LABEL_TOMBOL[item.status];
            const keterangan = KETERANGAN[item.status];
            return (
              <Card style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.sesi}>{item.sesiNama}</Text>
                  <DendaStatusBadge status={item.status} />
                </View>
                <View style={styles.info}>
                  <InfoRow icon="calendar-outline" text={formatTanggal(item.tanggal)} />
                  <InfoRow icon="time-outline" text={`Terlambat ${item.menitTerlambat} menit`} />
                </View>
                <View style={styles.nominalRow}>
                  <Text style={styles.nominalLabel}>Nominal denda</Text>
                  <Text style={styles.nominal}>{formatRupiah(item.nominal)}</Text>
                </View>
                {keterangan ? <Text style={styles.keterangan}>{keterangan}</Text> : null}
                {tombol ? (
                  <Button
                    label={diproses === item.id ? 'Menyiapkan pembayaran...' : tombol}
                    icon="card-outline"
                    disabled={diproses !== null}
                    onPress={() => void bayar(item)}
                    style={styles.button}
                  />
                ) : null}
              </Card>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.lg, paddingBottom: spacing.xl * 2, gap: spacing.md },
  headerContent: { gap: spacing.md, marginBottom: spacing.xs },
  offline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    backgroundColor: colors.dangerBg,
    borderColor: colors.dangerBorder,
  },
  offlineText: { ...typography.caption, color: colors.danger, flex: 1 },
  ringkasLabel: { ...typography.caption, color: colors.textSecondary },
  ringkasNominal: { ...typography.display, color: colors.textPrimary, marginTop: spacing.xs },
  ringkasHint: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
  card: { padding: spacing.md },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  sesi: { ...typography.title, color: colors.textPrimary, flex: 1 },
  info: { marginTop: spacing.sm, gap: spacing.xs },
  nominalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  nominalLabel: { ...typography.body, color: colors.textSecondary },
  nominal: { ...typography.subtitle, color: colors.textPrimary },
  keterangan: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.sm },
  button: { marginTop: spacing.md },
});
