import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '../../components/BottomSheet';
import { Button } from '../../components/Button';
import { OtpInput } from '../../components/OtpInput';
import { SegmentedControl } from '../../components/SegmentedControl';
import { useToast } from '../../components/Toast';
import { useCurrentPraktikan, usePrakti } from '../../context/PraktiContext';
import { colors, spacing, typography } from '../../theme';
import type { Sesi } from '../../types';
import { PANJANG_KODE } from '../../utils/code';
import { pesanGagalPresensi } from '../../utils/attendanceRules';
import { formatJamDetik } from '../../utils/date';
import { bacaIsiQr } from '../../utils/qr';
import { QrScanner } from './QrScanner';

type Metode = 'qr' | 'kode';

const METODE = [
  { key: 'qr' as const, label: 'Scan QR' },
  { key: 'kode' as const, label: 'Ketik Kode' },
];

interface Props {
  visible: boolean;
  sesi: Sesi | null;
  onClose: () => void;
}

export function CheckInSheet({ visible, sesi, onClose }: Props) {
  const praktikan = useCurrentPraktikan();
  const { catatPresensi } = usePrakti();
  const toast = useToast();
  const [kode, setKode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [waktu, setWaktu] = useState<string | null>(null);
  const [metode, setMetode] = useState<Metode>('qr');

  useEffect(() => {
    if (!visible) {
      setKode('');
      setError(null);
      setWaktu(null);
      setMetode('qr');
    }
  }, [visible]);

  if (!sesi || !praktikan) return null;

  const kirim = (kodeMasuk: string = kode) => {
    const hasil = catatPresensi(sesi.id, praktikan.id, kodeMasuk);
    if (hasil.ok) {
      setError(null);
      setWaktu(hasil.presensi.waktuHadir);
      toast.show('Presensi berhasil', 'success');
    } else {
      setError(pesanGagalPresensi(hasil));
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
    kirim(isi.kode);
  };

  return (
    <BottomSheet visible={visible} title="Presensi praktikum" onClose={onClose}>
      {waktu ? (
        <View style={styles.center}>
          <Ionicons name="checkmark-circle" size={64} color={colors.success} />
          <Text style={styles.successTitle}>Presensi berhasil</Text>
          <Text style={styles.successText}>
            {sesi.praktikum} · Kelas {sesi.kelas}
          </Text>
          <Text style={styles.successText}>Tercatat pukul {formatJamDetik(waktu)}</Text>
          <Button label="Selesai" onPress={onClose} style={styles.fullButton} />
        </View>
      ) : (
        <View>
          <Text style={styles.title}>
            {sesi.praktikum} · Kelas {sesi.kelas}
          </Text>
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
                <QrScanner onScan={saatScan} />
              </View>
              {error ? <Text style={styles.error}>{error}</Text> : null}
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
                  autoFocus
                />
              </View>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <Button
                label="Kirim Presensi"
                icon="checkmark-circle-outline"
                disabled={kode.length < PANJANG_KODE}
                onPress={() => kirim()}
                style={styles.fullButton}
              />
            </>
          )}
        </View>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center' },
  title: { ...typography.subtitle, color: colors.textPrimary, textAlign: 'center' },
  hint: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xs },
  tabs: { marginTop: spacing.lg, alignItems: 'center' },
  scanner: { marginTop: spacing.lg },
  otp: { marginTop: spacing.xl },
  error: {
    ...typography.bodyBold,
    color: colors.danger,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  successTitle: { ...typography.title, color: colors.successText, marginTop: spacing.md },
  successText: { ...typography.body, color: colors.textSecondary, marginTop: spacing.xs },
  fullButton: { marginTop: spacing.xl, alignSelf: 'stretch' },
});
