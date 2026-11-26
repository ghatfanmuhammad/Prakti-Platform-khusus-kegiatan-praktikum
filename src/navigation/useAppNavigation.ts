import { router } from 'expo-router';
import { useMemo } from 'react';
import { usePrakti } from '../context/PraktiContext';
import { canOpenRoute } from '../features/auth/roles';
import type { AppNavigation, AppStackParamList } from './types';

const routes: Record<keyof AppStackParamList, string> = {
  Tabs: 'index', Schedule: 'jadwal', SessionDetail: 'sesi', Recap: 'rekap', PemeriksaanIzin: 'izin',
  Maps: 'maps', KelolaLab: 'kelola-lab', Presensi: 'presensi', History: 'riwayat', StatusIzin: 'status-izin', AjukanIzin: 'ajukan-izin',
};
export function useAppNavigation(): AppNavigation {
  const { currentUser } = usePrakti();
  return useMemo(() => {
    const navigate: AppNavigation['navigate'] = (name, params) => {
      if (!currentUser) return;
      const screen = name === 'Tabs' && params && 'screen' in params && params.screen === 'Profil' ? 'profile' : routes[name];
      if (!canOpenRoute(currentUser.role, screen)) return;
      const sesiId = params && 'sesiId' in params ? params.sesiId : undefined;
      router.push({ pathname: '/[role]/[screen]', params: { role: currentUser.role, screen, ...(sesiId ? { sesiId } : {}) } });
    };
    return { navigate, popTo: navigate, goBack: () => { if (router.canGoBack()) router.back(); else router.replace('/'); } };
  }, [currentUser]);
}
