import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Avatar, Card, Eyebrow, Heading, Muted, PrimaryButton, Screen } from '@/components/ui';
import { useSession } from '@/context/SessionContext';
import { updateOwnProfile } from '@/features/social/api';
import { colors, radius, spacing } from '@/theme/tokens';

const languageOptions = ['English', 'Spanish', 'German', 'Italian', 'French', 'Portuguese', 'Hindi', 'Arabic', 'Nepali', 'Japanese'];

function readableProfileError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Your profile could not be updated.';
  if (message.toLowerCase().includes('duplicate') || message.toLowerCase().includes('unique')) {
    return 'That username is already taken. Try another one.';
  }
  return message;
}

export default function EditProfileScreen() {
  const { profile, refreshProfile, user } = useSession();
  const [displayName, setDisplayName] = useState(profile?.displayName ?? '');
  const [handle, setHandle] = useState(profile?.handle ?? '');
  const [countryCode, setCountryCode] = useState(profile?.country === 'Worldwide' ? '' : profile?.country ?? '');
  const [languages, setLanguages] = useState(profile?.languages.length ? profile.languages : ['English']);
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const normalizedHandle = useMemo(
    () => handle.trim().toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 24),
    [handle],
  );
  const normalizedCountryCode = countryCode.trim().toUpperCase();
  const canSave = Boolean(
    user &&
    displayName.trim().length >= 2 &&
    displayName.trim().length <= 50 &&
    normalizedHandle.length >= 3 &&
    languages.length > 0 &&
    (normalizedCountryCode.length === 0 || /^[A-Z]{2}$/.test(normalizedCountryCode)) &&
    bio.trim().length <= 240 &&
    !submitting
  );

  const save = async () => {
    if (!user || !canSave) return;
    setSubmitting(true);
    setError('');

    try {
      await updateOwnProfile(user.id, {
        bio: bio.trim(),
        countryCode: normalizedCountryCode || null,
        displayName: displayName.trim(),
        handle: normalizedHandle,
        languages,
      });
      await refreshProfile();
      router.back();
    } catch (nextError) {
      setError(readableProfileError(nextError));
    } finally {
      setSubmitting(false);
    }
  };

  if (!profile) return null;

  return (
    <Screen>
      <View style={styles.topRow}>
        <Pressable accessibilityLabel="Go back" accessibilityRole="button" hitSlop={10} onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backGlyph}>‹</Text>
        </Pressable>
        <Text style={styles.topTitle}>Profile</Text>
        <View style={styles.topSpacer} />
      </View>

      <View style={styles.intro}>
        <Eyebrow>Make it yours</Eyebrow>
        <Heading compact>Show up like a real person.</Heading>
        <Muted>A little context makes it much easier for someone to say hello.</Muted>
      </View>

      <View style={styles.avatarPreview}>
        <Avatar label={displayName.trim() || profile.displayName} size={88} />
        <View style={styles.avatarCopy}>
          <Text style={styles.previewName}>{displayName.trim() || 'Your name'}</Text>
          <Text style={styles.previewHandle}>@{normalizedHandle || 'username'}</Text>
          <Muted>Your initials update automatically.</Muted>
        </View>
      </View>

      <Card style={styles.form}>
        <Text style={styles.label}>Display name</Text>
        <TextInput
          accessibilityLabel="Display name"
          autoCapitalize="words"
          maxLength={50}
          onChangeText={setDisplayName}
          placeholder="Alex"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          value={displayName}
        />

        <Text style={styles.label}>Username</Text>
        <View style={styles.handleRow}>
          <Text style={styles.at}>@</Text>
          <TextInput
            accessibilityLabel="Username"
            autoCapitalize="none"
            maxLength={24}
            onChangeText={setHandle}
            placeholder="alexaroundtheworld"
            placeholderTextColor={colors.textMuted}
            style={styles.handleInput}
            value={handle}
          />
        </View>

        <Text style={styles.label}>Bio</Text>
        <TextInput
          accessibilityLabel="Bio"
          maxLength={240}
          multiline
          onChangeText={setBio}
          placeholder="What are you curious about?"
          placeholderTextColor={colors.textMuted}
          style={[styles.input, styles.bioInput]}
          textAlignVertical="top"
          value={bio}
        />
        <Text style={styles.characterCount}>{bio.length}/240</Text>

        <Text style={styles.label}>Country</Text>
        <TextInput
          accessibilityLabel="Optional two-letter country code"
          autoCapitalize="characters"
          maxLength={2}
          onChangeText={setCountryCode}
          placeholder="DE"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          value={countryCode}
        />

        <View style={styles.labelRow}><Text style={styles.label}>Languages</Text><Text style={styles.helper}>Choose up to 4</Text></View>
        <View style={styles.languages}>
          {languageOptions.map((option) => (
            <Pressable
              key={option}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: languages.includes(option), disabled: !languages.includes(option) && languages.length >= 4 }}
              disabled={!languages.includes(option) && languages.length >= 4}
              onPress={() => setLanguages((current) => current.includes(option)
                ? current.length > 1 ? current.filter((item) => item !== option) : current
                : [...current, option])}
              style={[styles.choice, languages.includes(option) && styles.choiceSelected, !languages.includes(option) && languages.length >= 4 && styles.choiceDisabled]}
            >
              <Text style={[styles.choiceText, languages.includes(option) && styles.choiceTextSelected]}>{option}</Text>
            </Pressable>
          ))}
        </View>

        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      </Card>

      <PrimaryButton disabled={!canSave} label={submitting ? 'Saving…' : 'Save profile'} onPress={() => void save()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  topRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  backButton: { alignItems: 'center', backgroundColor: colors.surfaceRaised, borderColor: colors.border, borderRadius: radius.pill, borderWidth: 1, height: 42, justifyContent: 'center', width: 42 },
  backGlyph: { color: colors.text, fontSize: 30, fontWeight: '500', lineHeight: 32 },
  topTitle: { color: colors.textMuted, fontSize: 13, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  topSpacer: { width: 42 },
  intro: { gap: spacing.sm, marginBottom: spacing.xl, marginTop: spacing.xl },
  avatarPreview: { alignItems: 'center', backgroundColor: colors.surfaceSoft, borderColor: colors.border, borderRadius: radius.lg, borderWidth: 1, flexDirection: 'row', gap: spacing.lg, marginBottom: spacing.lg, padding: spacing.lg },
  avatarCopy: { flex: 1, gap: 2 },
  previewName: { color: colors.text, fontSize: 20, fontWeight: '900', letterSpacing: -0.45 },
  previewHandle: { color: colors.primary, fontSize: 13, fontWeight: '800', marginBottom: spacing.xs },
  form: { backgroundColor: colors.surfaceSoft, gap: spacing.md, marginBottom: spacing.lg },
  label: { color: colors.textMuted, fontSize: 12, fontWeight: '800', marginTop: spacing.xs },
  labelRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  helper: { color: colors.textSubtle, fontSize: 10.5, fontWeight: '700' },
  input: { backgroundColor: colors.surfaceRaised, borderColor: colors.borderStrong, borderRadius: radius.md, borderWidth: 1, color: colors.text, fontSize: 16, minHeight: 52, paddingHorizontal: spacing.lg },
  bioInput: { minHeight: 116, paddingTop: spacing.md },
  characterCount: { color: colors.textSubtle, fontSize: 11, fontWeight: '700', marginTop: -spacing.sm, textAlign: 'right' },
  handleRow: { alignItems: 'center', backgroundColor: colors.surfaceRaised, borderColor: colors.borderStrong, borderRadius: radius.md, borderWidth: 1, flexDirection: 'row', minHeight: 52, paddingHorizontal: spacing.lg },
  at: { color: colors.primary, fontSize: 17, fontWeight: '800' },
  handleInput: { color: colors.text, flex: 1, fontSize: 16, paddingLeft: spacing.xs },
  languages: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  choice: { backgroundColor: colors.surfaceRaised, borderColor: colors.border, borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: 9 },
  choiceSelected: { backgroundColor: colors.primarySoft, borderColor: '#344A88' },
  choiceDisabled: { opacity: 0.4 },
  choiceText: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  choiceTextSelected: { color: colors.primary },
  error: { color: colors.danger, fontSize: 13, lineHeight: 19 },
});
