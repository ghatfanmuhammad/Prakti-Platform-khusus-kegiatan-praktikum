import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { usePrakti } from '../context/PraktiContext';
import { AuthScreen } from '../screens/auth/AuthScreen';
import { RoleSelectScreen } from '../screens/RoleSelectScreen';
import { getUserProfile, subscribeAuth, toCurrentUser } from '../services/authService';
import { colors } from '../theme';
import { AsistenNavigator } from './AsistenNavigator';
import { PraktikanNavigator } from './PraktikanNavigator';

/**
 * Navigator dipilih menurut peran aktif. Karena yang dirender berbeda,
 * mengganti peran otomatis mereset seluruh tumpukan navigasi.
 */
export function RootNavigator() {
  const { currentUser, masuk } = usePrakti();
  // Mode autentikasi: 'firebase' (SRS-007) atau 'demo' (SRS-001, hanya development)
  const [authView, setAuthView] = useState<'firebase' | 'demo'>('firebase');
  // true setelah status sesi Firebase tersimpan selesai dicek saat aplikasi dibuka
  const [authReady, setAuthReady] = useState(false);

  // Pulihkan sesi login Firebase (tersimpan di AsyncStorage) saat aplikasi dibuka ulang (SRS-007)
  useEffect(() => {
    const unsubscribe = subscribeAuth(async (user) => {
      if (user) {
        try {
          const profile = await getUserProfile(user.uid);
          // Profil bisa belum ada saat registrasi masih berjalan; AuthScreen yang akan memanggil masuk()
          if (profile) masuk(toCurrentUser(profile));
        } catch (err) {
          console.warn('Gagal memulihkan sesi login:', err);
        }
      }
      setAuthReady(true);
    });
    return unsubscribe;
  }, [masuk]);

  if (!currentUser) {
    if (!authReady) {
      return (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.navy} />
        </View>
      );
    }
    if (__DEV__ && authView === 'demo') {
      return (
        <RoleSelectScreen
          onSwitchToFirebase={() => setAuthView('firebase')}
        />
      );
    }
    return (
      <AuthScreen
        onBypassDemo={() => setAuthView('demo')}
      />
    );
  }

  return currentUser.role === 'asisten' ? <AsistenNavigator /> : <PraktikanNavigator />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
