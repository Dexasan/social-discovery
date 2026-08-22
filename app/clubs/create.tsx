import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import type { ImagePickerAsset } from 'expo-image-picker';

import { Avatar, Card, Eyebrow, Heading, Muted, PrimaryButton, Screen } from '@/components/ui';
import { createClub } from '@/features/clubs/api';
import { chooseClubAvatar, uploadClubAvatar } from '@/features/clubs/avatar';
import { colors, radius, spacing } from '@/theme/tokens';

export default function CreateClubScreen() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [topic, setTopic] = useState('');
  const [allowMemberRooms, setAllowMemberRooms] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [clubImage, setClubImage] = useState<ImagePickerAsset | null>(null);
  const [createdClubId, setCreatedClubId] = useState<string | null>(null);
  const [imageBusy, setImageBusy] = useState(false);

  const isValid = useMemo(
    () => Boolean(clubImage) && name.trim().length >= 3 && description.trim().length >= 10 && topic.trim().length >= 2,
    [clubImage, description, name, topic],
  );

  const pickImage = async () => {
    if (imageBusy || submitting) return;
    setImageBusy(true);
    setError('');
    try {
      const asset = await chooseClubAvatar();
      if (asset) setClubImage(asset);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not choose this picture.');
    } finally {
      setImageBusy(false);
    }
  };

  const submit = async () => {
    if (!isValid || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      if (!clubImage) throw new Error('Choose a Club picture first.');
      const clubId = createdClubId ?? await createClub({ allowMemberRooms, description, name, topic });
      setCreatedClubId(clubId);
      await uploadClubAvatar(clubId, clubImage, null);
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
          <Text style={styles.label}>Club picture</Text>
          <Pressable accessibilityRole="button" disabled={imageBusy || submitting} onPress={() => void pickImage()} style={styles.imagePicker}>
            <Avatar imageUrl={clubImage?.uri} label={name.trim() || 'New club'} size={82} />
            <View style={styles.imageCopy}>
              <Text style={styles.imageAction}>{imageBusy ? 'Opening photos…' : clubImage ? 'Change picture' : 'Choose a picture'}</Text>
              <Muted>Square crop · JPG, PNG or WebP · 5 MB max</Muted>
            </View>
            <Text style={styles.imageArrow}>›</Text>
          </Pressable>
        </View>

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
          <View style={styles.labelRow}><Text style={styles.label}>Topic</Text><Text style={styles.counter}>{topic.length}/32</Text></View>
          <TextInput
            accessibilityLabel="Club topic"
            autoCapitalize="sentences"
            maxLength={32}
            onChangeText={setTopic}
            placeholder="Anything: street photography, indie games…"
            placeholderTextColor={colors.textSubtle}
            style={styles.input}
            value={topic}
          />
          <Muted>Write the subject in your own words. This helps people find the Club.</Muted>
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
          label={submitting ? createdClubId ? 'Uploading picture…' : 'Creating club…' : createdClubId ? 'Retry picture upload' : 'Create club'}
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
  backGlyph: { color: colors.text, fontSize: 28, lineHeight: 28 },
  backLabel: { color: colors.text, fontSize: 14, fontWeight: '800' },
  step: { color: colors.textSubtle, fontSize: 13, fontWeight: '800', letterSpacing: 0.7, textTransform: 'uppercase' },
  hero: { gap: spacing.sm, marginTop: spacing.xl },
  form: { gap: spacing.xl, marginTop: spacing.xl },
  field: { gap: spacing.sm },
  imagePicker: { alignItems: 'center', backgroundColor: colors.surfaceSoft, borderColor: colors.borderStrong, borderRadius: radius.lg, borderWidth: 1, flexDirection: 'row', gap: spacing.md, padding: spacing.md },
  imageCopy: { flex: 1, gap: 3 },
  imageAction: { color: colors.signal, fontSize: 15, fontWeight: '900' },
  imageArrow: { color: colors.textMuted, fontSize: 27 },
  labelRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  label: { color: colors.text, fontSize: 13, fontWeight: '900' },
  counter: { color: colors.textSubtle, fontSize: 12, fontWeight: '700' },
  input: { backgroundColor: colors.surfaceSoft, borderColor: colors.borderStrong, borderRadius: radius.md, borderWidth: 1, color: colors.text, fontSize: 15, minHeight: 52, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  descriptionInput: { lineHeight: 22, minHeight: 112 },
  settingRow: { alignItems: 'center', backgroundColor: colors.surfaceSoft, borderRadius: radius.md, flexDirection: 'row', gap: spacing.lg, padding: spacing.lg },
  settingCopy: { flex: 1, gap: 3 },
  settingTitle: { color: colors.text, fontSize: 13, fontWeight: '900' },
  error: { color: colors.danger, fontSize: 13, marginTop: spacing.lg, textAlign: 'center' },
  submit: { marginTop: spacing.xl },
  note: { color: colors.textSubtle, fontSize: 13, lineHeight: 19, marginTop: spacing.md, textAlign: 'center' },
});
