import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Button } from '../../components/Button';
import { colors, radius, spacing, typography } from '../../theme';

interface Props {
  /** Dipanggil sekali per QR yang terbaca. */
  onScan: (data: string) => void;
  /** Saat true, hasil pindaian diabaikan (misalnya sedang menampilkan error). */
  paused?: boolean;
}

/** Kamera untuk memindai QR presensi dari layar asisten. */
export function QrScanner({ onScan, paused = false }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const terakhir = useRef<{ data: string; waktu: number } | null>(null);

  if (!permission) {
    return (
      <View style={styles.placeholder}>
        <ActivityIndicator color={colors.navy} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.placeholder}>
        <Ionicons name="camera-outline" size={40} color={colors.navy} />
        <Text style={styles.text}>Izinkan akses kamera untuk memindai QR presensi.</Text>
        {permission.canAskAgain ? (
          <Button label="Izinkan Kamera" icon="camera-outline" onPress={requestPermission} style={styles.button} />
        ) : (
          <Text style={styles.text}>Akses kamera ditolak. Aktifkan lewat pengaturan perangkat, atau pakai kode.</Text>
        )}
      </View>
    );
  }

  return (
    <View style={styles.frame}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={
          paused
            ? undefined
            : ({ data }) => {
                // Kamera memanggil berkali-kali per detik; abaikan QR yang sama dalam 2 detik.
                const now = Date.now();
                const prev = terakhir.current;
                if (prev && prev.data === data && now - prev.waktu < 2000) return;
                terakhir.current = { data, waktu: now };
                onScan(data);
              }
        }
      />
      <View style={styles.target} pointerEvents="none" />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    height: 260,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  target: {
    width: 180,
    height: 180,
    borderWidth: 3,
    borderColor: colors.surface,
    borderRadius: radius.md,
  },
  placeholder: {
    height: 260,
    borderRadius: radius.lg,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  text: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  button: { alignSelf: 'stretch', marginTop: spacing.sm },
});
