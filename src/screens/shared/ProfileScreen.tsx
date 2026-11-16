import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { AppHeader } from '../../components/AppHeader';
import { Button } from '../../components/Button';
import { ConfirmModal } from '../../components/ConfirmModal';
import { ProfileCard } from '../../components/ProfileCard';
import { usePrakti } from '../../context/PraktiContext';
import { logoutUser } from '../../services/authService';
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
        <Button label="Keluar" variant="outline" icon="log-out-outline" onPress={() => setConfirm(true)} />
      </ScrollView>
      <ConfirmModal
        visible={confirm}
        title="Keluar dari akun?"
        message="Kamu akan keluar dari akun dan kembali ke halaman login."
        confirmLabel="Keluar"
        onCancel={() => setConfirm(false)}
        onConfirm={async () => {
          setConfirm(false);
          try {
            // Akhiri sesi Firebase Auth (SRS-007); aman juga untuk mode demo yang tidak login Firebase
            await logoutUser();
          } catch (err) {
            console.warn('Gagal logout dari Firebase:', err);
          }
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
