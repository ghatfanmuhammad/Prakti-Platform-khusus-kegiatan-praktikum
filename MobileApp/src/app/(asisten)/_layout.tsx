import { Tabs } from 'expo-router';

import { LogoutButton } from '@/components/logout-button';
import { palette } from '@/constants/palette';

export default function AsistenLayout() {
  return (
    <Tabs
      screenOptions={{
        headerRight: () => <LogoutButton />,
        headerTitleStyle: { color: palette.ink, fontWeight: '700' },
        tabBarActiveTintColor: palette.teal,
        tabBarInactiveTintColor: palette.muted,
        tabBarLabelStyle: { fontSize: 14, fontWeight: '600' },
        tabBarIcon: () => null,
        tabBarIconStyle: { display: 'none' },
      }}>
      <Tabs.Screen name="jadwal" options={{ title: 'Jadwal' }} />
      <Tabs.Screen name="rekap" options={{ title: 'Rekap' }} />
    </Tabs>
  );
}
