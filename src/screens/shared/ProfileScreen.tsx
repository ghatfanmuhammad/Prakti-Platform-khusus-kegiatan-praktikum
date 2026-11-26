import { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { AppHeader } from '../../components/AppHeader';
import { Button } from '../../components/Button';
import { ConfirmModal } from '../../components/ConfirmModal';
import { ProfileCard } from '../../components/ProfileCard';
import { usePrakti } from '../../context/PraktiContext';
import { useNotifikasi } from '../../features/notifikasi/NotifikasiContext';
import { StatusNotifikasiCard } from '../../features/notifikasi/StatusNotifikasiCard';
import { logoutUser } from '../../services/authService';
import { colors, spacing, typography } from '../../theme';
import { toTitleCase } from '../../utils/text';

export function ProfileScreen() {
  const { currentUser, keluar, practicum } = usePrakti();
  const { lepasPerangkat } = useNotifikasi();
  const [confirm, setConfirm] = useState(false);

  if (!currentUser) return null;

  const profil =
<<<<<<< HEAD
    currentUser.role === 'aslab'
      ? { nama: currentUser.aslab.nama, highlight: 'Aslab', detail: 'Pengelola Laboratorium' }
      : currentUser.role === 'asprak'
        ? { nama: currentUser.asprak.nama, highlight: 'Asprak', detail: 'Pengampu Praktikum' }
        : currentUser.role === 'asisten'
      ? { nama: currentUser.asisten.nama, highlight: 'Asisten Praktikum', detail: 'Laboratorium Komputer' }
=======
    currentUser.role !== 'praktikan'
      ? { nama: currentUser.asisten.nama, highlight: currentUser.role === 'aslab' ? 'Aslab' : 'Asprak', detail: 'Laboratorium Komputer' }
>>>>>>> origin/main
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
        {practicum && currentUser.role === 'praktikan' ? (
          <Text selectable style={styles.uid}>UID akun untuk pendaftaran kelas: {currentUser.praktikan.id}</Text>
        ) : null}
        <StatusNotifikasiCard />
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
          // Lepas token push selagi masih login, agar perangkat tidak menerima notifikasi akun ini lagi
          await lepasPerangkat();
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
  uid: { ...typography.caption, color: colors.textSecondary },
  content: { padding: spacing.lg, gap: spacing.lg },
});
