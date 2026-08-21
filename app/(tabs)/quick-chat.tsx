import { useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, AppState, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { BrandLockup } from '@/components/Brand';
import { Avatar, Card, Muted, Pill, PrimaryButton, Screen } from '@/components/ui';
import { useSession } from '@/context/SessionContext';
import {
  cancelQuickChatSearch,
  joinQuickChat,
  leaveQuickChat,
  loadPublicProfile,
  type MatchResult,
  type PublicProfile,
} from '@/features/quick-chat/api';
import { colors, radius, spacing } from '@/theme/tokens';

type MatchState = 'idle' | 'searching' | 'matched';
const suggestedInterests = [
  'Anything', 'Music', 'Movies', 'Gaming', 'Anime', 'Books', 'Travel', 'Football',
  'Tech', 'Food', 'Fitness', 'Study', 'Languages', 'Late night', 'Relationships',
  'Career', 'Memes', 'Art', 'Politics', 'Philosophy', 'True crime', 'Photography', 'Cars', 'Fashion',
];

function readableMatchError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Matching failed. Please try again.';
  if (message.toLowerCase().includes('network')) return 'The network is unavailable. Check your connection and try again.';
  return message;
}

export default function QuickChatScreen() {
  const { profile } = useSession();
  const [matchState, setMatchState] = useState<MatchState>('idle');
  const [match, setMatch] = useState<MatchResult | null>(null);
  const [partner, setPartner] = useState<PublicProfile | null>(null);
  const [error, setError] = useState('');
  const [topic, setTopic] = useState('Anything');
  const [interestInput, setInterestInput] = useState('');
  const activeSearchRef = useRef(false);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchGenerationRef = useRef(0);

  useEffect(() => {
    const stopActiveSearch = () => {
      if (!activeSearchRef.current) return;
      searchGenerationRef.current += 1;
      activeSearchRef.current = false;
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
      void cancelQuickChatSearch().catch(() => undefined);
    };

    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' || !activeSearchRef.current) return;
      stopActiveSearch();
      setMatchState('idle');
      setError('Search paused while the app was away. Tap below when you are ready again.');
    });

    return () => {
      stopActiveSearch();
      appStateSubscription.remove();
    };
  }, []);

  const pollForMatch = async (generation: number) => {
    if (!activeSearchRef.current || generation !== searchGenerationRef.current) return;
    try {
      const result = await joinQuickChat(
        profile?.languages.length ? profile.languages : ['English'],
        topic === 'Anything' ? undefined : topic,
      );
      if (!activeSearchRef.current || generation !== searchGenerationRef.current) return;

      if (result.match_status === 'matched' && result.session_id && result.conversation_id && result.matched_profile_id) {
        const matchedProfile = await loadPublicProfile(result.matched_profile_id);
        if (!activeSearchRef.current || generation !== searchGenerationRef.current) return;
        activeSearchRef.current = false;
        setMatch(result);
        setPartner(matchedProfile);
        setMatchState('matched');
        return;
      }
      pollTimerRef.current = setTimeout(() => void pollForMatch(generation), 2500);
    } catch (nextError) {
      if (generation !== searchGenerationRef.current) return;
      activeSearchRef.current = false;
      setMatchState('idle');
      setError(readableMatchError(nextError));
    }
  };

  const beginSearch = () => {
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    const generation = searchGenerationRef.current + 1;
    searchGenerationRef.current = generation;
    setError('');
    setMatch(null);
    setPartner(null);
    setMatchState('searching');
    activeSearchRef.current = true;
    void pollForMatch(generation);
  };

  const cancelSearch = async () => {
    searchGenerationRef.current += 1;
    activeSearchRef.current = false;
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    pollTimerRef.current = null;
    setMatchState('idle');
    try {
      await cancelQuickChatSearch();
    } catch (nextError) {
      setError(readableMatchError(nextError));
    }
  };

  const useCustomInterest = () => {
    const nextTopic = interestInput.trim().replace(/\s+/g, ' ').slice(0, 40);
    if (!nextTopic) return;
    setTopic(nextTopic);
    setInterestInput('');
  };

  const skipMatch = async () => {
    if (match?.session_id) await leaveQuickChat(match.session_id, 'skip');
    beginSearch();
  };

  const openConversation = () => {
    if (!match?.session_id || !match.conversation_id || !match.matched_profile_id) return;
    router.push({
      pathname: '/quick-chat/[sessionId]',
      params: { sessionId: match.session_id, conversationId: match.conversation_id, partnerId: match.matched_profile_id },
    });
  };

  const partnerName = partner?.display_name || (partner?.handle ? `@${partner.handle}` : 'New connection');

  return (
    <Screen>
      <View style={styles.topBar}>
        <BrandLockup compact />
        <View style={styles.online}><View style={styles.onlineDot} /><Text style={styles.onlineText}>Online</Text></View>
      </View>

      {matchState === 'matched' ? (
        <Card style={styles.matchCard}>
          <Pill label="You found someone" tone="success" />
          <View style={styles.avatarHalo}><Avatar label={partnerName} size={88} /></View>
          <View style={styles.centered}>
            <Text style={styles.matchName}>{partnerName}</Text>
            <Muted>{partner?.country_code ?? 'Worldwide'} · {partner?.languages.join(', ') || 'Shared language'}</Muted>
          </View>
          <View style={styles.sharedRow}>{(partner?.languages ?? []).slice(0, 3).map((language) => <Pill key={language} label={language} />)}</View>
          <PrimaryButton label="Start conversation" onPress={openConversation} />
          <Pressable onPress={() => void skipMatch()} style={styles.secondaryButton}><Text style={styles.secondaryText}>Find someone else</Text></Pressable>
        </Card>
      ) : (
        <View style={styles.hero}>
          <View style={styles.peopleVisual}>
            <View style={[styles.person, styles.personLeft]}><Text style={styles.personGlyph}>?</Text></View>
            <View style={styles.connection}><View style={styles.connectionDot} /><View style={styles.connectionDot} /><View style={styles.connectionDot} /></View>
            <View style={[styles.person, styles.personRight]}><Text style={styles.personGlyph}>?</Text></View>
          </View>
          <Text style={styles.heroTitle}>{matchState === 'searching' ? 'Looking for your person…' : 'Meet someone new'}</Text>
          <Text style={styles.heroCopy}>
            {matchState === 'searching'
              ? `Matching you with someone who wants to talk about ${topic.toLowerCase()}.`
              : 'Pick an interest, or leave it open. We will connect you one-to-one with someone who is here now.'}
          </Text>

          <View style={styles.interestBlock}>
            <View style={styles.interestHeadingRow}>
              <Text style={styles.interestHeading}>What do you want to talk about?</Text>
              <Text numberOfLines={1} style={styles.activeInterest}>{topic}</Text>
            </View>
            <View style={styles.customRow}>
              <TextInput
                accessibilityLabel="Type any interest"
                editable={matchState !== 'searching'}
                maxLength={40}
                onChangeText={setInterestInput}
                onSubmitEditing={useCustomInterest}
                placeholder="Type any interest…"
                placeholderTextColor={colors.textSubtle}
                returnKeyType="done"
                style={styles.interestInput}
                value={interestInput}
              />
              <Pressable
                accessibilityRole="button"
                disabled={!interestInput.trim() || matchState === 'searching'}
                onPress={useCustomInterest}
                style={[styles.useButton, (!interestInput.trim() || matchState === 'searching') && styles.disabled]}
              >
                <Text style={styles.useButtonText}>Use</Text>
              </Pressable>
            </View>
            <ScrollView horizontal keyboardShouldPersistTaps="handled" showsHorizontalScrollIndicator={false} style={styles.topicScroller}>
              <View style={styles.topicChoices}>
                {suggestedInterests.map((option) => (
                  <Pressable
                    key={option}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: topic === option, disabled: matchState === 'searching' }}
                    disabled={matchState === 'searching'}
                    onPress={() => setTopic(option)}
                    style={[styles.topicChoice, topic === option && styles.topicChoiceSelected]}
                  >
                    <Text style={[styles.topicChoiceText, topic === option && styles.topicChoiceTextSelected]}>{option}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>

          {matchState === 'searching' ? (
            <View style={styles.searchingPanel}>
              <ActivityIndicator color={colors.cobalt} />
              <Pressable onPress={() => void cancelSearch()} style={styles.secondaryButton}><Text style={styles.secondaryText}>Cancel search</Text></Pressable>
            </View>
          ) : (
            <Pressable accessibilityRole="button" onPress={beginSearch} style={({ pressed }) => [styles.matchButton, pressed && styles.matchButtonPressed]}>
              <Text style={styles.matchButtonText}>Match me now</Text><Text style={styles.matchArrow}>→</Text>
            </Pressable>
          )}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Text style={styles.safetyNote}>Private 1:1 chat · Block or report anytime</Text>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.lg },
  online: { alignItems: 'center', backgroundColor: colors.successSoft, borderRadius: radius.pill, flexDirection: 'row', gap: 7, paddingHorizontal: 11, paddingVertical: 7 },
  onlineDot: { backgroundColor: colors.success, borderRadius: 4, height: 7, width: 7 },
  onlineText: { color: colors.success, fontSize: 12, fontWeight: '900', letterSpacing: 0.5, textTransform: 'uppercase' },
  hero: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 28, borderWidth: 1, gap: spacing.lg, padding: 20 },
  peopleVisual: { alignItems: 'center', alignSelf: 'center', flexDirection: 'row', justifyContent: 'center', marginBottom: spacing.xs, marginTop: spacing.sm },
  person: { alignItems: 'center', borderColor: colors.primary, borderRadius: 34, borderWidth: 3, height: 68, justifyContent: 'center', width: 68 },
  personLeft: { backgroundColor: colors.signal },
  personRight: { backgroundColor: colors.cobaltSoft },
  personGlyph: { color: colors.primary, fontSize: 27, fontWeight: '900' },
  connection: { alignItems: 'center', flexDirection: 'row', gap: 5, marginHorizontal: 10 },
  connectionDot: { backgroundColor: colors.accent, borderRadius: 4, height: 7, width: 7 },
  heroTitle: { color: colors.text, fontSize: 31, fontWeight: '900', letterSpacing: -1.1, lineHeight: 35, textAlign: 'center' },
  heroCopy: { alignSelf: 'center', color: colors.textMuted, fontSize: 16, lineHeight: 23, maxWidth: 320, textAlign: 'center' },
  interestBlock: { gap: spacing.md, marginTop: spacing.sm },
  interestHeadingRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, justifyContent: 'space-between' },
  interestHeading: { color: colors.text, flex: 1, fontSize: 15, fontWeight: '900' },
  activeInterest: { color: colors.cobalt, fontSize: 13, fontWeight: '900', maxWidth: 120 },
  customRow: { flexDirection: 'row', gap: spacing.sm },
  interestInput: { backgroundColor: colors.surfaceSoft, borderColor: colors.borderStrong, borderRadius: 16, borderWidth: 1, color: colors.text, flex: 1, fontSize: 16, minHeight: 54, paddingHorizontal: spacing.lg },
  useButton: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: 16, justifyContent: 'center', minWidth: 64, paddingHorizontal: spacing.md },
  useButtonText: { color: colors.white, fontSize: 15, fontWeight: '900' },
  disabled: { opacity: 0.4 },
  topicScroller: { marginHorizontal: -20 },
  topicChoices: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: 20 },
  topicChoice: { backgroundColor: colors.surfaceRaised, borderColor: colors.border, borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10 },
  topicChoiceSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  topicChoiceText: { color: colors.textMuted, fontSize: 14, fontWeight: '800' },
  topicChoiceTextSelected: { color: colors.white },
  matchButton: { alignItems: 'center', backgroundColor: colors.cobalt, borderRadius: 19, flexDirection: 'row', justifyContent: 'space-between', minHeight: 64, paddingHorizontal: 22 },
  matchButtonPressed: { opacity: 0.84, transform: [{ scale: 0.985 }] },
  matchButtonText: { color: colors.white, fontSize: 18, fontWeight: '900' },
  matchArrow: { color: colors.white, fontSize: 25, fontWeight: '900' },
  searchingPanel: { alignItems: 'center', gap: spacing.md },
  safetyNote: { color: colors.textSubtle, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  error: { color: colors.danger, fontSize: 14, lineHeight: 21, textAlign: 'center' },
  matchCard: { alignItems: 'center', backgroundColor: colors.cobaltSoft, borderColor: '#BAC5FF', gap: spacing.lg, paddingVertical: spacing.xl },
  avatarHalo: { backgroundColor: colors.signal, borderRadius: 34, padding: 9 },
  centered: { alignItems: 'center', gap: spacing.sm },
  matchName: { color: colors.text, fontSize: 30, fontWeight: '900', letterSpacing: -1 },
  sharedRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' },
  secondaryButton: { alignItems: 'center', backgroundColor: colors.surfaceRaised, borderColor: colors.borderStrong, borderRadius: 17, borderWidth: 1, minHeight: 52, justifyContent: 'center', paddingHorizontal: spacing.lg, width: '100%' },
  secondaryText: { color: colors.text, fontSize: 15, fontWeight: '900' },
});
