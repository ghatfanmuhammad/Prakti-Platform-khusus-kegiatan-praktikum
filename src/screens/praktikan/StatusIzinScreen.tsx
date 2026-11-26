import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '../../components/AppHeader';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { IzinStatusBadge } from '../../components/IzinStatusBadge';
import { useCurrentPraktikan } from '../../context/PraktiContext';
import type { ScreenProps } from '../../navigation/types';
import {
  formatIzinError,
  subscribeIzinPraktikan,
  type PengajuanIzin,
} from '../../services/izinService';
import { colors, radius, spacing, typography } from '../../theme';

type Props = ScreenProps<'StatusIzin'>;

const KETERANGAN: Record<PengajuanIzin['status'], string> = {
  Menunggu: 'Menunggu pemeriksaan asisten.',
  Disetujui: 'Izin diterima. Ketidakhadiran pada sesi ini tercatat sebagai izin.',
  Ditolak: 'Izin ditolak. Hubungi asisten bila perlu klarifikasi.',
};

function formatWaktu(ts: unknown): string | null {
  const t = ts as { toDate?: () => Date } | null | undefined;
  if (!t?.toDate) return null;
  return t.toDate().toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * [SRS-011] Praktikan memantau keputusan asisten atas pengajuan izinnya secara real-time.
 * Form pengajuan izin sendiri adalah bagian SRS-010.
 */
export function StatusIzinScreen({ navigation }: Props) {
  const praktikan = useCurrentPraktikan();
  const [daftar, setDaftar] = useState<PengajuanIzin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dariCache, setDariCache] = useState(false);
  const [percobaan, setPercobaan] = useState(0);

  const praktikanId = praktikan?.id;

  useEffect(() => {
    if (!praktikanId) return;
    setLoading(true);
    setError(null);

    const unsubscribe = subscribeIzinPraktikan(
      praktikanId,
      (hasil) => {
        setDaftar(hasil.daftar);
        setDariCache(hasil.dariCache);
        setLoading(false);
      },
      (err) => {
        console.warn('Gagal memuat status izin:', err);
        setError(formatIzinError(err));
        setLoading(false);
      },
    );
    return () => unsubscribe();
  }, [praktikanId, percobaan]);

  if (!praktikan) return null;

  return (
    <View style={styles.root}>
      <AppHeader subtitle="Status Izin" onBack={() => navigation.goBack()} />

      {!loading && !error && dariCache ? (
        <View style={styles.offlineBanner}>
          <Ionicons name="cloud-offline-outline" size={16} color={colors.danger} />
          <Text style={styles.offlineText}>Sedang offline. Status mungkin belum terbaru.</Text>
        </View>
      ) : null}

      {/* SRS-010: pintu masuk form pengajuan izin */}
      <View style={styles.actions}>
        <Button
          label="Ajukan Izin"
          icon="add-circle-outline"
          onPress={() => navigation.navigate('AjukanIzin')}
        />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.navy} />
          <Text style={styles.muted}>Memuat status izin...</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <View style={styles.errorCard}>
            <Ionicons name="cloud-offline-outline" size={44} color={colors.danger} />
            <Text style={styles.errorTitle}>Gagal Memuat</Text>
            <Text style={styles.errorDesc}>{error}</Text>
            <Pressable style={styles.retryBtn} onPress={() => setPercobaan((n) => n + 1)}>
              <Ionicons name="refresh" size={16} color={colors.surface} />
              <Text style={styles.retryText}>Coba Lagi</Text>
            </Pressable>
          </View>
        </View>
      ) : daftar.length === 0 ? (
        <EmptyState
          icon="document-text-outline"
          title="Belum Ada Pengajuan Izin"
          description="Pengajuan izin yang kamu kirim beserta keputusan asisten akan muncul di sini."
        />
      ) : (
        <FlatList
          data={daftar}
          keyExtractor={(item, i) => item.id ?? String(i)}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const diajukan = formatWaktu(item.createdAt);
            const diputuskan = item.status !== 'Menunggu' ? formatWaktu(item.updatedAt) : null;
            return (
              <Card style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.sesi}>{item.sesiNama}</Text>
                  <IzinStatusBadge status={item.status} />
                </View>
                {diajukan ? <Text style={styles.muted}>Diajukan {diajukan}</Text> : null}

                <View style={styles.alasanBox}>
                  <Text style={styles.alasanLabel}>Alasan:</Text>
                  <Text style={styles.alasanText}>{item.alasan}</Text>
                </View>

                <Text style={styles.keterangan}>{KETERANGAN[item.status]}</Text>
                {item.reviewedBy ? (
                  <Text style={styles.reviewed}>
                    Ditinjau oleh {item.reviewedBy}
                    {diputuskan ? ` · ${diputuskan}` : ''}
                  </Text>
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
  actions: { paddingHorizontal: spacing.md, paddingTop: spacing.md },
  list: { padding: spacing.md, paddingBottom: spacing.xl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  muted: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },

  card: { marginBottom: spacing.md, padding: spacing.md },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  sesi: { ...typography.title, color: colors.textPrimary, flex: 1 },
  alasanBox: {
    backgroundColor: colors.tile,
    padding: spacing.sm,
    borderRadius: radius.sm,
    marginTop: spacing.sm,
  },
  alasanLabel: { ...typography.caption, color: colors.textSecondary, marginBottom: 2 },
  alasanText: { ...typography.body, color: colors.textPrimary },
  keterangan: { ...typography.body, color: colors.textPrimary, marginTop: spacing.sm },
  reviewed: { ...typography.caption, color: colors.textSecondary, fontStyle: 'italic', marginTop: spacing.xs },

  errorCard: {
    backgroundColor: colors.surface,
    padding: spacing.xl,
    borderRadius: radius.md,
    alignItems: 'center',
    borderColor: colors.dangerBorder,
    borderWidth: 1,
  },
  errorTitle: { ...typography.title, color: colors.danger, marginTop: spacing.sm },
  errorDesc: { ...typography.caption, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xs },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.md,
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
    backgroundColor: colors.navy,
  },
  retryText: { ...typography.button, color: colors.surface, fontSize: 13 },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    backgroundColor: colors.dangerBg,
    borderColor: colors.dangerBorder,
  },
  offlineText: { ...typography.caption, color: colors.danger, flex: 1 },
});
