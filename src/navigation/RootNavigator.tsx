import { useState } from 'react';

import { usePrakti } from '../context/PraktiContext';
import { AuthScreen } from '../screens/auth/AuthScreen';
import { RoleSelectScreen } from '../screens/RoleSelectScreen';
import { AsistenNavigator } from './AsistenNavigator';
import { PraktikanNavigator } from './PraktikanNavigator';

/**
 * Navigator dipilih menurut peran aktif. Karena yang dirender berbeda,
 * mengganti peran otomatis mereset seluruh tumpukan navigasi.
 */
export function RootNavigator() {
  const { currentUser } = usePrakti();
  // Mode autentikasi: 'firebase' (SRS-007) atau 'demo' (SRS-001)
  const [authView, setAuthView] = useState<'firebase' | 'demo'>('firebase');

  if (!currentUser) {
    if (authView === 'demo') {
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
