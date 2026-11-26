import { Redirect, Stack, router, useLocalSearchParams } from 'expo-router';
import { View, Pressable, Text } from 'react-native';
import { usePrakti } from '../../context/PraktiContext';
import { CheckInFlowProvider } from '../../features/praktikan/CheckInFlow';
import { colors, spacing } from '../../theme';
export default function RoleLayout() {
  const { role } = useLocalSearchParams<{ role: string }>();
  const { currentUser } = usePrakti();
  if (!currentUser || currentUser.role !== role) return <Redirect href="/" />;
  return <CheckInFlowProvider><View style={{ flex: 1 }}>
    <Stack screenOptions={{ headerShown: false }} />
    <View style={{ flexDirection: 'row', justifyContent: 'space-around', padding: spacing.md, backgroundColor: colors.surface }}>
      <Pressable accessibilityRole="button" onPress={() => router.replace({ pathname: '/[role]', params: { role } })}><Text>Beranda</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/[role]/[screen]', params: { role, screen: 'profile' } })}><Text>Profil</Text></Pressable>
    </View>
  </View></CheckInFlowProvider>;
}
