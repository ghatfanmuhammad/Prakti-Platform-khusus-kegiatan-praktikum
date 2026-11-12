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
import { StatusPill } from '../../components/StatusPill';
import { useCurrentAsisten } from '../../context/PraktiContext';
import {
  periksaIzin,
  subscribeDaftarIzin,
  type PengajuanIzin,
  type StatusIzin,
} from '../../services/izinService';
import { cardShadow, colors, radius, spacing, typography } from '../../theme';

export function PemeriksaanIzinScreen({ navigation }: { navigation: any }) {
  const asisten = useCurrentAsisten();
  const [daftarIzin, setDaftarIzin] = useState<PengajuanIzin[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorKoneksi, setErrorKoneksi] = useState<string | null>(null);

  // State untuk modal konfirmasi keputusan
  const [selectedIzin, setSelectedIzin] = useState<PengajuanIzin | null>(null);
  const [actionType, setActionType] = useState<'Disetujui' | 'Ditolak' | null>(null);
  const [processing, setProcessing] = useState<boolean>(false);

  useEffect(() => {
    setLoading(true);
    setErrorKoneksi(null);

    // Berlangganan data izin real-time via Firestore (SRS-011)
    const unsubscribe = subscribeDaftarIzin(
      (data) => {
        setDaftarIzin(data);
        setLoading(false);
      },
      (err) => {
        console.warn('Gagal memuat izin real-time:', err);
        setErrorKoneksi('Gagal memuat data izin. Periksa koneksi internet Anda.');
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, []);

  const handleBukaKonfirmasi = (item: PengajuanIzin, type: 'Disetujui' | 'Ditolak') => {
    setSelectedIzin(item);
    setActionType(type);
  };

  const handleEksekusiKeputusan = async () => {
    if (!selectedIzin?.id || !actionType) return;
    setProcessing(true);

    try {
      const namaAsisten = asisten?.nama || 'Asisten';
      await periksaIzin(selectedIzin.id, actionType, namaAsisten);
      setSelectedIzin(null);
      setActionType(null);
    } catch (err: any) {
      Alert.alert('Gagal', err?.message || 'Gagal memperbarui status izin.');
    } finally {
      setProcessing(false);
    }
  };

  const renderBadge = (status: StatusIzin) => {
    if (status === 'Disetujui') {
      return (
        <View style={[styles.badge, { backgroundColor: colors.successBg, borderColor: colors.successBorder }]}>
          <Text style={[styles.badgeText, { color: colors.successText }]}>Disetujui</Text>
        </View>
      );
    }
    if (status === 'Ditolak') {
      return (
        <View style={[styles.badge, { backgroundColor: colors.dangerBg, borderColor: colors.dangerBorder }]}>
          <Text style={[styles.badgeText, { color: colors.danger }]}>Ditolak</Text>
        </View>
      );
    }
    return (
      <View style={[styles.badge, { backgroundColor: colors.neutralBg, borderColor: colors.divider }]}>
        <Text style={[styles.badgeText, { color: colors.accentText }]}>Menunggu</Text>
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <AppHeader subtitle="Pemeriksaan Izin" onBack={() => navigation.goBack()} />

      <View style={styles.container}>
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
                  {renderBadge(item.status)}
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
                onPress={() => setSelectedIzin(null)}
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

  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  badgeText: { fontSize: 12, fontWeight: '700' },

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
