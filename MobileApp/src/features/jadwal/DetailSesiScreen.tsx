import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { Jadwal } from '@/data/dummy';
import { formatWaktuSesi } from '@/utils/waktu';
import { StatusBadge } from './StatusBadge';
import { ConfirmModal } from '@/features/kelola-sesi/ConfirmModal';

export interface DetailSesiScreenProps {
  session?: Jadwal | null;
  onBack?: () => void;
  // Props aksi (opsional) untuk kebutuhan asisten mengelola sesi (SRS-004)
  actionSlot?: React.ReactNode;
  onBukaSesi?: (id: string) => void;
  onTutupSesi?: (id: string) => void;
}

export function DetailSesiScreen({
  session,
  onBack,
  actionSlot,
  onBukaSesi,
  onTutupSesi,
}: DetailSesiScreenProps) {
  // State modal konfirmasi untuk buka/tutup sesi
  const [modalType, setModalType] = useState<'buka' | 'tutup' | null>(null);

  // Kondisi jika data sesi tidak ditemukan / null
  if (!session) {
    return (
      <View style={styles.container}>
        {onBack && (
          <View style={styles.navBar}>
            <Pressable onPress={onBack} style={styles.backButton}>
              <Text style={styles.backButtonText}>← Kembali</Text>
            </Pressable>
          </View>
        )}
        <View style={styles.notFoundContainer}>
          <Text style={styles.notFoundIcon}>⚠️</Text>
          <Text style={styles.notFoundTitle}>Sesi tidak ditemukan</Text>
          <Text style={styles.notFoundSubtitle}>
            Data sesi yang Anda pilih tidak tersedia atau telah dihapus.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header navigasi atas */}
      <View style={styles.navBar}>
        {onBack ? (
          <Pressable onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Kembali</Text>
          </Pressable>
        ) : (
          <View />
        )}
        <Text style={styles.navTitle}>Detail Sesi</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Banner Utama */}
        <View style={styles.mainCard}>
          <View style={styles.badgeRow}>
            <View style={styles.kelasBadge}>
              <Text style={styles.kelasText}>Kelas {session.kelas}</Text>
            </View>
            <StatusBadge status={session.status} />
          </View>

          <Text style={styles.namaPraktikum}>{session.praktikum}</Text>
          <Text style={styles.sessionId}>ID Sesi: {session.id}</Text>
        </View>

        {/* Informasi Pelaksanaan */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Informasi Pelaksanaan</Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoIcon}>🕒</Text>
            <View style={styles.infoTextWrapper}>
              <Text style={styles.infoLabel}>Waktu & Jadwal</Text>
              <Text style={styles.infoValue}>
                {formatWaktuSesi(session.tanggal, session.jamMulai, session.jamSelesai)}
              </Text>
            </View>
          </View>

          {session.ruang ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoIcon}>📍</Text>
              <View style={styles.infoTextWrapper}>
                <Text style={styles.infoLabel}>Lokasi Ruangan</Text>
                <Text style={styles.infoValue}>{session.ruang}</Text>
              </View>
            </View>
          ) : null}

          {session.modul ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoIcon}>📖</Text>
              <View style={styles.infoTextWrapper}>
                <Text style={styles.infoLabel}>Materi / Modul</Text>
                <Text style={styles.infoValue}>{session.modul}</Text>
              </View>
            </View>
          ) : null}
        </View>

        {/* Catatan / Keterangan Sesi */}
        {session.keterangan ? (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Catatan Tambahan</Text>
            <Text style={styles.keteranganText}>{session.keterangan}</Text>
          </View>
        ) : null}

        {/* Bagian Tombol Aksi Kelola Sesi (Khusus Asisten / jika props disediakan) */}
        {actionSlot ? (
          <View style={styles.actionContainer}>{actionSlot}</View>
        ) : (onBukaSesi || onTutupSesi) ? (
          <View style={styles.actionContainer}>
            {session.status === 'belum_dibuka' && onBukaSesi && (
              <Pressable
                style={({ pressed }) => [
                  styles.actionBtn,
                  styles.btnBuka,
                  pressed && styles.btnPressed,
                ]}
                onPress={() => setModalType('buka')}
                accessibilityRole="button"
                accessibilityLabel="Buka Sesi Praktikum"
              >
                <Text style={styles.btnText}>▶ Buka Sesi Praktikum</Text>
              </Pressable>
            )}

            {session.status === 'dibuka' && onTutupSesi && (
              <Pressable
                style={({ pressed }) => [
                  styles.actionBtn,
                  styles.btnTutup,
                  pressed && styles.btnPressed,
                ]}
                onPress={() => setModalType('tutup')}
                accessibilityRole="button"
                accessibilityLabel="Tutup Sesi Praktikum"
              >
                <Text style={styles.btnText}>⏹ Tutup Sesi Praktikum</Text>
              </Pressable>
            )}

            {session.status === 'ditutup' && (
              <View style={styles.closedNoticeBox}>
                <Text style={styles.closedNoticeIcon}>ℹ️</Text>
                <Text style={styles.closedNoticeText}>
                  Sesi sudah ditutup dan tidak dapat dibuka kembali
                </Text>
              </View>
            )}
          </View>
        ) : null}
      </ScrollView>

      {/* Modal Konfirmasi Buka Sesi */}
      {onBukaSesi && (
        <ConfirmModal
          visible={modalType === 'buka'}
          title="Buka Sesi Praktikum?"
          message={`Apakah Anda yakin ingin membuka sesi praktikum ${session.praktikum} (${session.kelas})? Praktikan dapat mulai melakukan presensi.`}
          confirmLabel="Buka Sesi"
          confirmVariant="primary"
          onConfirm={() => {
            onBukaSesi(session.id);
            setModalType(null);
          }}
          onCancel={() => setModalType(null)}
        />
      )}

      {/* Modal Konfirmasi Tutup Sesi */}
      {onTutupSesi && (
        <ConfirmModal
          visible={modalType === 'tutup'}
          title="Tutup Sesi Praktikum?"
          message={`Apakah Anda yakin ingin menutup sesi praktikum ${session.praktikum} (${session.kelas})? Sesi yang telah ditutup bersifat permanen dan tidak dapat dibuka kembali.`}
          confirmLabel="Tutup Sesi"
          confirmVariant="danger"
          onConfirm={() => {
            onTutupSesi(session.id);
            setModalType(null);
          }}
          onCancel={() => setModalType(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563EB',
  },
  navTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  mainCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  kelasBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  kelasText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4338CA',
  },
  namaPraktikum: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 28,
  },
  sessionId: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 6,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 14,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  infoIcon: {
    fontSize: 18,
    marginTop: 2,
  },
  infoTextWrapper: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    lineHeight: 20,
  },
  keteranganText: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 20,
  },
  // Action Buttons (SRS-004)
  actionContainer: {
    marginTop: 4,
    marginBottom: 16,
  },
  actionBtn: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  btnBuka: {
    backgroundColor: '#16A34A', // Hijau
  },
  btnTutup: {
    backgroundColor: '#DC2626', // Merah
  },
  btnPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
  btnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  closedNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderColor: '#CBD5E1',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  closedNoticeIcon: {
    fontSize: 18,
  },
  closedNoticeText: {
    flex: 1,
    fontSize: 13,
    color: '#475569',
    fontWeight: '600',
    lineHeight: 18,
  },
  // Not Found State
  notFoundContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  notFoundIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  notFoundTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 8,
  },
  notFoundSubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
  },
});
