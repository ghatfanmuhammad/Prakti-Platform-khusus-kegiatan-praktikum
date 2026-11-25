import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AppHeader } from '../../components/AppHeader';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { HasilAIBox } from '../../components/HasilAIBox';
import { IzinStatusBadge } from '../../components/IzinStatusBadge';
import { useToast } from '../../components/Toast';
import { useCurrentAsisten } from '../../context/PraktiContext';
import {
  formatIzinError,
  klasifikasiUlangIzin,
  subscribeDaftarIzin,
  type PengajuanIzin,
} from '../../services/izinService';
import { periksaIzinDenganNotifikasi } from '../../features/notifikasi/aksi';
import { ringkasHasil } from '../../features/notifikasi/pesan';
import { cardShadow, colors, radius, spacing, typography } from '../../theme';

export function PemeriksaanIzinScreen({ navigation }: { navigation: any }) {
  const asisten = useCurrentAsisten();
  const toast = useToast();
  const [daftarIzin, setDaftarIzin] = useState<PengajuanIzin[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorKoneksi, setErrorKoneksi] = useState<string | null>(null);
  const [dariCache, setDariCache] = useState<boolean>(false);
  // Dinaikkan saat tombol "Coba Lagi" ditekan untuk memasang ulang listener
  const [percobaan, setPercobaan] = useState<number>(0);

  // State untuk modal konfirmasi keputusan
  const [selectedIzin, setSelectedIzin] = useState<PengajuanIzin | null>(null);
  const [actionType, setActionType] = useState<'Disetujui' | 'Ditolak' | null>(null);
  const [processing, setProcessing] = useState<boolean>(false);
  const [reklasifikasiId, setReklasifikasiId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setErrorKoneksi(null);

    // Berlangganan data izin real-time via Firestore (SRS-011)
    const unsubscribe = subscribeDaftarIzin(
      ({ daftar, dariCache: cache }) => {
        setDaftarIzin(daftar);
        setDariCache(cache);
        setLoading(false);
      },
      (err) => {
        console.warn('Gagal memuat izin real-time:', err);
        setErrorKoneksi(formatIzinError(err));
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [percobaan]);

  const tutupKonfirmasi = () => {
    setSelectedIzin(null);
    setActionType(null);
  };

  // [Sprint 2 #6] Ulangi klasifikasi AI bila sebelumnya gagal (mis. layanan AI tidak merespons)
  const handleKlasifikasiUlang = async (item: PengajuanIzin) => {
    if (!item.id || reklasifikasiId) return;
    setReklasifikasiId(item.id);
    try {
      const hasil = await klasifikasiUlangIzin(item.id, item.alasan);
      if (hasil.statusAI === 'gagal') {
        Alert.alert('Klasifikasi AI gagal', hasil.pesanAI ?? 'Coba lagi beberapa saat lagi.');
      }
    } catch (err) {
      Alert.alert('Gagal menyimpan hasil AI', formatIzinError(err));
    } finally {
      setReklasifikasiId(null);
    }
  };

  const handleBukaKonfirmasi =(item: PengajuanIzin, type: 'Disetujui' | 'Ditolak') => {
    setSelectedIzin(item);
    setActionType(type);
  };

  const handleEksekusiKeputusan = async () => {
    if (!selectedIzin?.id || !actionType || !asisten) return;
    setProcessing(true);

    try {
      const hasil = await periksaIzinDenganNotifikasi(selectedIzin.id, actionType, { uid: asisten.id, nama: asisten.nama });
      tutupKonfirmasi();
      const terkirim = !hasil.galat && hasil.terkirim === 1;
      toast.show(
        `Izin ${actionType.toLowerCase()}. ${ringkasHasil(hasil)}`,
        terkirim ? 'success' : 'info',
      );
    } catch (err) {
      tutupKonfirmasi();
      Alert.alert('Gagal memperbarui status izin', formatIzinError(err));
    } finally {
      setProcessing(false);
    }
  };

  return (
    <View style={styles.root}>
      <AppHeader subtitle="Pemeriksaan Izin" onBack={() => navigation.goBack()} />

      <View style={styles.container}>
        {/* Penanda offline: data dari cache, keputusan baru tidak bisa dikirim */}
        {!loading && !errorKoneksi && dariCache ? (
          <View style={styles.offlineBanner}>
            <Ionicons name="cloud-offline-outline" size={16} color={colors.danger} />
            <Text style={styles.offlineText}>
              Sedang offline. Data mungkin belum terbaru dan keputusan belum bisa dikirim.
            </Text>
          </View>
        ) : null}

        {/* State 1: Loading */}
        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={colors.navy} />
            <Text style={styles.loadingText}>Memuat daftar pengajuan izin...</Text>
          </View>
        ) : errorKoneksi ? (
          /* State 2: Error Koneksi */
          <View style={styles.centerBox}>
            <View style={styles.errorCard}>
              <Ionicons name="cloud-offline-outline" size={44} color={colors.danger} />
              <Text style={styles.errorTitle}>Koneksi Bermasalah</Text>
              <Text style={styles.errorDesc}>{errorKoneksi}</Text>
              <Pressable style={styles.retryBtn} onPress={() => setPercobaan((n) => n + 1)}>
                <Ionicons name="refresh" size={16} color={colors.surface} />
                <Text style={styles.retryText}>Coba Lagi</Text>
              </Pressable>
            </View>
          </View>
        ) : daftarIzin.length === 0 ? (
          /* State 3: Empty State */
          <EmptyState
            icon="document-text-outline"
            title="Belum Ada Pengajuan Izin"
            description="Pengajuan izin dari praktikan akan muncul di sini secara real-time."
          />
        ) : (
          /* State 4: List Data */
          <FlatList
            data={daftarIzin}
            keyExtractor={(item, index) => item.id || String(index)}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <Card style={styles.cardItem}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.praktikanNama}>{item.praktikanNama}</Text>
                    <Text style={styles.praktikanNim}>{item.praktikanNim}</Text>
                  </View>
                  <IzinStatusBadge status={item.status} />
                </View>

                <View style={styles.divider} />

                <View style={styles.sectionRow}>
                  <Text style={styles.label}>Sesi / Praktikum:</Text>
                  <Text style={styles.valueSesi}>{item.sesiNama}</Text>
                </View>

                <View style={styles.alasanBox}>
                  <Text style={styles.alasanLabel}>Alasan Izin:</Text>
                  <Text style={styles.alasanText}>{item.alasan}</Text>
                </View>

                <HasilAIBox
                  izin={item}
                  memproses={reklasifikasiId === item.id}
                  onKlasifikasiUlang={() => handleKlasifikasiUlang(item)}
                />

                {item.reviewedBy ? (
                  <Text style={styles.reviewedBy}>Ditinjau oleh: {item.reviewedBy}</Text>
                ) : null}

                {/* Tombol aksi hanya jika status masih Menunggu */}
                {item.status === 'Menunggu' && (
                  <View style={styles.actionRow}>
                    <Pressable
                      style={[styles.btnAction, styles.btnTolak]}
                      onPress={() => handleBukaKonfirmasi(item, 'Ditolak')}
                    >
                      <Ionicons name="close-circle-outline" size={18} color={colors.danger} />
                      <Text style={styles.btnTolakText}>Tolak</Text>
                    </Pressable>

                    <Pressable
                      style={[styles.btnAction, styles.btnSetujui]}
                      onPress={() => handleBukaKonfirmasi(item, 'Disetujui')}
                    >
                      <Ionicons name="checkmark-circle-outline" size={18} color={colors.surface} />
                      <Text style={styles.btnSetujuiText}>Setujui</Text>
                    </Pressable>
                  </View>
                )}
              </Card>
            )}
          />
        )}
      </View>

      {/* Modal Konfirmasi Keputusan (SRS-011) */}
      <Modal visible={!!selectedIzin} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconBox}>
              <Ionicons
                name={actionType === 'Disetujui' ? 'checkmark-circle' : 'alert-circle'}
                size={40}
                color={actionType === 'Disetujui' ? colors.success : colors.danger}
              />
            </View>

            <Text style={styles.modalTitle}>
              {actionType === 'Disetujui' ? 'Setujui Permohonan Izin?' : 'Tolak Permohonan Izin?'}
            </Text>

            <Text style={styles.modalDesc}>
              Pengajuan izin dari <Text style={{ fontWeight: '700' }}>{selectedIzin?.praktikanNama}</Text> akan ditandai sebagai {actionType}. Keputusan ini akan langsung terlihat oleh praktikan.
            </Text>

            <View style={styles.modalBtnRow}>
              <Pressable
                disabled={processing}
                style={[styles.modalBtn, styles.modalBtnCancel]}
                onPress={tutupKonfirmasi}
              >
                <Text style={styles.modalBtnCancelText}>Batal</Text>
              </Pressable>

              <Pressable
                disabled={processing}
                style={[
                  styles.modalBtn,
                  actionType === 'Disetujui' ? styles.modalBtnConfirmSuccess : styles.modalBtnConfirmDanger,
                ]}
                onPress={handleEksekusiKeputusan}
              >
                {processing ? (
                  <ActivityIndicator color={colors.surface} />
                ) : (
                  <Text style={styles.modalBtnConfirmText}>Konfirmasi</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1 },
  list: { padding: spacing.md, paddingBottom: spacing.xl },
  centerBox: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  loadingText: { ...typography.body, color: colors.textSecondary, marginTop: spacing.sm },

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

  cardItem: { marginBottom: spacing.md, padding: spacing.md },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  praktikanNama: { ...typography.title, color: colors.textPrimary },
  praktikanNim: { ...typography.caption, color: colors.textSecondary },

  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.sm },
  sectionRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs },
  label: { ...typography.caption, color: colors.textSecondary, width: 120 },
  valueSesi: { ...typography.body, color: colors.textPrimary, fontWeight: '600', flex: 1 },

  alasanBox: {
    backgroundColor: colors.tile,
    padding: spacing.sm,
    borderRadius: radius.sm,
    marginVertical: spacing.xs,
  },
  alasanLabel: { ...typography.caption, color: colors.textSecondary, marginBottom: 2 },
  alasanText: { ...typography.body, color: colors.textPrimary },
  reviewedBy: { ...typography.caption, color: colors.textSecondary, fontStyle: 'italic', marginTop: spacing.xs },


  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  btnAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: radius.sm,
    gap: 6,
  },
  btnTolak: {
    backgroundColor: colors.surface,
    borderColor: colors.danger,
    borderWidth: 1,
  },
  btnTolakText: { ...typography.button, color: colors.danger, fontSize: 13 },
  btnSetujui: {
    backgroundColor: colors.navy,
  },
  btnSetujuiText: { ...typography.button, color: colors.surface, fontSize: 13 },

  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.surface,
    width: '100%',
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    ...cardShadow,
  },
  modalIconBox: { marginBottom: spacing.sm },
  modalTitle: { ...typography.title, color: colors.textPrimary, textAlign: 'center' },
  modalDesc: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginVertical: spacing.md },
  modalBtnRow: { flexDirection: 'row', gap: spacing.sm, width: '100%' },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnCancel: { backgroundColor: colors.neutralBg },
  modalBtnCancelText: { ...typography.button, color: colors.neutralText },
  modalBtnConfirmSuccess: { backgroundColor: colors.success },
  modalBtnConfirmDanger: { backgroundColor: colors.danger },
  modalBtnConfirmText: { ...typography.button, color: colors.surface },
});
