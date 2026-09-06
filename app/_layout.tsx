import 'react-native-gesture-handler';

import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SessionProvider } from '@/context/SessionContext';
import { CallProvider } from '@/context/CallContext';
import { colors } from '@/theme/tokens';

export default function RootLayout() {
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.background);
  }, []);

  return (
    <SafeAreaProvider>
      <SessionProvider>
        <CallProvider>
          <StatusBar style="light" />
          <Stack screenOptions={{ contentStyle: { backgroundColor: colors.background }, headerShown: false }} />
        </CallProvider>
      </SessionProvider>
    </SafeAreaProvider>
  );
}
