import { Redirect } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Card, Eyebrow, Heading, Muted, Pill, PrimaryButton, Screen } from '@/components/ui';
import { useSession } from '@/context/SessionContext';
import { colors, radius, spacing } from '@/theme/tokens';

type AuthMode = 'sign-in' | 'sign-up';

function readableAuthError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Something went wrong. Please try again.';
  if (message.toLowerCase().includes('invalid login')) return 'The email or password is incorrect.';
  if (message.toLowerCase().includes('already registered')) return 'An account already exists for this email.';
  if (message.toLowerCase().includes('rate limit')) return 'Too many attempts. Wait a moment and try again.';
  return message;
}

export default function AuthScreen() {
  const { isConfigured, isLoading, onboardingComplete, signIn, signUp, user } = useSession();
  const [mode, setMode] = useState<AuthMode>('sign-up');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  if (!isLoading && user) {
    return <Redirect href={onboardingComplete ? '/(tabs)/quick-chat' : '/onboarding'} />;
  }

  const canSubmit = isConfigured && email.trim().includes('@') && password.length >= 8 && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError('');
    setNotice('');

    try {
      if (mode === 'sign-in') {
        await signIn(email.trim().toLowerCase(), password);
      } else {
        const result = await signUp(email.trim().toLowerCase(), password);
        if (result.needsEmailConfirmation) {
          setNotice('Check your email and tap the confirmation link to continue.');
        }
      }
    } catch (nextError) {
      setError(readableAuthError(nextError));
    } finally {
      setSubmitting(false);
    }
  };

  const switchMode = () => {
    setMode((current) => (current === 'sign-up' ? 'sign-in' : 'sign-up'));
    setError('');
    setNotice('');
  };

  return (
    <Screen>
      <View style={styles.topRow}>
        <View style={styles.wordmark}><View style={styles.logoMark}><View style={styles.logoCore} /></View><Text style={styles.wordmarkText}>SOCIAL / WORLD</Text></View>
        <Pill label="Private beta" tone="accent" />
      </View>
      <View style={styles.intro}>
        <Eyebrow>{mode === 'sign-up' ? 'Your world gets bigger here' : 'Good to see you again'}</Eyebrow>
        <Heading>{mode === 'sign-up' ? 'Talk first. Discover the person.' : 'Jump back into the conversation.'}</Heading>
        <Muted>Quick chats, public thoughts and live rooms—all built around people, not swipes.</Muted>
      </View>

      <View style={styles.promiseRow}>
        <View style={styles.promise}><Text style={styles.promiseValue}>∞</Text><Text style={styles.promiseLabel}>No limits</Text></View>
        <View style={styles.promiseDivider} />
        <View style={styles.promise}><Text style={styles.promiseValue}>1 tap</Text><Text style={styles.promiseLabel}>Meet someone</Text></View>
        <View style={styles.promiseDivider} />
        <View style={styles.promise}><Text style={styles.promiseValue}>Global</Text><Text style={styles.promiseLabel}>By default</Text></View>
      </View>

      <Card style={styles.form}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          accessibilityLabel="Email"
          autoCapitalize="none"
          autoComplete="email"
          inputMode="email"
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          value={email}
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          accessibilityLabel="Password"
          autoCapitalize="none"
          autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
          onChangeText={setPassword}
          placeholder="At least 8 characters"
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          style={styles.input}
          value={password}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
        {!isConfigured ? <Text style={styles.error}>Backend configuration is missing.</Text> : null}

        <PrimaryButton
          disabled={!canSubmit}
          label={submitting ? 'Please wait…' : mode === 'sign-up' ? 'Create account' : 'Sign in'}
          onPress={submit}
        />
      </Card>

      <Pressable accessibilityRole="button" onPress={switchMode} style={styles.switchButton}>
        <Text style={styles.switchMuted}>{mode === 'sign-up' ? 'Already have an account?' : 'New here?'}</Text>
        <Text style={styles.switchAction}>{mode === 'sign-up' ? ' Sign in' : ' Create account'}</Text>
      </Pressable>
      <Text style={styles.privacy}>By continuing, you agree to the Terms and acknowledge the Privacy Policy. Age eligibility is verified during profile setup.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  wordmark: { alignItems: 'center', flexDirection: 'row', gap: 9 },
  logoMark: { alignItems: 'center', borderColor: colors.primary, borderRadius: 11, borderWidth: 2, height: 22, justifyContent: 'center', transform: [{ rotate: '-12deg' }], width: 22 },
  logoCore: { backgroundColor: colors.accent, borderRadius: 3, height: 6, width: 6 },
  wordmarkText: { color: colors.text, fontSize: 10, fontWeight: '900', letterSpacing: 1.3 },
  intro: { gap: spacing.md, marginTop: spacing.hero },
  promiseRow: { alignItems: 'center', backgroundColor: colors.surfaceSoft, borderColor: colors.border, borderRadius: radius.lg, borderWidth: 1, flexDirection: 'row', marginVertical: spacing.xl, paddingVertical: spacing.md },
  promise: { alignItems: 'center', flex: 1, gap: 2 },
  promiseValue: { color: colors.text, fontSize: 13, fontWeight: '900' },
  promiseLabel: { color: colors.textSubtle, fontSize: 9.5, fontWeight: '700' },
  promiseDivider: { backgroundColor: colors.border, height: 26, width: 1 },
  form: { backgroundColor: colors.surfaceSoft, gap: spacing.md },
  label: { color: colors.textMuted, fontSize: 12, fontWeight: '800', marginTop: spacing.xs },
  input: { backgroundColor: colors.surfaceRaised, borderColor: colors.borderStrong, borderRadius: radius.md, borderWidth: 1, color: colors.text, fontSize: 16, minHeight: 54, paddingHorizontal: spacing.lg },
  error: { color: colors.danger, fontSize: 13, lineHeight: 19 },
  notice: { backgroundColor: colors.successSoft, borderRadius: radius.sm, color: colors.success, fontSize: 13, lineHeight: 19, padding: spacing.md },
  switchButton: { alignItems: 'center', flexDirection: 'row', justifyContent: 'center', marginTop: spacing.xl },
  switchMuted: { color: colors.textMuted, fontSize: 14 },
  switchAction: { color: colors.primary, fontSize: 14, fontWeight: '800' },
  privacy: { color: colors.textSubtle, fontSize: 10.5, lineHeight: 16, marginTop: spacing.xl, textAlign: 'center' },
});
