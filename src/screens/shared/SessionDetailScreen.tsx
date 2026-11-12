import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '../../components/AppHeader';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { InfoRow } from '../../components/InfoRow';
import { StatusPill } from '../../components/StatusPill';
import { usePrakti } from '../../context/PraktiContext';
import { AsistenSessionPanel } from '../../features/asisten/AsistenSessionPanel';
import { PraktikanSessionPanel } from '../../features/praktikan/PraktikanSessionPanel';
import type { AppStackParamList } from '../../navigation/types';
import { colors, spacing, typography } from '../../theme';
import { formatTanggal } from '../../utils/date';
import { cariSesi } from '../../utils/selectors';

type Props = NativeStackScreenProps<AppStackParamList, 'SessionDetail'>;

export function SessionDetailScreen({ navigation, route }: Props) {
  const { currentUser, sesi: daftar, asistenList } = usePrakti();
  const sesi = cariSesi(daftar, route.params.sesiId);

  if (!sesi || !currentUser) {
    return (
      <View style={styles.root}>
        <AppHeader subtitle="Detail Sesi" onBack={navigation.goBack} />
        <EmptyState icon="alert-circle-outline" title="Sesi tidak ditemukan" />
      </View>
    );
  }

  const asisten = asistenList.find((a) => a.id === sesi.asistenId);
  // Asisten hanya mengendalikan sesinya sendiri; sesi asisten lain bersifat baca saja.
  const milikSendiri = currentUser.role === 'asisten' && currentUser.asisten.id === sesi.asistenId;

  return (
    <View style={styles.root}>
      <AppHeader subtitle="Detail Sesi" onBack={navigation.goBack} />
      <ScrollView contentContainerStyle={styles.content}>
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
            {asisten ? <InfoRow icon="person-outline" text={`Asisten: ${asisten.nama}`} /> : null}
            {sesi.topik ? <InfoRow icon="book-outline" text={`Topik: ${sesi.topik}`} /> : null}
          </View>
        </Card>
        <Card style={styles.panel}>
          {currentUser.role === 'praktikan' ? (
            <PraktikanSessionPanel sesi={sesi} />
          ) : milikSendiri ? (
            <AsistenSessionPanel sesi={sesi} />
          ) : (
            <Text style={styles.readonly}>Sesi ini diampu asisten lain, kamu hanya bisa melihatnya.</Text>
          )}
        </Card>
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
  panel: {},
  readonly: { ...typography.body, color: colors.textSecondary },
});
