import { useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, AppState, Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar, Card, Eyebrow, Heading, Muted, Pill, PrimaryButton, Screen, SectionHeader } from '@/components/ui';
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
const conversationTopics = ['Surprise me', 'Late Night', 'Music', 'Gaming', 'Languages', 'Study'];

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
  const [topic, setTopic] = useState('Surprise me');
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
        topic === 'Surprise me' ? undefined : topic,
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

  const skipMatch = async () => {
    if (match?.session_id) await leaveQuickChat(match.session_id, 'skip');
    beginSearch();
  };

  const openConversation = () => {
    if (!match?.session_id || !match.conversation_id || !match.matched_profile_id) return;
    router.push({
      pathname: '/quick-chat/[sessionId]',
      params: {
        sessionId: match.session_id,
        conversationId: match.conversation_id,
        partnerId: match.matched_profile_id,
      },
    });
  };

  const partnerName = partner?.display_name || (partner?.handle ? `@${partner.handle}` : 'New connection');

  return (
    <Screen>
      <View style={styles.headerRow}>
        <View>
          <Eyebrow>Quick chat · worldwide</Eyebrow>
          <Heading compact>Meet someone new.</Heading>
        </View>
        <View style={styles.online}>
          <View style={styles.onlineDot} />
          <Text style={styles.onlineText}>Online</Text>
        </View>
      </View>

      {matchState === 'matched' ? (
        <Card style={styles.matchCard}>
          <View style={styles.matchTop}>
            <Pill label="New connection" tone="success" />
            <Text style={styles.spark}>✦</Text>
          </View>
          <View style={styles.avatarHalo}><Avatar label={partnerName} size={92} /></View>
          <View style={styles.centered}>
            <Text style={styles.matchName}>{partnerName}</Text>
            <Muted>{partner?.country_code ?? 'Worldwide'} · {partner?.languages.join(', ') || 'Shared language'}</Muted>
          </View>
          <View style={styles.sharedRow}>
            {(partner?.languages ?? []).slice(0, 3).map((language) => <Pill key={language} label={language} />)}
          </View>
          <PrimaryButton label="Start conversation" onPress={openConversation} />
          <Pressable onPress={() => void skipMatch()} style={styles.secondaryButton}>
            <Text style={styles.secondaryText}>Skip</Text>
          </Pressable>
        </Card>
      ) : (
        <Card style={styles.discoveryCard}>
          <View style={styles.discoveryTop}>
            <Pill label={matchState === 'searching' ? 'Searching live' : 'Global discovery'} tone={matchState === 'searching' ? 'live' : 'accent'} />
            <Text style={styles.noLimits}>No limits</Text>
          </View>
          <View style={styles.orbit}>
            <View style={[styles.orbitRing, styles.orbitOuter]} />
            <View style={[styles.orbitRing, styles.orbitMiddle]} />
            <View style={styles.satelliteOne} />
            <View style={styles.satelliteTwo} />
            <View style={styles.satelliteThree} />
            <View style={styles.orbitCore}>
              {matchState === 'searching' ? <ActivityIndicator color={colors.primary} size="large" /> : <Text style={styles.globe}>◎</Text>}
            </View>
          </View>
          <View style={styles.centered}>
            <Text style={styles.discoveryTitle}>
              {matchState === 'searching' ? 'Scanning the world…' : 'One tap. A real person.'}
            </Text>
            <Muted>
              {matchState === 'searching'
                ? 'Finding someone who shares your language right now.'
                : 'Start with a conversation, not a profile. Keep the connection only if it clicks.'}
            </Muted>
          </View>
          <View style={styles.topicSection}>
            <Text style={styles.topicLabel}>What are you up for?</Text>
            <View style={styles.topicChoices}>
              {conversationTopics.map((option) => (
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
          </View>
          {matchState === 'searching' ? (
            <Pressable onPress={() => void cancelSearch()} style={styles.secondaryButton}>
              <Text style={styles.secondaryText}>Cancel search</Text>
            </Pressable>
          ) : (
            <PrimaryButton label="Find someone" onPress={beginSearch} />
          )}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.safetyRow}>
            <Text style={styles.safetyIcon}>✓</Text>
            <Text style={styles.safetyNote}>Authenticated profiles · Block and report anytime</Text>
          </View>
        </Card>
      )}

      <View style={styles.quickFacts}>
        <View style={styles.fact}><Text style={styles.factValue}>∞</Text><Text style={styles.factLabel}>Unlimited</Text></View>
        <View style={styles.factDivider} />
        <View style={styles.fact}><Text style={styles.factValue}>1:1</Text><Text style={styles.factLabel}>Private</Text></View>
        <View style={styles.factDivider} />
        <View style={styles.fact}><Text style={styles.factValue}>24/7</Text><Text style={styles.factLabel}>Worldwide</Text></View>
      </View>

      <SectionHeader title="Your matching lane" />
      <View style={styles.preferenceRow}>
        {(profile?.languages ?? ['English']).map((language) => <Pill key={language} label={language} />)}
        <Pill label={topic === 'Surprise me' ? 'Any topic' : topic} tone="accent" />
        <Pill label="Any country" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xl },
  online: { alignItems: 'center', backgroundColor: colors.successSoft, borderColor: '#285241', borderRadius: radius.pill, borderWidth: 1, flexDirection: 'row', gap: 7, paddingHorizontal: 11, paddingVertical: 7 },
  onlineDot: { backgroundColor: colors.success, borderRadius: 4, height: 7, width: 7 },
  onlineText: { color: colors.success, fontSize: 10, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  discoveryCard: { backgroundColor: colors.surfaceSoft, gap: spacing.xl, overflow: 'hidden', paddingVertical: spacing.xl },
  discoveryTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  noLimits: { color: colors.textSubtle, fontSize: 11, fontWeight: '800', letterSpacing: 0.7, textTransform: 'uppercase' },
  orbit: { alignItems: 'center', alignSelf: 'center', height: 176, justifyContent: 'center', marginVertical: spacing.xs, width: 176 },
  orbitRing: { borderColor: colors.borderStrong, borderRadius: 99, borderStyle: 'dashed', borderWidth: 1, position: 'absolute' },
  orbitOuter: { height: 176, width: 176 },
  orbitMiddle: { borderColor: '#283456', height: 126, width: 126 },
  orbitCore: { alignItems: 'center', backgroundColor: colors.primarySoft, borderColor: '#344A88', borderRadius: 42, borderWidth: 1, height: 84, justifyContent: 'center', width: 84 },
  satelliteOne: { backgroundColor: colors.accent, borderColor: '#FFC0CA', borderRadius: 7, borderWidth: 2, height: 14, position: 'absolute', right: 19, top: 35, width: 14 },
  satelliteTwo: { backgroundColor: colors.success, borderColor: '#B9F3DC', borderRadius: 6, borderWidth: 2, bottom: 24, height: 12, left: 29, position: 'absolute', width: 12 },
  satelliteThree: { backgroundColor: colors.warning, borderColor: '#FFE2AF', borderRadius: 5, borderWidth: 2, height: 10, left: 12, position: 'absolute', top: 57, width: 10 },
  globe: { color: colors.primary, fontSize: 46, fontWeight: '200' },
  centered: { alignItems: 'center', gap: spacing.sm },
  discoveryTitle: { color: colors.text, fontSize: 24, fontWeight: '900', letterSpacing: -0.7, lineHeight: 29, textAlign: 'center' },
  safetyRow: { alignItems: 'center', alignSelf: 'center', flexDirection: 'row', gap: spacing.sm },
  safetyIcon: { color: colors.success, fontSize: 12, fontWeight: '900' },
  safetyNote: { color: colors.textSubtle, fontSize: 10.5, fontWeight: '600', textAlign: 'center' },
  topicSection: { gap: spacing.sm },
  topicLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '800', textAlign: 'center', textTransform: 'uppercase' },
  topicChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' },
  topicChoice: { backgroundColor: colors.surfaceRaised, borderColor: colors.border, borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 7 },
  topicChoiceSelected: { backgroundColor: colors.primarySoft, borderColor: '#344A88' },
  topicChoiceText: { color: colors.textMuted, fontSize: 10.5, fontWeight: '800' },
  topicChoiceTextSelected: { color: colors.primary },
  preferenceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  quickFacts: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-evenly', marginTop: spacing.lg, paddingVertical: spacing.lg },
  fact: { alignItems: 'center', flex: 1, gap: 3 },
  factDivider: { backgroundColor: colors.border, height: 28, width: 1 },
  factValue: { color: colors.text, fontSize: 16, fontWeight: '900' },
  factLabel: { color: colors.textSubtle, fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  matchCard: { gap: spacing.lg, paddingVertical: spacing.xl },
  matchTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  spark: { color: colors.primary, fontSize: 24 },
  avatarHalo: { alignSelf: 'center', backgroundColor: colors.primarySoft, borderRadius: 64, padding: 12 },
  matchName: { color: colors.text, fontSize: 26, fontWeight: '900', letterSpacing: -0.7 },
  sharedRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' },
  secondaryButton: { alignItems: 'center', backgroundColor: colors.surfaceRaised, borderColor: colors.borderStrong, borderRadius: radius.md, borderWidth: 1, padding: spacing.md, width: '100%' },
  secondaryText: { color: colors.text, fontSize: 14, fontWeight: '800' },
  error: { color: colors.danger, fontSize: 13, lineHeight: 19, textAlign: 'center' },
});
