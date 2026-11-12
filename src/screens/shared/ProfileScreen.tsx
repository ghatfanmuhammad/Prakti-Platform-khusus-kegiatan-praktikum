import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { AppHeader } from '../../components/AppHeader';
import { Button } from '../../components/Button';
import { ConfirmModal } from '../../components/ConfirmModal';
import { ProfileCard } from '../../components/ProfileCard';
import { usePrakti } from '../../context/PraktiContext';
import { colors, spacing } from '../../theme';
import { toTitleCase } from '../../utils/text';

export function ProfileScreen() {
  const { currentUser, keluar } = usePrakti();
  const [confirm, setConfirm] = useState(false);

  if (!currentUser) return null;

  const profil =
    currentUser.role === 'asisten'
      ? { nama: currentUser.asisten.nama, highlight: 'Asisten Praktikum', detail: 'Laboratorium Komputer' }
      : {
          nama: toTitleCase(currentUser.praktikan.nama),
          highlight: `NIM ${currentUser.praktikan.nim}`,
          detail: 'Praktikan',
        };

  return (
    <>
      <AppHeader subtitle="Profil" />
      <ScrollView style={styles.root} contentContainerStyle={styles.content}>
        <ProfileCard {...profil} />
        <Button label="Ganti Peran" variant="outline" icon="swap-horizontal" onPress={() => setConfirm(true)} />
      </ScrollView>
      <ConfirmModal
        visible={confirm}
        title="Ganti peran?"
        message="Kamu akan kembali ke layar pemilihan peran. Data dummy tetap tersimpan selama aplikasi terbuka."
        confirmLabel="Ganti Peran"
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          setConfirm(false);
          keluar();
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg },
});
