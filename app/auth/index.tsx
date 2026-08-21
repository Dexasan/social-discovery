import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { BrandLockup } from '@/components/Brand';
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
  const { isConfigured, isLoading, onboardingComplete, requestPasswordReset, signIn, signUp, user } = useSession();
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
          setNotice('Check your email and tap the YAPPIE confirmation link to continue.');
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

  const sendResetLink = async () => {
    if (!email.trim().includes('@') || submitting) {
      setError('Enter your email first, then request a reset link.');
      return;
    }
    setSubmitting(true);
    setError('');
    setNotice('');
    try {
      await requestPasswordReset(email.trim().toLowerCase());
      setNotice('Password reset link sent. Open it on this Android device to choose a new password.');
    } catch (nextError) {
      setError(readableAuthError(nextError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <View style={styles.topRow}>
        <BrandLockup compact />
        <Pill label="Early access" tone="accent" />
      </View>
      <View style={styles.intro}>
        <Eyebrow>{mode === 'sign-up' ? 'Talk to strangers. Keep the good ones.' : 'Your conversations missed you'}</Eyebrow>
        <Heading>{mode === 'sign-up' ? 'One hello can change your whole night.' : 'Get back to your people.'}</Heading>
        <Muted>Random chats, public thoughts, and live rooms. No swiping. No awkward matching games. Just start talking.</Muted>
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
        {mode === 'sign-in' ? (
          <Pressable accessibilityRole="button" onPress={() => void sendResetLink()} style={styles.forgotButton}>
            <Text style={styles.forgotLabel}>Forgot password?</Text>
          </Pressable>
        ) : null}

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
      <View style={styles.policyBlock}>
        <Text style={styles.privacy}>By continuing, you agree to our policies. Age eligibility is verified during profile setup.</Text>
        <View style={styles.policyLinks}>
          <Pressable onPress={() => router.push({ pathname: '/legal/[document]', params: { document: 'terms' } })}><Text style={styles.policyLink}>Terms</Text></Pressable>
          <Text style={styles.policyDot}>·</Text>
          <Pressable onPress={() => router.push({ pathname: '/legal/[document]', params: { document: 'privacy' } })}><Text style={styles.policyLink}>Privacy</Text></Pressable>
          <Text style={styles.policyDot}>·</Text>
          <Pressable onPress={() => router.push({ pathname: '/legal/[document]', params: { document: 'community-guidelines' } })}><Text style={styles.policyLink}>Guidelines</Text></Pressable>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  intro: { gap: spacing.md, marginTop: spacing.xxl },
  promiseRow: { alignItems: 'center', backgroundColor: '#FFF0EB', borderColor: '#FFD2C8', borderRadius: radius.xl, borderWidth: 1, flexDirection: 'row', marginVertical: spacing.xl, paddingVertical: spacing.lg },
  promise: { alignItems: 'center', flex: 1, gap: 2 },
  promiseValue: { color: colors.text, fontSize: 13, fontWeight: '900' },
  promiseLabel: { color: colors.textSubtle, fontSize: 9.5, fontWeight: '700' },
  promiseDivider: { backgroundColor: colors.border, height: 26, width: 1 },
  form: { backgroundColor: colors.surface, gap: spacing.md },
  label: { color: colors.textMuted, fontSize: 12, fontWeight: '800', marginTop: spacing.xs },
  input: { backgroundColor: colors.surfaceSoft, borderColor: colors.borderStrong, borderRadius: radius.lg, borderWidth: 1, color: colors.text, fontSize: 16, minHeight: 56, paddingHorizontal: spacing.lg },
  error: { color: colors.danger, fontSize: 13, lineHeight: 19 },
  notice: { backgroundColor: colors.successSoft, borderRadius: radius.sm, color: colors.success, fontSize: 13, lineHeight: 19, padding: spacing.md },
  forgotButton: { alignSelf: 'flex-end', marginTop: -spacing.xs, paddingVertical: spacing.xs },
  forgotLabel: { color: colors.primaryPressed, fontSize: 12, fontWeight: '900' },
  switchButton: { alignItems: 'center', flexDirection: 'row', justifyContent: 'center', marginTop: spacing.xl },
  switchMuted: { color: colors.textMuted, fontSize: 14 },
  switchAction: { color: colors.primaryPressed, fontSize: 14, fontWeight: '900' },
  policyBlock: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.xl },
  privacy: { color: colors.textSubtle, fontSize: 10.5, lineHeight: 16, textAlign: 'center' },
  policyLinks: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  policyLink: { color: colors.primaryPressed, fontSize: 11, fontWeight: '900' },
  policyDot: { color: colors.textSubtle, fontSize: 11 },
});
