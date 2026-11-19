import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Linking, StyleSheet, Text, View } from 'react-native';

import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import type { IconName } from '../../components/icons';
import { colors, spacing, typography } from '../../theme';
import { useNotifikasi } from './NotifikasiContext';
import type { StatusPush } from './registrasiPush';

interface Tampilan {
  icon: IconName;
  warna: string;
  judul: string;
  pesan: string;
}

function tampilan(status: StatusPush): Tampilan {
  switch (status.kind) {
    case 'memeriksa':
      return { icon: 'notifications-outline', warna: colors.textSecondary, judul: 'Mendaftarkan notifikasi…', pesan: 'Menyiapkan perangkat untuk menerima pemberitahuan.' };
    case 'aktif':
      return { icon: 'notifications', warna: colors.successText, judul: 'Notifikasi aktif', pesan: 'Kamu akan diberi tahu saat sesi dibuka, jadwal berubah, atau izin diputuskan.' };
    case 'izin_ditolak':
      return {
        icon: 'notifications-off-outline',
        warna: colors.danger,
        judul: 'Izin notifikasi ditolak',
        pesan: status.bisaDimintaLagi
          ? 'Kamu tidak akan menerima pemberitahuan sesi dibuka, perubahan jadwal, dan keputusan izin.'
          : 'Aktifkan notifikasi PRAKTI di Pengaturan perangkat agar tidak ketinggalan sesi dibuka, perubahan jadwal, dan keputusan izin.',
      };
    case 'tidak_didukung':
      return { icon: 'notifications-off-outline', warna: colors.textSecondary, judul: 'Notifikasi tidak tersedia', pesan: status.pesan };
    case 'gagal':
      return { icon: 'alert-circle-outline', warna: colors.danger, judul: 'Perangkat belum terdaftar', pesan: status.pesan };
  }
}

/**
 * [SRS-018] Menampilkan status push notification praktikan.
 * @param hanyaMasalah true untuk menyembunyikan kartu saat notifikasi aktif/sedang diperiksa (dipakai di Beranda).
 */
export function StatusNotifikasiCard({ hanyaMasalah = false }: { hanyaMasalah?: boolean }) {
  const { status, daftarUlang } = useNotifikasi();
  if (!status) return null;
  if (hanyaMasalah && (status.kind === 'aktif' || status.kind === 'memeriksa' || status.kind === 'tidak_didukung')) {
    return null;
  }
  const t = tampilan(status);

  return (
    <Card>
      <View style={styles.row}>
        {status.kind === 'memeriksa' ? (
          <ActivityIndicator size="small" color={colors.navy} />
        ) : (
          <Ionicons name={t.icon} size={22} color={t.warna} />
        )}
        <View style={styles.text}>
          <Text style={[styles.title, { color: t.warna }]}>{t.judul}</Text>
          <Text style={styles.body}>{t.pesan}</Text>
        </View>
      </View>
      {status.kind === 'izin_ditolak' ? (
        <Button
          label={status.bisaDimintaLagi ? 'Izinkan Notifikasi' : 'Buka Pengaturan'}
          variant="outline"
          icon="settings-outline"
          onPress={status.bisaDimintaLagi ? daftarUlang : () => void Linking.openSettings()}
          style={styles.button}
        />
      ) : status.kind === 'gagal' ? (
        <Button label="Coba Lagi" variant="outline" icon="refresh-outline" onPress={daftarUlang} style={styles.button} />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  text: { flex: 1, gap: spacing.xs },
  title: { ...typography.bodyBold },
  body: { ...typography.caption, color: colors.textSecondary },
  button: { marginTop: spacing.md },
});
