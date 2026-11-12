// Halaman kosong sementara untuk tab yang dikerjakan anggota lain.
import { StyleSheet, Text, View } from 'react-native';

import { palette } from '@/constants/palette';
import { useApp } from '@/context/app-context';

export function PlaceholderScreen({ judul, pemilik }: { judul: string; pemilik: string }) {
  const { pengguna } = useApp();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{judul}</Text>
      <Text style={styles.body}>Halaman ini dikerjakan oleh {pemilik}.</Text>
      {pengguna ? (
        <Text style={styles.user}>
          Masuk sebagai {pengguna.nama} ({pengguna.kode})
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8, backgroundColor: palette.mist },
  title: { fontSize: 20, fontWeight: '700', color: palette.ink },
  body: { fontSize: 15, color: palette.muted, textAlign: 'center' },
  user: { marginTop: 8, fontSize: 15, fontWeight: '600', color: palette.teal, textAlign: 'center' },
});
