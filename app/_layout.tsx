import 'react-native-gesture-handler';

import { useEffect } from 'react';
import { Alert } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Updates from 'expo-updates';
import * as SystemUI from 'expo-system-ui';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SessionProvider } from '@/context/SessionContext';
import { colors } from '@/theme/tokens';

function UpdatePrompt() {
  const { isUpdatePending } = Updates.useUpdates();

  useEffect(() => {
    if (!isUpdatePending) return;
    Alert.alert(
      'Update ready',
      'A new test version has downloaded. Restart now to use it.',
      [
        { text: 'Later', style: 'cancel' },
        { text: 'Restart', onPress: () => void Updates.reloadAsync() },
      ],
    );
  }, [isUpdatePending]);

  return null;
}

export default function RootLayout() {
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.background);
  }, []);

  return (
    <SafeAreaProvider>
      <UpdatePrompt />
      <SessionProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ contentStyle: { backgroundColor: colors.background }, headerShown: false }} />
      </SessionProvider>
    </SafeAreaProvider>
  );
}
