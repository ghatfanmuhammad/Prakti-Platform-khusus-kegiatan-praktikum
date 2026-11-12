import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { BottomBar, type BottomBarItem } from '../components/BottomBar';
import { CheckInFlowProvider, useCheckInFlow } from '../features/praktikan/CheckInFlow';
import { HistoryScreen } from '../screens/praktikan/HistoryScreen';
import { PraktikanHomeScreen } from '../screens/praktikan/PraktikanHomeScreen';
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

function PraktikanTabs() {
  const { mulai } = useCheckInFlow();
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <BottomBar {...props} items={ITEMS} onCenterPress={mulai} />}
    >
      <Tab.Screen name="Beranda" component={PraktikanHomeScreen} />
      <Tab.Screen name="Profil" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export function PraktikanNavigator() {
  return (
    <CheckInFlowProvider>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Tabs" component={PraktikanTabs} />
        <Stack.Screen name="Schedule" component={ScheduleScreen} />
        <Stack.Screen name="SessionDetail" component={SessionDetailScreen} />
        <Stack.Screen name="History" component={HistoryScreen} />
      </Stack.Navigator>
    </CheckInFlowProvider>
  );
}
