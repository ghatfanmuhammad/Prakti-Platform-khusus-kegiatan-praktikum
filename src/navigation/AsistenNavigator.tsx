import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { BottomBar, type BottomBarItem } from '../components/BottomBar';
import { AsistenHomeScreen } from '../screens/asisten/AsistenHomeScreen';
import { PemeriksaanIzinScreen } from '../screens/asisten/PemeriksaanIzinScreen';
import { RecapScreen } from '../screens/asisten/RecapScreen';
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

function AsistenTabs() {
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <BottomBar {...props} items={ITEMS} />}
    >
      <Tab.Screen name="Beranda" component={AsistenHomeScreen} />
      <Tab.Screen name="Profil" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export function AsistenNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={AsistenTabs} />
      <Stack.Screen name="Schedule" component={ScheduleScreen} />
      <Stack.Screen name="SessionDetail" component={SessionDetailScreen} />
      <Stack.Screen name="Recap" component={RecapScreen} />
      <Stack.Screen name="PemeriksaanIzin" component={PemeriksaanIzinScreen} />
    </Stack.Navigator>
  );
}
