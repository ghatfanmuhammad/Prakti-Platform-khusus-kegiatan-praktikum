import { Redirect, useLocalSearchParams } from 'expo-router';
import { usePrakti } from '../context/PraktiContext';
import { canOpenRoute } from '../features/auth/roles';
import { AslabHomeScreen } from '../screens/aslab/AslabHomeScreen';
import { AsistenHomeScreen } from '../screens/asisten/AsistenHomeScreen';
import { PemeriksaanIzinScreen } from '../screens/asisten/PemeriksaanIzinScreen';
import { RecapScreen } from '../screens/asisten/RecapScreen';
import { PraktikanHomeScreen } from '../screens/praktikan/PraktikanHomeScreen';
import { PresensiScreen } from '../screens/praktikan/PresensiScreen';
import { HistoryScreen } from '../screens/praktikan/HistoryScreen';
import { StatusIzinScreen } from '../screens/praktikan/StatusIzinScreen';
import { AjukanIzinScreen } from '../screens/praktikan/AjukanIzinScreen';
import { MapsScreen } from '../screens/shared/MapsScreen';
import { ProfileScreen } from '../screens/shared/ProfileScreen';
import { ScheduleScreen } from '../screens/shared/ScheduleScreen';
import { SessionDetailScreen } from '../screens/shared/SessionDetailScreen';
import { DataPraktikumScreen } from '../features/data-praktikum/DataPraktikumScreen';
import { useAppNavigation } from './useAppNavigation';

export function RoleScreen({ home = false }: { home?: boolean }) {
  const { role, screen: parameter, sesiId } = useLocalSearchParams<{ role: string; screen?: string; sesiId?: string }>();
  const { currentUser } = usePrakti();
  const navigation = useAppNavigation();
  const screen = home ? 'index' : parameter ?? 'index';
  if (!currentUser || role !== currentUser.role || !canOpenRoute(currentUser.role, screen)) return <Redirect href="/" />;
  switch (screen) {
    case 'index': return currentUser.role === 'aslab' ? <AslabHomeScreen /> : currentUser.role === 'asprak'
      ? <AsistenHomeScreen navigation={navigation} route={{ params: undefined }} /> : <PraktikanHomeScreen navigation={navigation} route={{ params: undefined }} />;
    case 'profile': return <ProfileScreen />;
    case 'data': return <DataPraktikumScreen onBack={navigation.goBack} />;
    case 'jadwal': return <ScheduleScreen navigation={navigation} route={{ params: undefined }} />;
    case 'sesi': return <SessionDetailScreen navigation={navigation} route={{ params: { sesiId: sesiId ?? '' } }} />;
    case 'rekap': return <RecapScreen navigation={navigation} route={{ params: { sesiId } }} />;
    case 'izin': return <PemeriksaanIzinScreen navigation={navigation} />;
    case 'maps': return <MapsScreen navigation={navigation} />;
    case 'presensi': return <PresensiScreen navigation={navigation} route={{ params: { sesiId: sesiId ?? '' } }} />;
    case 'riwayat': return <HistoryScreen navigation={navigation} route={{ params: undefined }} />;
    case 'status-izin': return <StatusIzinScreen navigation={navigation} route={{ params: undefined }} />;
    case 'ajukan-izin': return <AjukanIzinScreen navigation={navigation} route={{ params: undefined }} />;
    default: return <Redirect href="/" />;
  }
}
