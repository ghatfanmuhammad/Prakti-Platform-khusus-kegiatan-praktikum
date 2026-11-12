import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput } from 'react-native';

import { BottomSheet } from '../../components/BottomSheet';
import { Button } from '../../components/Button';
import { InfoRow } from '../../components/InfoRow';
import { colors, radius, spacing, typography } from '../../theme';
import type { Sesi } from '../../types';
import { formatTanggal } from '../../utils/date';

interface Props {
  visible: boolean;
  sesi: Sesi;
  onClose: () => void;
  onConfirm: (topik: string | null) => void;
}

export function OpenSessionSheet({ visible, sesi, onClose, onConfirm }: Props) {
  const [topik, setTopik] = useState('');

  useEffect(() => {
    if (!visible) setTopik('');
  }, [visible]);

  return (
    <BottomSheet visible={visible} title="Buka sesi praktikum" onClose={onClose}>
      <Text style={styles.title}>
        {sesi.praktikum} · Kelas {sesi.kelas}
      </Text>
      <InfoRow
        icon="calendar-outline"
        text={`${formatTanggal(sesi.tanggal)} · ${sesi.mulai} - ${sesi.selesai} · ${sesi.ruang}`}
      />
      <Text style={styles.label}>Topik pertemuan (opsional)</Text>
      <TextInput
        value={topik}
        onChangeText={setTopik}
        placeholder="Contoh: Navigasi antar layar"
        placeholderTextColor={colors.textSecondary}
        maxLength={80}
        style={styles.input}
      />
      <Text style={styles.hint}>
        Kode 4 angka dibuat otomatis. Bagikan kode ke praktikan setelah sesi dibuka.
      </Text>
      <Button
        label="Buka Sesi"
        icon="lock-open-outline"
        onPress={() => onConfirm(topik.trim() || null)}
        style={styles.button}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.subtitle, color: colors.textPrimary, marginBottom: spacing.xs },
  label: { ...typography.bodyBold, color: colors.textPrimary, marginTop: spacing.lg },
  input: {
    minHeight: 48,
    marginTop: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.divider,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.background,
    color: colors.textPrimary,
    fontSize: 15,
  },
  hint: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.sm },
  button: { marginTop: spacing.xl },
});
