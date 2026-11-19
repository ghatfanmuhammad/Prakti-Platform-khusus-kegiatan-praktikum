import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useRef, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '../../components/AppHeader';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { InfoRow } from '../../components/InfoRow';
import { OtpInput } from '../../components/OtpInput';
import { SegmentedControl } from '../../components/SegmentedControl';
import { StatusPill } from '../../components/StatusPill';
import { useToast } from '../../components/Toast';
import { useCurrentPraktikan, usePrakti } from '../../context/PraktiContext';
import { errorMessage } from '../../features/data-praktikum/errors';
import { PracticumLoading } from '../../features/data-praktikum/PracticumLoading';
import { QrScanner } from '../../features/praktikan/QrScanner';
import { keadaanPresensi, pesanKeadaanPresensi, type KeadaanPresensi } from '../../features/presensi/halamanPresensi';
import { pesanHasilLokasi, type HasilLokasi } from '../../features/presensi/lokasi';
import { useStatusPresensi } from '../../features/presensi/useStatusPresensi';
import { useValidasiLokasi } from '../../features/presensi/useValidasiLokasi';
import type { AppStackParamList } from '../../navigation/types';
import { colors, radius, spacing, typography } from '../../theme';
import { pesanGagalPresensi } from '../../utils/attendanceRules';
import { PANJANG_KODE } from '../../utils/code';
import { formatJamDetik, formatTanggal } from '../../utils/date';
import { bacaIsiQr } from '../../utils/qr';
import { cariSesi } from '../../utils/selectors';

type Props = NativeStackScreenProps<AppStackParamList, 'Presensi'>;

type Metode = 'qr' | 'kode';
type Tahap = 'lokasi' | 'simpan';

const METODE = [
  { key: 'qr' as const, label: 'Scan QR' },
  { key: 'kode' as const, label: 'Ketik Kode' },
];

/**
 * [SRS-012] Halaman presensi yang terpisah dari detail sesi.
 * [SRS-013] Presensi hanya dikirim bila posisi perangkat berada dalam radius laboratorium sesi.
 * [SRS-018] Kondisi izin lokasi, GPS mati, koordinat belum tersedia, dan koneksi dijelaskan ke praktikan.
 */
