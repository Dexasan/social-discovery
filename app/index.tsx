import { Text } from '@/components/Typography';
import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { BrandLockup } from '@/components/Brand';
import { useSession } from '@/context/SessionContext';
import { colors, spacing } from '@/theme/tokens';

export default function Index() {
  const { isLoading, onboardingComplete, user } = useSession();

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <BrandLockup />
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.loadingText}>Warming up the conversation…</Text>
      </View>
    );
  }

  if (!user) return <Redirect href="/auth" />;
  return <Redirect href={onboardingComplete ? '/(tabs)/quick-chat' : '/onboarding'} />;
}

const styles = StyleSheet.create({
  loading: { alignItems: 'center', backgroundColor: colors.background, flex: 1, gap: spacing.xl, justifyContent: 'center' },
  loadingText: { color: colors.textMuted, fontSize: 14, fontWeight: '700' },
});
