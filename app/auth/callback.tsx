import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useSession } from '@/context/SessionContext';
import { colors, spacing } from '@/theme/tokens';

export default function AuthCallbackScreen() {
  const { isLoading, isPasswordRecovery, onboardingComplete, user } = useSession();

  if (!isLoading && user) {
    if (isPasswordRecovery) return <Redirect href="/auth/reset-password" />;
    return <Redirect href={onboardingComplete ? '/(tabs)/quick-chat' : '/onboarding'} />;
  }

  if (!isLoading && !user) return <Redirect href="/auth" />;

  return (
    <View style={styles.container}>
      <ActivityIndicator color={colors.primary} size="large" />
      <Text style={styles.text}>Confirming your account…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', backgroundColor: colors.background, flex: 1, gap: spacing.lg, justifyContent: 'center' },
  text: { color: colors.textMuted, fontSize: 14, fontWeight: '700' },
});