export function PresensiScreen({ navigation, route }: Props) {
  const praktikan = useCurrentPraktikan();
  const { sesi: daftarSesi, presensi, catatPresensi } = usePrakti();
  const status = useStatusPresensi();
  const toast = useToast();
  const [metode, setMetode] = useState<Metode>('qr');
  const [kode, setKode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [tahap, setTahap] = useState<Tahap | null>(null);
  // Waktu hadir dari hasil penyimpanan, dipakai sampai snapshot presensi ikut diperbarui.
  const [waktuBaru, setWaktuBaru] = useState<string | null>(null);
  const pending = useRef(false);

  const sesi = cariSesi(daftarSesi, route.params.sesiId);
  const keadaan: KeadaanPresensi | null = waktuBaru
    ? { jenis: 'sudah_presensi', waktuHadir: waktuBaru }
    : sesi && praktikan
      ? keadaanPresensi(sesi, presensi, praktikan.id)
      : null;
  const bisaPresensi = keadaan?.jenis === 'bisa_presensi' && !status.loading && !status.error;
  const lokasi = useValidasiLokasi(sesi, bisaPresensi);

  if (!praktikan) return null;

  if (!sesi || !keadaan) {
    return (
      <View style={styles.root}>
        <AppHeader subtitle="Presensi" onBack={navigation.goBack} />
        {status.loading || status.error ? (
          <PracticumLoading error={status.error} onRetry={status.retry} />
        ) : (
          <EmptyState icon="alert-circle-outline" title="Sesi tidak ditemukan" />
        )}
      </View>
    );
  }

  const kirim = async (kodeMasuk: string = kode) => {
    if (pending.current) return;
    pending.current = true;
    setError(null);
    try {
      // Lokasi diperiksa ulang tepat saat presensi diajukan, bukan memakai hasil lama.
      setTahap('lokasi');
      const cek = await lokasi.periksa();
      // Hasil yang gagal sudah ditampilkan oleh panel lokasi, beserta tombol "Periksa Lagi".
      if (cek.jenis !== 'dalam_radius') return;
      setTahap('simpan');
      const hasil = await catatPresensi(sesi.id, praktikan.id, kodeMasuk, cek);
      if (hasil.ok) {
        setWaktuBaru(hasil.presensi.waktuHadir);
        toast.show('Presensi berhasil', 'success');
      } else {
        setError(pesanGagalPresensi(hasil));
      }
    } catch (err) {
      const firestoreCode = (err as { code?: string })?.code;
      setError(
        firestoreCode === 'permission-denied'
          ? 'Kode tidak cocok atau akses sesi sudah berubah.'
          : errorMessage(err),
      );
    } finally {
      pending.current = false;
      setTahap(null);
    }
  };

  const saatScan = (data: string) => {
    const isi = bacaIsiQr(data);
    if (!isi) {
      setError('QR ini bukan QR presensi PRAKTI');
      return;
    }
    if (isi.sesiId !== sesi.id) {
      setError('QR ini untuk sesi lain');
      return;
    }
    void kirim(isi.kode);
  };

  const busy = tahap !== null;
  const labelBusy = tahap === 'lokasi' ? 'Memeriksa lokasi…' : 'Mencatat…';

  const panelLokasi = (hasil: HasilLokasi | null) => {
    if (!hasil || (lokasi.memeriksa && !busy)) {
      return (
        <View style={[styles.box, styles.neutral]}>
          <ActivityIndicator color={colors.navy} />
          <Text style={[styles.boxText, { color: colors.textSecondary }]}>Memeriksa lokasimu…</Text>
        </View>
      );
    }
    const valid = hasil.jenis === 'dalam_radius';
    const pengaturan = hasil.jenis === 'izin_ditolak' && !hasil.bisaMintaLagi;
    return (
      <View>
        <View style={[styles.box, valid ? styles.success : styles.danger]}>
          <Ionicons
            name={valid ? 'location' : 'location-outline'}
            size={20}
            color={valid ? colors.successText : colors.danger}
          />
          <Text style={[styles.boxText, { color: valid ? colors.successText : colors.danger }]}>
            {pesanHasilLokasi(hasil)}
          </Text>
        </View>
        {!valid ? (
          <View style={styles.actions}>
            {pengaturan ? (
              <Button
                label="Buka Pengaturan"
                icon="settings-outline"
                onPress={() => void Linking.openSettings()}
                style={styles.action}
              />
            ) : null}
            <Button
              label="Periksa Lagi"
              icon="refresh"
              variant="outline"
              disabled={lokasi.memeriksa}
              onPress={() => void lokasi.periksa()}
              style={styles.action}
            />
          </View>
        ) : null}
      </View>
    );
  };

  const formPresensi = () => (
    <View style={styles.form}>
      <View style={styles.tabs}>
        <SegmentedControl
          options={METODE}
          value={metode}
          onChange={(m) => {
            setMetode(m);
            setError(null);
          }}
        />
      </View>
      {metode === 'qr' ? (
        <>
          <Text style={styles.hint}>Arahkan kamera ke QR di layar asisten.</Text>
          <View style={styles.scanner}>
            <QrScanner onScan={saatScan} paused={busy} />
          </View>
          {busy ? <Text style={styles.hint}>{labelBusy}</Text> : null}
        </>
      ) : (
        <>
          <Text style={styles.hint}>Masukkan kode {PANJANG_KODE} angka dari asisten.</Text>
          <View style={styles.otp}>
            <OtpInput
              value={kode}
              onChangeText={(v) => {
                setKode(v);
                setError(null);
              }}
              length={PANJANG_KODE}
              hasError={error !== null}
            />
          </View>
          <Button
            label={busy ? labelBusy : 'Kirim Presensi'}
            icon="checkmark-circle-outline"
            disabled={busy || kode.length < PANJANG_KODE}
            onPress={() => void kirim()}
            style={styles.fullButton}
          />
        </>
      )}
    </View>
  );

  const panel = () => {
    // Form baru tampil setelah catatan presensi termuat, agar praktikan yang sudah hadir
    // tidak sempat melihat form presensi (sama seperti SRS-009).
    if (!waktuBaru && (status.loading || status.error)) {
      return <PracticumLoading error={status.error} onRetry={status.retry} />;
    }

    if (keadaan.jenis === 'sudah_presensi') {
      return (
        <View style={styles.center}>
          <Ionicons name="checkmark-circle" size={64} color={colors.success} />
          <Text style={styles.successTitle}>Presensi berhasil</Text>
          <Text style={styles.successText}>Tercatat pukul {formatJamDetik(keadaan.waktuHadir)}</Text>
          <Button label="Kembali" onPress={navigation.goBack} style={styles.fullButton} />
        </View>
      );
    }

    if (keadaan.jenis !== 'bisa_presensi') {
      const ditutup = keadaan.jenis === 'ditutup';
      return (
        <View style={[styles.box, ditutup ? styles.danger : styles.neutral]}>
          <Ionicons
            name={ditutup ? 'close-circle' : 'time-outline'}
            size={20}
            color={ditutup ? colors.danger : colors.textSecondary}
          />
          <Text style={[styles.boxText, { color: ditutup ? colors.danger : colors.textSecondary }]}>
            {pesanKeadaanPresensi(keadaan)}
          </Text>
        </View>
      );
    }

    return (
      <View>
        <Text style={styles.panelTitle}>Ajukan Presensi</Text>
        <Text style={styles.hint}>Presensi hanya bisa dikirim dari dalam radius laboratorium.</Text>
        <View style={styles.lokasi}>{panelLokasi(lokasi.hasil)}</View>
        {/* Form tetap tampil saat memeriksa ulang agar kode yang sudah diketik tidak hilang. */}
        {lokasi.hasil?.jenis === 'dalam_radius' || busy ? formPresensi() : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <AppHeader subtitle="Presensi" onBack={navigation.goBack} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card>
          <View style={styles.titleRow}>
            <View style={styles.titleText}>
              <Text style={styles.title}>{sesi.praktikum}</Text>
              <Text style={styles.kelas}>Kelas {sesi.kelas}</Text>
            </View>
            <StatusPill status={sesi.status} />
          </View>
          <View style={styles.info}>
            <InfoRow icon="calendar-outline" text={formatTanggal(sesi.tanggal)} />
            <InfoRow icon="time-outline" text={`${sesi.mulai} - ${sesi.selesai}`} />
            <InfoRow icon="location-outline" text={sesi.ruang} />
          </View>
        </Card>
        <Card>{panel()}</Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  titleText: { flex: 1, marginRight: spacing.md },
  title: { ...typography.title, color: colors.textPrimary },
  kelas: { ...typography.captionBold, color: colors.accentText },
  info: { marginTop: spacing.md, gap: spacing.sm },

  panelTitle: { ...typography.subtitle, color: colors.textPrimary, textAlign: 'center' },
  lokasi: { marginTop: spacing.md },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  action: { flex: 1 },
  form: { marginTop: spacing.sm },
  tabs: { marginTop: spacing.lg, alignItems: 'center' },
  hint: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm },
  scanner: { marginTop: spacing.lg },
  otp: { marginTop: spacing.xl },
  error: { ...typography.bodyBold, color: colors.danger, textAlign: 'center', marginTop: spacing.md },
  fullButton: { marginTop: spacing.xl, alignSelf: 'stretch' },

  center: { alignItems: 'center' },
  successTitle: { ...typography.title, color: colors.successText, marginTop: spacing.md },
  successText: { ...typography.body, color: colors.textSecondary, marginTop: spacing.xs },

  box: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  neutral: { backgroundColor: colors.background, borderColor: colors.border },
  success: { backgroundColor: colors.successBg, borderColor: colors.successBorder },
  danger: { backgroundColor: colors.dangerBg, borderColor: colors.dangerBorder },
  boxText: { ...typography.bodyBold, flex: 1 },
});
