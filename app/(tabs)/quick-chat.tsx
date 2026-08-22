import { useCallback, useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, AppState, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { BrandLockup } from '@/components/Brand';
import { Avatar, Card, Muted, Pill, PrimaryButton, Screen } from '@/components/ui';
import { useSession } from '@/context/SessionContext';
import { useCalls } from '@/context/CallContext';
import { ensureDirectCallMicrophonePermission } from '@/features/calls/audio';
import { listAvailableCallers, requestDirectCall, type AvailableCaller } from '@/features/calls/api';
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
  const { isAvailable, isAvailabilityBusy, setAvailable } = useCalls();
  const [matchState, setMatchState] = useState<MatchState>('idle');
  const [match, setMatch] = useState<MatchResult | null>(null);
  const [partner, setPartner] = useState<PublicProfile | null>(null);
  const [error, setError] = useState('');
  const [topic, setTopic] = useState('Anything');
  const [interestInput, setInterestInput] = useState('');
  const activeSearchRef = useRef(false);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchGenerationRef = useRef(0);
  const [availableCallers, setAvailableCallers] = useState<AvailableCaller[]>([]);
  const [callersLoading, setCallersLoading] = useState(true);
  const [callingUserId, setCallingUserId] = useState<string | null>(null);

  const refreshAvailableCallers = useCallback(async () => {
    try {
      const callers = await listAvailableCallers();
      setAvailableCallers(callers);
    } catch {
      setAvailableCallers([]);
    } finally {
      setCallersLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshAvailableCallers();
    const interval = setInterval(() => void refreshAvailableCallers(), 10_000);
    return () => clearInterval(interval);
  }, [refreshAvailableCallers]);

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

  const callPerson = async (caller: AvailableCaller) => {
    if (callingUserId) return;
    setCallingUserId(caller.user_id);
    setError('');
    try {
      if (!(await ensureDirectCallMicrophonePermission())) {
        throw new Error('Allow microphone access to make an audio call.');
      }
      const callId = await requestDirectCall(caller.user_id);
      setAvailableCallers((current) => current.filter((item) => item.user_id !== caller.user_id));
      router.push(`/calls/${callId}` as never);
    } catch (nextError) {
      setError(readableMatchError(nextError));
      void refreshAvailableCallers();
    } finally {
      setCallingUserId(null);
    }
  };

  return (
    <Screen>
      <View style={styles.topBar}>
        <BrandLockup compact />
        <View style={styles.online}><View style={styles.onlineDot} /><Text style={styles.onlineText}>Online</Text></View>
      </View>

      <View style={styles.callShelf}>
        <View style={styles.callShelfHeader}>
          <View style={styles.callShelfTitleWrap}>
            <View style={styles.pulseMark}><View style={styles.pulseCore} /></View>
            <View>
              <Text style={styles.callShelfTitle}>Available for a call</Text>
              <Text style={styles.callShelfSubtitle}>Tap a person. Talk instantly.</Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: isAvailable, disabled: isAvailabilityBusy }}
            disabled={isAvailabilityBusy}
            onPress={() => void setAvailable(!isAvailable)}
            style={[styles.availabilityToggle, isAvailable && styles.availabilityToggleOn]}
          >
            <View style={[styles.toggleKnob, isAvailable && styles.toggleKnobOn]} />
          </Pressable>
        </View>

        {callersLoading ? (
          <ActivityIndicator color={colors.signal} style={styles.callersLoading} />
        ) : availableCallers.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.callersScroller}>
            <View style={styles.callerCards}>
              {availableCallers.map((caller) => {
                const name = caller.display_name || (caller.handle ? `@${caller.handle}` : 'YAPPIE member');
                const isCalling = callingUserId === caller.user_id;
                return (
                  <View key={caller.user_id} style={styles.callerCard}>
                    <View style={styles.callerAvatarWrap}>
                      <Avatar label={name} path={caller.avatar_path} size={62} />
                      <View style={styles.callerOnlineDot} />
                    </View>
                    <Text numberOfLines={1} style={styles.callerName}>{name}</Text>
                    <Text numberOfLines={1} style={styles.callerMeta}>{caller.country_code ?? 'Worldwide'} · {caller.languages[0] ?? 'Any language'}</Text>
                    <Pressable
                      accessibilityLabel={`Call ${name}`}
                      disabled={Boolean(callingUserId)}
                      onPress={() => void callPerson(caller)}
                      style={({ pressed }) => [styles.callButton, pressed && styles.callButtonPressed, Boolean(callingUserId) && styles.disabled]}
                    >
                      {isCalling ? <ActivityIndicator color={colors.primary} /> : <><Text style={styles.callGlyph}>⌕</Text><Text style={styles.callButtonText}>Call</Text></>}
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        ) : (
          <View style={styles.noCallers}>
            <Text style={styles.noCallersText}>{isAvailable ? 'You are visible. Waiting for more people to come online.' : 'Nobody is open right now. Switch yourself on and be the first.'}</Text>
          </View>
        )}
        <Text style={styles.callSafety}>No topic, no phone number, no setup · block or report anytime</Text>
      </View>

      {matchState === 'matched' ? (
        <Card style={styles.matchCard}>
          <Pill label="You found someone" tone="success" />
          <View style={styles.avatarHalo}><Avatar label={partnerName} path={partner?.avatar_path} size={88} /></View>
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
          <View style={styles.heroTopLine}>
            <Text style={styles.heroKicker}>Quick match</Text>
            <View style={styles.heroStatus}><View style={styles.heroStatusDot} /><Text style={styles.heroStatusText}>Ready when you are</Text></View>
          </View>
          <Text style={styles.heroTitle}>{matchState === 'searching' ? 'Finding a voice worth meeting…' : 'Skip the profile.\nMeet the person.'}</Text>
          <Text style={styles.heroCopy}>
            {matchState === 'searching'
              ? `Looking for someone open to ${topic === 'Anything' ? 'anything' : topic.toLowerCase()}.`
              : 'A private one-to-one chat with someone new. Keep it open, or give the match one thing to go on.'}
          </Text>

          <View style={styles.matchPromises}>
            <Text style={styles.matchPromise}>Anonymous first</Text>
            <View style={styles.promiseDivider} />
            <Text style={styles.matchPromise}>Text · 1:1</Text>
            <View style={styles.promiseDivider} />
            <Text style={styles.matchPromise}>Leave anytime</Text>
          </View>

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
              <ActivityIndicator color={colors.accent} />
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
  callShelf: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 25, borderWidth: 1, gap: spacing.md, marginBottom: spacing.lg, overflow: 'hidden', paddingVertical: spacing.lg },
  callShelfHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.lg },
  callShelfTitleWrap: { alignItems: 'center', flexDirection: 'row', flex: 1, gap: spacing.md },
  pulseMark: { alignItems: 'center', backgroundColor: colors.successSoft, borderRadius: 19, height: 38, justifyContent: 'center', width: 38 },
  pulseCore: { backgroundColor: colors.success, borderRadius: 7, height: 13, width: 13 },
  callShelfTitle: { color: colors.text, fontSize: 18, fontWeight: '900', letterSpacing: -0.4 },
  callShelfSubtitle: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  availabilityToggle: { backgroundColor: colors.surfaceRaised, borderColor: colors.borderStrong, borderRadius: 18, borderWidth: 1, height: 34, justifyContent: 'center', paddingHorizontal: 3, width: 58 },
  availabilityToggleOn: { backgroundColor: colors.signal, borderColor: colors.signal },
  toggleKnob: { backgroundColor: colors.textSubtle, borderRadius: 13, height: 26, width: 26 },
  toggleKnobOn: { backgroundColor: colors.primary, transform: [{ translateX: 24 }] },
  callersLoading: { height: 150 },
  callersScroller: { marginTop: spacing.xs },
  callerCards: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.lg },
  callerCard: { alignItems: 'center', backgroundColor: colors.surfaceSoft, borderColor: colors.border, borderRadius: 21, borderWidth: 1, padding: spacing.md, width: 154 },
  callerAvatarWrap: { marginBottom: spacing.sm, position: 'relative' },
  callerOnlineDot: { backgroundColor: colors.success, borderColor: colors.surfaceSoft, borderRadius: 7, borderWidth: 3, bottom: 1, height: 15, position: 'absolute', right: 1, width: 15 },
  callerName: { color: colors.text, fontSize: 16, fontWeight: '900', maxWidth: '100%' },
  callerMeta: { color: colors.textMuted, fontSize: 11.5, marginTop: 3, maxWidth: '100%' },
  callButton: { alignItems: 'center', backgroundColor: colors.signal, borderRadius: radius.pill, flexDirection: 'row', gap: 5, justifyContent: 'center', marginTop: spacing.md, minHeight: 42, width: '100%' },
  callButtonPressed: { opacity: 0.82, transform: [{ scale: 0.97 }] },
  callGlyph: { color: colors.primary, fontSize: 17, fontWeight: '900', transform: [{ rotate: '-45deg' }] },
  callButtonText: { color: colors.primary, fontSize: 14, fontWeight: '900' },
  noCallers: { backgroundColor: colors.surfaceSoft, borderRadius: radius.md, marginHorizontal: spacing.lg, padding: spacing.lg },
  noCallersText: { color: colors.textMuted, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  callSafety: { color: colors.textSubtle, fontSize: 11.5, fontWeight: '700', paddingHorizontal: spacing.lg, textAlign: 'center' },
  hero: { backgroundColor: '#15171B', borderColor: colors.border, borderLeftColor: colors.accent, borderLeftWidth: 4, borderRadius: 28, borderWidth: 1, gap: spacing.lg, padding: 20 },
  heroTopLine: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  heroKicker: { color: colors.accent, fontSize: 12, fontWeight: '900', letterSpacing: 1.5, textTransform: 'uppercase' },
  heroStatus: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  heroStatusDot: { backgroundColor: colors.success, borderRadius: 4, height: 7, width: 7 },
  heroStatusText: { color: colors.textSubtle, fontSize: 11.5, fontWeight: '700' },
  heroTitle: { color: colors.text, fontSize: 37, fontWeight: '900', letterSpacing: -1.7, lineHeight: 40 },
  heroCopy: { color: colors.textMuted, fontSize: 16, lineHeight: 23, maxWidth: 330 },
  matchPromises: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  matchPromise: { color: colors.textSubtle, fontSize: 11.5, fontWeight: '800' },
  promiseDivider: { backgroundColor: colors.borderStrong, borderRadius: 2, height: 4, width: 4 },
  interestBlock: { gap: spacing.md, marginTop: spacing.sm },
  interestHeadingRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, justifyContent: 'space-between' },
  interestHeading: { color: colors.text, flex: 1, fontSize: 15, fontWeight: '900' },
  activeInterest: { color: colors.accent, fontSize: 13, fontWeight: '900', maxWidth: 120 },
  customRow: { flexDirection: 'row', gap: spacing.sm },
  interestInput: { backgroundColor: colors.surfaceSoft, borderColor: colors.borderStrong, borderRadius: 16, borderWidth: 1, color: colors.text, flex: 1, fontSize: 16, minHeight: 54, paddingHorizontal: spacing.lg },
  useButton: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: 16, justifyContent: 'center', minWidth: 64, paddingHorizontal: spacing.md },
  useButtonText: { color: colors.white, fontSize: 15, fontWeight: '900' },
  disabled: { opacity: 0.4 },
  topicScroller: { marginHorizontal: -20 },
  topicChoices: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: 20 },
  topicChoice: { backgroundColor: colors.surfaceRaised, borderColor: colors.border, borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10 },
  topicChoiceSelected: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  topicChoiceText: { color: colors.textMuted, fontSize: 14, fontWeight: '800' },
  topicChoiceTextSelected: { color: colors.accent },
  matchButton: { alignItems: 'center', backgroundColor: colors.accent, borderRadius: 19, flexDirection: 'row', justifyContent: 'space-between', minHeight: 66, paddingHorizontal: 22 },
  matchButtonPressed: { opacity: 0.84, transform: [{ scale: 0.985 }] },
  matchButtonText: { color: colors.primary, fontSize: 18, fontWeight: '900' },
  matchArrow: { color: colors.primary, fontSize: 25, fontWeight: '900' },
  searchingPanel: { alignItems: 'center', gap: spacing.md },
  safetyNote: { color: colors.textSubtle, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  error: { color: colors.danger, fontSize: 14, lineHeight: 21, textAlign: 'center' },
  matchCard: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.accent, gap: spacing.lg, paddingVertical: spacing.xl },
  avatarHalo: { backgroundColor: colors.signal, borderRadius: 34, padding: 9 },
  centered: { alignItems: 'center', gap: spacing.sm },
  matchName: { color: colors.text, fontSize: 30, fontWeight: '900', letterSpacing: -1 },
  sharedRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' },
  secondaryButton: { alignItems: 'center', backgroundColor: colors.surfaceRaised, borderColor: colors.borderStrong, borderRadius: 17, borderWidth: 1, minHeight: 52, justifyContent: 'center', paddingHorizontal: spacing.lg, width: '100%' },
  secondaryText: { color: colors.text, fontSize: 15, fontWeight: '900' },
});
