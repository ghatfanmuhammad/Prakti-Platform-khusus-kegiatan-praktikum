import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';

import { AppProvider, useApp } from '@/context/app-context';

function RootNavigator() {
  const { pengguna } = useApp();
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!pengguna}>
        <Stack.Screen name="index" />
      </Stack.Protected>
      <Stack.Protected guard={pengguna?.peran === 'asisten'}>
        <Stack.Screen name="(asisten)" />
      </Stack.Protected>
      <Stack.Protected guard={pengguna?.peran === 'praktikan'}>
        <Stack.Screen name="(praktikan)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider value={DefaultTheme}>
      <AppProvider>
        <RootNavigator />
      </AppProvider>
    </ThemeProvider>
  );
}
