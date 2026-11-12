import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '../../components/Button';
import { useCurrentPraktikan, usePrakti } from '../../context/PraktiContext';
import { colors, radius, spacing, typography } from '../../theme';
import type { Sesi } from '../../types';
import { formatJam } from '../../utils/date';
import { cariPresensi } from '../../utils/selectors';
import { useCheckInFlow } from './CheckInFlow';

/** Tombol presensi atau keterangan status untuk satu sesi, dari sisi praktikan. */
export function PraktikanSessionPanel({ sesi }: { sesi: Sesi }) {
  const praktikan = useCurrentPraktikan();
  const { presensi } = usePrakti();
  const { mulaiUntuk } = useCheckInFlow();

  const catatan = praktikan ? cariPresensi(presensi, sesi.id, praktikan.id) : undefined;

  if (catatan) {
    return (
      <View style={[styles.box, styles.success]}>
        <Ionicons name="checkmark-circle" size={20} color={colors.successText} />
        <Text style={[styles.boxText, { color: colors.successText }]}>
          Sudah presensi pukul {formatJam(catatan.waktuHadir)}
        </Text>
      </View>
    );
  }

  if (sesi.status === 'dibuka') {
    return <Button label="Presensi Sekarang" icon="qr-code-outline" onPress={() => mulaiUntuk(sesi.id)} />;
  }

  if (sesi.status === 'belum_dibuka') {
    return (
      <View>
        <Button label="Presensi Sekarang" icon="qr-code-outline" disabled onPress={() => undefined} />
        <Text style={styles.caption}>Sesi belum dibuka oleh asisten</Text>
      </View>
    );
  }

  return (
    <View style={[styles.box, styles.danger]}>
      <Ionicons name="close-circle" size={20} color={colors.danger} />
      <Text style={[styles.boxText, { color: colors.danger }]}>Sesi ditutup, kamu tidak hadir</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  success: { backgroundColor: colors.successBg, borderColor: colors.successBorder },
  danger: { backgroundColor: colors.dangerBg, borderColor: colors.dangerBorder },
  boxText: { ...typography.bodyBold, flex: 1 },
  caption: { ...typography.caption, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm },
});
