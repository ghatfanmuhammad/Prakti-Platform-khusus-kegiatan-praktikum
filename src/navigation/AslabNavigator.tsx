import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { BottomBar, type BottomBarItem } from '../components/BottomBar';
import { AslabHomeScreen } from '../screens/aslab/AslabHomeScreen';
import { ImporAsprakScreen } from '../screens/aslab/ImporAsprakScreen';
import { ImporLabScreen } from '../screens/aslab/ImporLabScreen';
import { ImporPraktikanScreen } from '../screens/aslab/ImporPraktikanScreen';
import { KelolaLabScreen } from '../screens/aslab/KelolaLabScreen';
import { MapsScreen } from '../screens/shared/MapsScreen';
import { ProfileScreen } from '../screens/shared/ProfileScreen';
import { ScheduleScreen } from '../screens/shared/ScheduleScreen';
import { SessionDetailScreen } from '../screens/shared/SessionDetailScreen';
import type { AppStackParamList, TabParamList } from './types';

const Stack = createNativeStackNavigator<AppStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const ITEMS: Record<string, BottomBarItem> = {
  Beranda: { label: 'Beranda', icon: 'home-outline', iconActive: 'home' },
  Profil: { label: 'Profil', icon: 'person-outline', iconActive: 'person' },
};

function AslabTabs() {
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <BottomBar {...props} items={ITEMS} />}
    >
      <Tab.Screen name="Beranda" component={AslabHomeScreen} />
      <Tab.Screen name="Profil" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

/** Navigator khusus peran Aslab (SRS-020..023). */
export function AslabNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={AslabTabs} />
      <Stack.Screen name="KelolaLab" component={KelolaLabScreen} />
      <Stack.Screen name="ImporLab" component={ImporLabScreen} />
      <Stack.Screen name="ImporPraktikan" component={ImporPraktikanScreen} />
      <Stack.Screen name="ImporAsprak" component={ImporAsprakScreen} />
      <Stack.Screen name="Schedule" component={ScheduleScreen} />
      <Stack.Screen name="SessionDetail" component={SessionDetailScreen} />
      <Stack.Screen name="Maps" component={MapsScreen} />
    </Stack.Navigator>
  );
}
