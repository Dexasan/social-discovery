import { useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar, Card, Eyebrow, Heading, Muted, Pill, PrimaryButton, Screen } from '@/components/ui';
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
  const activeSearchRef = useRef(false);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    activeSearchRef.current = false;
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    if (matchState === 'searching') void cancelQuickChatSearch();
  }, [matchState]);

  const pollForMatch = async () => {
    if (!activeSearchRef.current) return;

    try {
      const result = await joinQuickChat(profile?.languages.length ? profile.languages : ['English']);
      if (!activeSearchRef.current) return;

      if (result.match_status === 'matched' && result.session_id && result.conversation_id && result.matched_profile_id) {
        activeSearchRef.current = false;
        const matchedProfile = await loadPublicProfile(result.matched_profile_id);
        setMatch(result);
        setPartner(matchedProfile);
        setMatchState('matched');
        return;
      }

      pollTimerRef.current = setTimeout(() => void pollForMatch(), 2500);
    } catch (nextError) {
      activeSearchRef.current = false;
      setMatchState('idle');
      setError(readableMatchError(nextError));
    }
  };

  const beginSearch = () => {
    setError('');
    setMatch(null);
    setPartner(null);
    setMatchState('searching');
    activeSearchRef.current = true;
    void pollForMatch();
  };

  const cancelSearch = async () => {
    activeSearchRef.current = false;
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
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
          <Eyebrow>Worldwide now</Eyebrow>
          <Heading compact>Quick Chat</Heading>
        </View>
        <View style={styles.online}>
          <View style={styles.onlineDot} />
          <Text style={styles.onlineText}>Secure matching</Text>
        </View>
      </View>

      {matchState === 'matched' ? (
        <Card style={styles.matchCard}>
          <Pill label="Connected" tone="accent" />
          <Avatar label={partnerName} size={86} />
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
          <View style={styles.orbit}>
            <View style={styles.orbitRing} />
            {matchState === 'searching' ? <ActivityIndicator color={colors.primary} size="large" /> : <Text style={styles.globe}>◎</Text>}
          </View>
          <View style={styles.centered}>
            <Text style={styles.discoveryTitle}>
              {matchState === 'searching' ? 'Looking worldwide…' : 'Someone interesting is one tap away.'}
            </Text>
            <Muted>
              {matchState === 'searching'
                ? 'Matching by language while keeping blocked accounts apart.'
                : 'Text first. You choose whether to follow and keep talking.'}
            </Muted>
          </View>
          {matchState === 'searching' ? (
            <Pressable onPress={() => void cancelSearch()} style={styles.secondaryButton}>
              <Text style={styles.secondaryText}>Cancel search</Text>
            </Pressable>
          ) : (
            <PrimaryButton label="Find someone" onPress={beginSearch} />
          )}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Text style={styles.safetyNote}>Profiles are authenticated. Block and report stay available throughout the conversation.</Text>
        </Card>
      )}

      <View style={styles.preferenceHeader}>
        <Text style={styles.sectionTitle}>Matching preferences</Text>
      </View>
      <View style={styles.preferenceRow}>
        {(profile?.languages ?? ['English']).map((language) => <Pill key={language} label={language} />)}
        <Pill label="Any country" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xl },
  online: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.pill, flexDirection: 'row', gap: 7, paddingHorizontal: 10, paddingVertical: 7 },
  onlineDot: { backgroundColor: colors.primary, borderRadius: 4, height: 8, width: 8 },
  onlineText: { color: colors.textMuted, fontSize: 11, fontWeight: '700' },
  discoveryCard: { gap: spacing.xl, paddingVertical: spacing.xxl },
  orbit: { alignItems: 'center', alignSelf: 'center', height: 126, justifyContent: 'center', width: 126 },
  orbitRing: { borderColor: colors.border, borderRadius: 63, borderStyle: 'dashed', borderWidth: 1, height: 126, position: 'absolute', width: 126 },
  globe: { color: colors.primary, fontSize: 62, fontWeight: '200' },
  centered: { alignItems: 'center', gap: spacing.sm },
  discoveryTitle: { color: colors.text, fontSize: 23, fontWeight: '800', lineHeight: 29, textAlign: 'center' },
  safetyNote: { color: colors.textMuted, fontSize: 11, textAlign: 'center' },
  preferenceHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.md, marginTop: spacing.xl },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  preferenceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  matchCard: { alignItems: 'center', gap: spacing.lg, paddingVertical: spacing.xl },
  matchName: { color: colors.text, fontSize: 24, fontWeight: '800' },
  sharedRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' },
  secondaryButton: { alignItems: 'center', borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, padding: spacing.md, width: '100%' },
  secondaryText: { color: colors.text, fontSize: 14, fontWeight: '700' },
  error: { color: colors.danger, fontSize: 13, lineHeight: 19, textAlign: 'center' },
});
