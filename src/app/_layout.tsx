import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PraktiProvider, usePrakti } from '../context/PraktiContext';
import { ToastProvider } from '../components/Toast';
import { NotifikasiProvider } from '../features/notifikasi/NotifikasiContext';
import { useAuthSession } from '../features/auth/useAuthSession';

function Routes() {
  const ready = useAuthSession();
  const { currentUser } = usePrakti();
  if (!ready) return <ActivityIndicator />;
  return <Stack screenOptions={{ headerShown: false }}>
    <Stack.Screen name="index" />
    <Stack.Protected guard={!currentUser}><Stack.Screen name="login" /></Stack.Protected>
    <Stack.Protected guard={!!currentUser}><Stack.Screen name="[role]" /></Stack.Protected>
  </Stack>;
}
export default function RootLayout() {
  return <SafeAreaProvider><PraktiProvider><NotifikasiProvider><ToastProvider>
    <StatusBar style="light" /><Routes />
  </ToastProvider></NotifikasiProvider></PraktiProvider></SafeAreaProvider>;
}
