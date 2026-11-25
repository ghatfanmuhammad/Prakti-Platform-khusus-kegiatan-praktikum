import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ToastProvider } from './src/components/Toast';
import { PraktiProvider } from './src/context/PraktiContext';
import { NotifikasiProvider } from './src/features/notifikasi/NotifikasiContext';
import { navigationRef } from './src/navigation/navigationRef';
import { RootNavigator } from './src/navigation/RootNavigator';

export default function App() {
  return (
    <SafeAreaProvider>
      <PraktiProvider>
        <NotifikasiProvider>
          <ToastProvider>
            <NavigationContainer ref={navigationRef}>
              <StatusBar style="light" />
              <RootNavigator />
            </NavigationContainer>
          </ToastProvider>
        </NotifikasiProvider>
      </PraktiProvider>
    </SafeAreaProvider>
  );
}
