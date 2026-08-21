import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { Card, Eyebrow, Heading, Muted, PrimaryButton, Screen } from '@/components/ui';
import { createClub } from '@/features/clubs/api';
import { colors, radius, spacing } from '@/theme/tokens';

const topics = ['Late Night', 'Music', 'Gaming', 'Languages', 'Study', 'Travel', 'Relationships', 'Movies'];

export default function CreateClubScreen() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [topic, setTopic] = useState('Late Night');
  const [allowMemberRooms, setAllowMemberRooms] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const isValid = useMemo(
    () => name.trim().length >= 3 && description.trim().length >= 10 && topic.trim().length >= 2,
    [description, name, topic],
  );

  const submit = async () => {
    if (!isValid || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const clubId = await createClub({ allowMemberRooms, description, name, topic });
      router.replace({ pathname: '/clubs/[clubId]', params: { clubId } });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not create this club.');
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <View style={styles.topRow}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backGlyph}>‹</Text><Text style={styles.backLabel}>Clubs</Text>
        </Pressable>
        <Text style={styles.step}>New community</Text>
      </View>

      <View style={styles.hero}>
        <Eyebrow>Build your corner</Eyebrow>
        <Heading compact>Start a club people return to.</Heading>
        <Muted>Choose a clear theme. You’ll become the owner and can invite moderators later.</Muted>
      </View>

      <Card style={styles.form}>
        <View style={styles.field}>
          <View style={styles.labelRow}><Text style={styles.label}>Club name</Text><Text style={styles.counter}>{name.length}/60</Text></View>
          <TextInput
            accessibilityLabel="Club name"
            autoCapitalize="words"
            maxLength={60}
            onChangeText={setName}
            placeholder="Example: Midnight Thinkers"
            placeholderTextColor={colors.textSubtle}
            style={styles.input}
            value={name}
          />
        </View>

        <View style={styles.field}>
          <View style={styles.labelRow}><Text style={styles.label}>Description</Text><Text style={styles.counter}>{description.length}/300</Text></View>
          <TextInput
            accessibilityLabel="Club description"
            maxLength={300}
            multiline
            onChangeText={setDescription}
            placeholder="What will people talk about here?"
            placeholderTextColor={colors.textSubtle}
            style={[styles.input, styles.descriptionInput]}
            textAlignVertical="top"
            value={description}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Topic</Text>
          <View style={styles.topicGrid}>
            {topics.map((option) => (
              <Pressable
                key={option}
                accessibilityRole="radio"
                accessibilityState={{ checked: topic === option }}
                onPress={() => setTopic(option)}
                style={[styles.topic, topic === option && styles.topicSelected]}
              >
                <Text style={[styles.topicLabel, topic === option && styles.topicLabelSelected]}>{option}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingCopy}>
            <Text style={styles.settingTitle}>Let members start rooms</Text>
            <Muted>Turn this off if only you and moderators should host.</Muted>
          </View>
          <Switch
            accessibilityLabel="Allow members to start rooms"
            onValueChange={setAllowMemberRooms}
            thumbColor={colors.white}
            trackColor={{ false: colors.borderStrong, true: colors.primary }}
            value={allowMemberRooms}
          />
        </View>
      </Card>

      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <View style={styles.submit}>
        <PrimaryButton
          disabled={!isValid || submitting}
          label={submitting ? 'Creating club…' : 'Create club'}
          onPress={() => void submit()}
          icon={submitting ? <ActivityIndicator color={colors.primaryInk} size="small" /> : undefined}
        />
      </View>
      <Text style={styles.note}>You can own up to five clubs during the MVP.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  backButton: { alignItems: 'center', flexDirection: 'row', gap: 4, paddingVertical: spacing.sm },
  backGlyph: { color: colors.primary, fontSize: 28, lineHeight: 28 },
  backLabel: { color: colors.primary, fontSize: 14, fontWeight: '800' },
  step: { color: colors.textSubtle, fontSize: 13, fontWeight: '800', letterSpacing: 0.7, textTransform: 'uppercase' },
  hero: { gap: spacing.sm, marginTop: spacing.xl },
  form: { gap: spacing.xl, marginTop: spacing.xl },
  field: { gap: spacing.sm },
  labelRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  label: { color: colors.text, fontSize: 13, fontWeight: '900' },
  counter: { color: colors.textSubtle, fontSize: 12, fontWeight: '700' },
  input: { backgroundColor: colors.surfaceSoft, borderColor: colors.borderStrong, borderRadius: radius.md, borderWidth: 1, color: colors.text, fontSize: 15, minHeight: 52, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  descriptionInput: { lineHeight: 22, minHeight: 112 },
  topicGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  topic: { backgroundColor: colors.surfaceRaised, borderColor: colors.border, borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: 9 },
  topicSelected: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  topicLabel: { color: colors.textMuted, fontSize: 14, fontWeight: '800' },
  topicLabelSelected: { color: colors.primary },
  settingRow: { alignItems: 'center', backgroundColor: colors.surfaceSoft, borderRadius: radius.md, flexDirection: 'row', gap: spacing.lg, padding: spacing.lg },
  settingCopy: { flex: 1, gap: 3 },
  settingTitle: { color: colors.text, fontSize: 13, fontWeight: '900' },
  error: { color: colors.danger, fontSize: 13, marginTop: spacing.lg, textAlign: 'center' },
  submit: { marginTop: spacing.xl },
  note: { color: colors.textSubtle, fontSize: 13, lineHeight: 19, marginTop: spacing.md, textAlign: 'center' },
});
