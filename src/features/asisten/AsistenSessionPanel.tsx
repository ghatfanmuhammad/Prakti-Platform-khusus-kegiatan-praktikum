import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Button } from '../../components/Button';
import { ConfirmModal } from '../../components/ConfirmModal';
import { ProgressBar } from '../../components/ProgressBar';
import { useToast } from '../../components/Toast';
import { usePrakti } from '../../context/PraktiContext';
import type { AppStackParamList } from '../../navigation/types';
import { colors, radius, spacing, typography } from '../../theme';
import type { Sesi } from '../../types';
import { presensiSesi } from '../../utils/selectors';
import { OpenSessionSheet } from './OpenSessionSheet';

/** Kontrol sesi untuk asisten: buka, lihat kode dan jumlah hadir, rekap, tutup. */
export function AsistenSessionPanel({ sesi }: { sesi: Sesi }) {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { presensi, praktikanList, bukaSesi, tutupSesi } = usePrakti();
  const toast = useToast();
  const [sheetVisible, setSheetVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);

  const hadir = presensiSesi(presensi, sesi.id).length;
  const total = praktikanList.length;
  const bukaRekap = () => navigation.navigate('Recap', { sesiId: sesi.id });

  if (sesi.status === 'belum_dibuka') {
    return (
      <View>
        <Text style={styles.note}>Sesi belum dibuka. Praktikan baru bisa presensi setelah kamu membukanya.</Text>
        <Button label="Buka Sesi" icon="lock-open-outline" onPress={() => setSheetVisible(true)} />
        <OpenSessionSheet
          visible={sheetVisible}
          sesi={sesi}
          onClose={() => setSheetVisible(false)}
          onConfirm={(topik) => {
            bukaSesi(sesi.id, topik);
            setSheetVisible(false);
            toast.show('Sesi dibuka', 'success');
          }}
        />
      </View>
    );
  }

  if (sesi.status === 'dibuka') {
    return (
      <View>
        <View style={styles.codeBox}>
          <Text style={styles.codeLabel}>Kode sesi</Text>
          <Text style={styles.code} accessibilityLabel={`Kode sesi ${sesi.kode ?? ''}`}>
            {sesi.kode ?? '----'}
          </Text>
        </View>
        {sesi.topik ? <Text style={styles.topic}>Topik: {sesi.topik}</Text> : null}
        <View style={styles.counterRow}>
          <Text style={styles.counter}>
            {hadir}/{total} hadir
          </Text>
          <Text style={styles.percent}>{Math.round((hadir / total) * 100)}%</Text>
        </View>
        <ProgressBar value={total === 0 ? 0 : hadir / total} />
        <View style={styles.actions}>
          <Button label="Lihat Rekap" variant="outline" onPress={bukaRekap} style={styles.action} />
          <Button
            label="Tutup Sesi"
            variant="danger"
            onPress={() => setConfirmVisible(true)}
            style={styles.action}
          />
        </View>
        <ConfirmModal
          visible={confirmVisible}
          title="Tutup sesi ini?"
          message={`Sesi ditutup dengan ${hadir} dari ${total} praktikan hadir. Sesi yang sudah ditutup tidak bisa dibuka lagi.`}
          confirmLabel="Tutup Sesi"
          tone="danger"
          onCancel={() => setConfirmVisible(false)}
          onConfirm={() => {
            tutupSesi(sesi.id);
            setConfirmVisible(false);
            toast.show('Sesi ditutup', 'success');
          }}
        />
      </View>
    );
  }

  return (
    <View>
      <Text style={styles.note}>
        Sesi sudah ditutup. {hadir} dari {total} praktikan hadir.
      </Text>
      <Button label="Lihat Rekap" variant="outline" onPress={bukaRekap} />
    </View>
  );
}

const styles = StyleSheet.create({
  note: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.md },
  codeBox: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  codeLabel: { ...typography.caption, color: colors.textSecondary },
  code: { fontSize: 36, fontWeight: '800', letterSpacing: 10, color: colors.navy },
  topic: { ...typography.body, color: colors.textPrimary, marginTop: spacing.md },
  counterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  counter: { ...typography.bodyBold, color: colors.textPrimary },
  percent: { ...typography.bodyBold, color: colors.successText },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  action: { flex: 1 },
});
