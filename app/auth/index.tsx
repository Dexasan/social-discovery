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
        <Pill label="Android private beta" tone="accent" />
        <Text style={styles.mark}>◎</Text>
      </View>
      <View style={styles.intro}>
        <Eyebrow>{mode === 'sign-up' ? 'Join the conversation' : 'Welcome back'}</Eyebrow>
        <Heading>{mode === 'sign-up' ? 'Meet people beyond your usual circle.' : 'Your world is waiting.'}</Heading>
        <Muted>Authenticated accounts keep conversations personal and make safety controls enforceable.</Muted>
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
  mark: { color: colors.primary, fontSize: 32 },
  intro: { gap: spacing.md, marginBottom: spacing.xl, marginTop: spacing.xxl },
  form: { gap: spacing.md },
  label: { color: colors.text, fontSize: 13, fontWeight: '700', marginTop: spacing.xs },
  input: { backgroundColor: colors.background, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, color: colors.text, fontSize: 16, minHeight: 54, paddingHorizontal: spacing.lg },
  error: { color: colors.danger, fontSize: 13, lineHeight: 19 },
  notice: { backgroundColor: '#18392D', borderRadius: radius.sm, color: colors.primary, fontSize: 13, lineHeight: 19, padding: spacing.md },
  switchButton: { alignItems: 'center', flexDirection: 'row', justifyContent: 'center', marginTop: spacing.xl },
  switchMuted: { color: colors.textMuted, fontSize: 14 },
  switchAction: { color: colors.primary, fontSize: 14, fontWeight: '800' },
  privacy: { color: colors.textMuted, fontSize: 11, lineHeight: 17, marginTop: spacing.xl, textAlign: 'center' },
});

