import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useSession } from '@/context/SessionContext';
import { colors, spacing } from '@/theme/tokens';

export default function Index() {
  const { isLoading, onboardingComplete, user } = useSession();

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.loadingText}>Opening the world…</Text>
      </View>
    );
  }

  if (!user) return <Redirect href="/auth" />;
  return <Redirect href={onboardingComplete ? '/(tabs)/quick-chat' : '/onboarding'} />;
}

const styles = StyleSheet.create({
  loading: { alignItems: 'center', backgroundColor: colors.background, flex: 1, gap: spacing.lg, justifyContent: 'center' },
  loadingText: { color: colors.textMuted, fontSize: 14, fontWeight: '700' },
});
