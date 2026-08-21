import { useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, AppState, Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandLockup, BrandMark } from '@/components/Brand';
import { Avatar, Card, Muted, Pill, PrimaryButton, Screen, SectionHeader, SignalBars } from '@/components/ui';
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
        <View style={styles.headerBrand}>
          <BrandLockup compact />
          <Text style={styles.headerPrompt}>Who will you meet today?</Text>
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
            <Text style={styles.noLimits}>DROP 01</Text>
          </View>
          <View style={styles.signalStage}>
            <Text style={styles.signalNumber}>01</Text>
            <View style={styles.signalSticker}><SignalBars /></View>
            <View style={styles.signalSlash} />
            <View style={styles.orbitCore}>
              {matchState === 'searching' ? <ActivityIndicator color={colors.primaryPressed} size="large" /> : <BrandMark size={62} />}
            </View>
          </View>
          <View style={styles.centered}>
            <Text style={styles.discoveryTitle}>
              {matchState === 'searching' ? 'Finding your next yap…' : 'Tap in. Meet somebody.'}
            </Text>
            <Text style={styles.discoveryCopy}>
              {matchState === 'searching'
                ? 'Finding someone who shares your language right now.'
                  : 'No swipes and no waiting for a match. Say hello first and decide later.'}
            </Text>
          </View>
          <View style={styles.topicSection}>
            <Text style={styles.topicLabel}>PICK TONIGHT’S ENERGY</Text>
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
            <Pressable accessibilityRole="button" onPress={beginSearch} style={({ pressed }) => [styles.dropButton, pressed && styles.dropButtonPressed]}>
              <Text style={styles.dropButtonText}>Drop me into a chat</Text><Text style={styles.dropArrow}>↗</Text>
            </Pressable>
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
  headerBrand: { gap: 3 },
  headerPrompt: { color: colors.textMuted, fontSize: 14, fontWeight: '700', marginLeft: 50, marginTop: 2 },
  online: { alignItems: 'center', backgroundColor: colors.successSoft, borderColor: '#B9E2D4', borderRadius: radius.pill, borderWidth: 1, flexDirection: 'row', gap: 7, paddingHorizontal: 11, paddingVertical: 7 },
  onlineDot: { backgroundColor: colors.success, borderRadius: 4, height: 7, width: 7 },
  onlineText: { color: colors.success, fontSize: 12, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  discoveryCard: { backgroundColor: colors.primary, borderColor: colors.primary, gap: spacing.xl, overflow: 'hidden', paddingVertical: spacing.xl },
  discoveryTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  noLimits: { color: colors.signal, fontSize: 13, fontWeight: '900', letterSpacing: 1.2 },
  signalStage: { alignItems: 'center', alignSelf: 'stretch', height: 184, justifyContent: 'center', overflow: 'hidden' },
  signalNumber: { color: '#2D2E31', fontSize: 158, fontWeight: '900', left: -5, letterSpacing: -16, lineHeight: 170, position: 'absolute', top: 0 },
  signalSticker: { backgroundColor: colors.cobalt, borderRadius: 18, paddingHorizontal: 18, paddingVertical: 10, position: 'absolute', right: 3, top: 13, transform: [{ rotate: '9deg' }] },
  signalSlash: { backgroundColor: colors.signal, bottom: 16, height: 17, position: 'absolute', right: -28, transform: [{ rotate: '-12deg' }], width: 150 },
  orbitCore: { alignItems: 'center', backgroundColor: colors.white, borderRadius: 28, height: 104, justifyContent: 'center', transform: [{ rotate: '-4deg' }], width: 104 },
  centered: { alignItems: 'center', gap: spacing.sm },
  discoveryTitle: { color: colors.white, fontSize: 31, fontWeight: '900', letterSpacing: -1.2, lineHeight: 35, textAlign: 'center' },
  discoveryCopy: { color: '#C9C7C0', fontSize: 16, lineHeight: 24, maxWidth: 300, textAlign: 'center' },
  safetyRow: { alignItems: 'center', alignSelf: 'center', flexDirection: 'row', gap: spacing.sm },
  safetyIcon: { color: colors.success, fontSize: 12, fontWeight: '900' },
  safetyNote: { color: '#C9C7C0', fontSize: 12, fontWeight: '700', textAlign: 'center' },
  topicSection: { backgroundColor: colors.signal, borderRadius: 22, gap: spacing.md, marginHorizontal: -4, padding: spacing.lg, transform: [{ rotate: '-1deg' }] },
  topicLabel: { color: colors.primary, fontSize: 13, fontWeight: '900', letterSpacing: 1, textAlign: 'center' },
  topicChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' },
  topicChoice: { backgroundColor: 'rgba(255,255,255,0.56)', borderColor: 'rgba(23,24,27,0.18)', borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 9 },
  topicChoiceSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  topicChoiceText: { color: colors.primary, fontSize: 13, fontWeight: '800' },
  topicChoiceTextSelected: { color: colors.white },
  preferenceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  quickFacts: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-evenly', marginTop: spacing.lg, paddingVertical: spacing.lg },
  fact: { alignItems: 'center', flex: 1, gap: 3 },
  factDivider: { backgroundColor: colors.border, height: 28, width: 1 },
  factValue: { color: colors.text, fontSize: 16, fontWeight: '900' },
  factLabel: { color: colors.textSubtle, fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  matchCard: { backgroundColor: colors.cobaltSoft, borderColor: '#BAC5FF', gap: spacing.lg, paddingVertical: spacing.xl },
  matchTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  spark: { color: colors.cobalt, fontSize: 28 },
  avatarHalo: { alignSelf: 'center', backgroundColor: colors.signal, borderRadius: 36, padding: 12, transform: [{ rotate: '-3deg' }] },
  matchName: { color: colors.text, fontSize: 32, fontWeight: '900', letterSpacing: -1.1 },
  sharedRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' },
  secondaryButton: { alignItems: 'center', backgroundColor: colors.surfaceRaised, borderColor: colors.borderStrong, borderRadius: radius.md, borderWidth: 1, padding: spacing.md, width: '100%' },
  secondaryText: { color: colors.text, fontSize: 16, fontWeight: '800' },
  dropButton: { alignItems: 'center', backgroundColor: colors.signal, borderRadius: 20, flexDirection: 'row', justifyContent: 'space-between', minHeight: 66, paddingHorizontal: 22 },
  dropButtonPressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
  dropButtonText: { color: colors.primary, fontSize: 18, fontWeight: '900', letterSpacing: -0.3 },
  dropArrow: { color: colors.primary, fontSize: 27, fontWeight: '900' },
  error: { color: '#FF9D88', fontSize: 14, lineHeight: 21, textAlign: 'center' },
});
