import { useCallback, useState } from 'react';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { GiftPicker } from '@/components/GiftPicker';
import { Avatar, Card, EmptyState, Muted, Pill, Screen, SectionHeader } from '@/components/ui';
import { useSession } from '@/context/SessionContext';
import {
  loadCoinWallet,
  loadProfileGifts,
  type CoinWallet,
  type ProfileGift,
} from '@/features/gifts/api';
import { blockProfile, loadPublicProfile, reportProfile, type PublicProfile } from '@/features/quick-chat/api';
import {
  followProfile,
  getOrCreateDirectConversation,
  isFollowingProfile,
  loadProfilePosts,
  loadSocialStats,
  unfollowProfile,
  type PublicProfilePost,
  type SocialStats,
} from '@/features/social/api';
import { colors, radius, spacing } from '@/theme/tokens';

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function relativeTime(value: string) {
  const seconds = Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return 'now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export default function PublicProfileScreen() {
  const params = useLocalSearchParams<{ userId: string }>();
  const profileId = first(params.userId);
  const { user } = useSession();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [stats, setStats] = useState<SocialStats | null>(null);
  const [posts, setPosts] = useState<PublicProfilePost[]>([]);
  const [following, setFollowing] = useState(false);
  const [wallet, setWallet] = useState<CoinWallet | null>(null);
  const [profileGifts, setProfileGifts] = useState<ProfileGift[]>([]);
  const [giftModalVisible, setGiftModalVisible] = useState(false);
  const [giftError, setGiftError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<'follow' | 'message' | null>(null);
  const [reported, setReported] = useState(false);
  const [error, setError] = useState('');
  const isOwnProfile = Boolean(user && profileId === user.id);
  const working = busyAction !== null;

  const refresh = useCallback(async () => {
    if (!profileId || !user) {
      setError('This profile could not be opened.');
      setLoading(false);
      return;
    }
    setError('');
    try {
      const [nextProfile, nextStats, nextPosts, nextFollowing] = await Promise.all([
        loadPublicProfile(profileId),
        loadSocialStats(profileId),
        loadProfilePosts(profileId),
        profileId === user.id ? Promise.resolve(false) : isFollowingProfile(user.id, profileId),
      ]);
      setProfile(nextProfile);
      setStats(nextStats);
      setPosts(nextPosts);
      setFollowing(nextFollowing);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not load this profile.');
    } finally {
      setLoading(false);
    }
  }, [profileId, user]);

  const refreshGifts = useCallback(async () => {
    if (!profileId) return;
    setGiftError('');
    try {
      const [nextWallet, nextGifts] = await Promise.all([
        loadCoinWallet(),
        loadProfileGifts(profileId),
      ]);
      setWallet(nextWallet);
      setProfileGifts(nextGifts);
    } catch (nextError) {
      setGiftError(nextError instanceof Error ? nextError.message : 'Gifts are temporarily unavailable.');
    }
  }, [profileId]);

  useFocusEffect(useCallback(() => {
    void refresh();
    void refreshGifts();
  }, [refresh, refreshGifts]));

  const toggleFollow = async () => {
    if (!user || !profileId || isOwnProfile || working) return;
    const previous = following;
    const previousStats = stats;
    setFollowing(!previous);
    setStats((current) => current ? { ...current, followers: Math.max(0, current.followers + (previous ? -1 : 1)) } : current);
    setBusyAction('follow');
    setError('');
    try {
      if (previous) await unfollowProfile(user.id, profileId);
      else await followProfile(user.id, profileId);
    } catch (nextError) {
      setFollowing(previous);
      setStats(previousStats);
      setError(nextError instanceof Error ? nextError.message : 'Could not update this follow.');
    } finally {
      setBusyAction(null);
    }
  };

  const openMessage = async () => {
    if (!profileId || isOwnProfile || working) return;
    setBusyAction('message');
    setError('');
    try {
      const conversationId = await getOrCreateDirectConversation(profileId);
      router.push({
        pathname: '/messages/[conversationId]',
        params: { conversationId, partnerId: profileId, partnerName: profileName },
      });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not start a conversation.');
    } finally {
      setBusyAction(null);
    }
  };

  const confirmBlock = () => {
    if (!user || !profileId || isOwnProfile) return;
    Alert.alert('Block this person?', 'You will stop seeing each other and they will not be able to message you.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Block',
        style: 'destructive',
        onPress: () => void blockProfile(user.id, profileId)
          .then(() => router.back())
          .catch((nextError: unknown) => setError(nextError instanceof Error ? nextError.message : 'Could not block this account.')),
      },
    ]);
  };

  const confirmReport = () => {
    if (!user || !profileId || isOwnProfile || reported) return;
    Alert.alert('Report this account?', 'A moderation report will be created for review.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Report',
        style: 'destructive',
        onPress: () => void reportProfile(user.id, profileId, 'Reported from public profile')
          .then(() => setReported(true))
          .catch((nextError: unknown) => setError(nextError instanceof Error ? nextError.message : 'Could not submit this report.')),
      },
    ]);
  };

  const openGiftPicker = () => {
    setGiftModalVisible(true);
  };

  if (loading) {
    return <Screen><ActivityIndicator color={colors.primary} style={styles.loading} /></Screen>;
  }

  if (!profile) {
    return (
      <Screen>
        <Pressable accessibilityLabel="Go back" accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}><Text style={styles.backGlyph}>‹</Text></Pressable>
        <EmptyState description={error || 'This account may no longer be available.'} glyph="?" title="Profile unavailable" />
        <Pressable accessibilityRole="button" onPress={() => { setLoading(true); void refresh(); }} style={styles.retryButton}><Text style={styles.retryLabel}>Try again</Text></Pressable>
      </Screen>
    );
  }

  const profileName = profile.display_name || (profile.handle ? `@${profile.handle}` : 'Community member');

  return (
    <Screen>
      <View style={styles.topRow}>
        <Pressable accessibilityLabel="Go back" accessibilityRole="button" hitSlop={10} onPress={() => router.back()} style={styles.backButton}><Text style={styles.backGlyph}>‹</Text></Pressable>
        <Pill label={isOwnProfile ? 'Your profile' : 'Public profile'} tone="accent" />
        <View style={styles.topSpacer} />
      </View>

      <View style={styles.cover}>
        <View pointerEvents="none" style={styles.coverOrbOne} />
        <View pointerEvents="none" style={styles.coverOrbTwo} />
        <View style={styles.avatarWrap}><Avatar label={profileName} path={profile.avatar_path} size={100} /></View>
        <Text style={styles.name}>{profileName}</Text>
        <Text style={styles.handle}>@{profile.handle ?? 'member'}</Text>
        <View style={styles.metadata}>
          <Text style={styles.locationDot}>●</Text>
          <Muted>{profile.country_code || 'Worldwide'} · {profile.languages.length ? profile.languages.join(' · ') : 'Open to conversation'}</Muted>
        </View>
      </View>

      <Text style={styles.bio}>{profile.bio || 'Here for good conversations and unexpected connections.'}</Text>

      <View style={styles.stats}>
        <Pressable
          accessibilityLabel={`View people ${profileName} follows`}
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/people/connections', params: { userId: profile.id, mode: 'following', name: profileName } })}
          style={styles.stat}
        >
          <Text style={styles.statNumber}>{stats?.following ?? '—'}</Text><Text style={styles.statLabel}>Following</Text>
        </Pressable>
        <Pressable
          accessibilityLabel={`View ${profileName}'s followers`}
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/people/connections', params: { userId: profile.id, mode: 'followers', name: profileName } })}
          style={styles.stat}
        >
          <Text style={styles.statNumber}>{stats?.followers ?? '—'}</Text><Text style={styles.statLabel}>Followers</Text>
        </Pressable>
        <View style={styles.stat}><Text style={styles.statNumber}>{stats?.posts ?? '—'}</Text><Text style={styles.statLabel}>Posts</Text></View>
      </View>

      {isOwnProfile ? (
        <Pressable accessibilityRole="button" onPress={() => router.push('/profile/edit')} style={styles.primaryAction}><Text style={styles.primaryActionLabel}>Edit profile</Text></Pressable>
      ) : (
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: following, disabled: working }}
            disabled={working}
            onPress={() => void toggleFollow()}
            style={[styles.primaryAction, following && styles.followingAction, working && styles.actionDisabled]}
          >
            <Text style={[styles.primaryActionLabel, following && styles.followingLabel]}>{busyAction === 'follow' ? 'Updating…' : following ? 'Following ✓' : 'Follow'}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" disabled={working} onPress={() => void openMessage()} style={[styles.secondaryAction, working && styles.actionDisabled]}><Text style={styles.secondaryActionLabel}>{busyAction === 'message' ? 'Opening…' : 'Message'}</Text></Pressable>
        </View>
      )}

      {!isOwnProfile ? (
        <Pressable
          accessibilityRole="button"
          onPress={openGiftPicker}
          style={styles.giftEntry}
        >
          <View style={styles.giftEntryIcon}><Text style={styles.giftEntryEmoji}>✦</Text></View>
          <View style={styles.giftEntryCopy}><Text style={styles.giftEntryTitle}>Send a virtual gift</Text><Muted>Make the moment memorable—never paywalled, never cashable.</Muted></View>
          <View style={styles.balanceMini}><Text style={styles.balanceMiniValue}>{wallet?.balance ?? '—'}</Text><Text style={styles.balanceMiniLabel}>coins</Text></View>
        </Pressable>
      ) : null}

      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {giftError && !giftModalVisible ? <Text accessibilityRole="alert" style={styles.error}>{giftError}</Text> : null}

      {profileGifts.length > 0 ? (
        <>
          <SectionHeader title="Gifts received" />
          <View style={styles.giftHistory}>
            {profileGifts.slice(0, 6).map((gift) => {
              const senderName = gift.sender_display_name || (gift.sender_handle ? `@${gift.sender_handle}` : 'Community member');
              return (
                <Pressable
                  key={gift.gift_id}
                  accessibilityLabel={`Open ${senderName}'s profile`}
                  accessibilityRole="button"
                  onPress={() => router.push({ pathname: '/people/[userId]', params: { userId: gift.sender_id } })}
                  style={styles.receivedGift}
                >
                  <Text style={styles.receivedEmoji}>{gift.gift_emoji}</Text>
                  <View style={styles.receivedCopy}><Text style={styles.receivedName}>{gift.gift_name}</Text><Text numberOfLines={1} style={styles.receivedSender}>from {senderName}</Text></View>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}

      <SectionHeader title="Recent posts" />
      {posts.length === 0 ? <EmptyState description="When they share something, it will appear here." glyph="✦" title="Nothing posted yet" /> : null}
      <View style={styles.posts}>
        {posts.map((post) => (
          <Pressable
            key={post.id}
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/post/[postId]', params: { postId: post.id, body: post.body, author: profileName, authorId: profile.id } })}
          >
            <Card style={styles.postCard}>
              <View style={styles.postMeta}>{post.topic ? <Pill label={post.topic} /> : <View />}<Text style={styles.time}>{relativeTime(post.created_at)}</Text></View>
              <Text style={styles.postBody}>{post.body}</Text>
              <Text style={styles.openPost}>Open conversation ›</Text>
            </Card>
          </Pressable>
        ))}
      </View>

      {!isOwnProfile ? (
        <View style={styles.safetyRow}>
          <Pressable accessibilityRole="button" disabled={reported} onPress={confirmReport} style={styles.safetyAction}><Text style={styles.reportLabel}>{reported ? 'Reported ✓' : 'Report'}</Text></Pressable>
          <View style={styles.safetyDivider} />
          <Pressable accessibilityRole="button" onPress={confirmBlock} style={styles.safetyAction}><Text style={styles.blockLabel}>Block</Text></Pressable>
        </View>
      ) : null}

      {profileId ? (
        <GiftPicker
          contextKind="profile"
          onClose={() => setGiftModalVisible(false)}
          onSent={(result) => {
            setWallet((current) => current ? { ...current, balance: result.balance, lifetime_spent: current.lifetime_spent + result.coin_cost } : current);
            void loadProfileGifts(profileId).then(setProfileGifts).catch(() => undefined);
          }}
          recipientId={profileId}
          recipientName={profileName}
          visible={giftModalVisible}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { marginTop: 140 },
  topRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  topSpacer: { width: 42 },
  backButton: { alignItems: 'center', backgroundColor: colors.surfaceRaised, borderColor: colors.border, borderRadius: radius.pill, borderWidth: 1, height: 50, justifyContent: 'center', width: 50 },
  backGlyph: { color: colors.text, fontSize: 30, fontWeight: '500', lineHeight: 32 },
  cover: { alignItems: 'center', backgroundColor: colors.surfaceSoft, borderColor: colors.border, borderRadius: radius.xl, borderWidth: 1, marginTop: spacing.xl, overflow: 'hidden', padding: spacing.xl },
  coverOrbOne: { backgroundColor: colors.primaryGlow, borderRadius: 100, height: 180, position: 'absolute', right: -55, top: -90, width: 180 },
  coverOrbTwo: { backgroundColor: colors.accentGlow, borderRadius: 80, bottom: -70, height: 140, left: -45, position: 'absolute', width: 140 },
  avatarWrap: { backgroundColor: colors.primarySoft, borderRadius: 64, marginBottom: spacing.md, padding: 5 },
  name: { color: colors.text, fontSize: 29, fontWeight: '900', letterSpacing: -1, textAlign: 'center' },
  handle: { color: colors.link, fontSize: 14, fontWeight: '800', marginTop: 3 },
  metadata: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  locationDot: { color: colors.accent, fontSize: 9 },
  bio: { color: colors.text, fontSize: 16, lineHeight: 24, marginTop: spacing.xl, textAlign: 'center' },
  stats: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-around', marginVertical: spacing.xl, paddingVertical: spacing.lg },
  stat: { alignItems: 'center', flex: 1, gap: 2 },
  statNumber: { color: colors.text, fontSize: 20, fontWeight: '900', textAlign: 'center' },
  statLabel: { color: colors.textSubtle, fontSize: 12, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: spacing.md },
  primaryAction: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: radius.md, flex: 1, justifyContent: 'center', minHeight: 52, paddingHorizontal: spacing.lg },
  primaryActionLabel: { color: colors.primaryInk, fontSize: 14, fontWeight: '900' },
  followingAction: { backgroundColor: colors.successSoft, borderColor: '#285C49', borderWidth: 1 },
  followingLabel: { color: colors.success },
  actionDisabled: { opacity: 0.55 },
  secondaryAction: { alignItems: 'center', backgroundColor: colors.surfaceRaised, borderColor: colors.borderStrong, borderRadius: radius.md, borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 52, paddingHorizontal: spacing.lg },
  secondaryActionLabel: { color: colors.text, fontSize: 14, fontWeight: '900' },
  giftEntry: { alignItems: 'center', backgroundColor: colors.warningSoft, borderColor: '#6D5520', borderRadius: radius.lg, borderWidth: 1, flexDirection: 'row', gap: spacing.md, marginTop: spacing.md, padding: spacing.md },
  giftEntryIcon: { alignItems: 'center', backgroundColor: colors.surfaceRaised, borderRadius: radius.md, height: 46, justifyContent: 'center', width: 46 },
  giftEntryEmoji: { color: colors.warning, fontSize: 23, fontWeight: '900' },
  giftEntryCopy: { flex: 1, gap: 2 },
  giftEntryTitle: { color: colors.text, fontSize: 14, fontWeight: '900' },
  balanceMini: { alignItems: 'center', backgroundColor: colors.surfaceRaised, borderRadius: radius.md, minWidth: 58, paddingHorizontal: spacing.sm, paddingVertical: 7 },
  balanceMiniValue: { color: colors.warning, fontSize: 17, fontWeight: '900' },
  balanceMiniLabel: { color: colors.textSubtle, fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  error: { color: colors.danger, fontSize: 13, marginTop: spacing.md, textAlign: 'center' },
  giftHistory: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  receivedGift: { alignItems: 'center', backgroundColor: colors.surfaceSoft, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, flexDirection: 'row', gap: spacing.sm, padding: spacing.md, width: '48%' },
  receivedEmoji: { fontSize: 28 },
  receivedCopy: { flex: 1 },
  receivedName: { color: colors.text, fontSize: 12, fontWeight: '900' },
  receivedSender: { color: colors.textSubtle, fontSize: 12, marginTop: 2 },
  posts: { gap: spacing.md },
  postCard: { backgroundColor: colors.surfaceSoft, gap: spacing.md },
  postMeta: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  time: { color: colors.textSubtle, fontSize: 13, fontWeight: '700' },
  postBody: { color: colors.text, fontSize: 16, fontWeight: '600', lineHeight: 23 },
  openPost: { color: colors.link, fontSize: 14, fontWeight: '800' },
  safetyRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'center', marginTop: spacing.xxl },
  safetyAction: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  safetyDivider: { backgroundColor: colors.border, height: 18, width: 1 },
  reportLabel: { color: colors.warning, fontSize: 12, fontWeight: '800' },
  blockLabel: { color: colors.danger, fontSize: 12, fontWeight: '800' },
  retryButton: { alignItems: 'center', alignSelf: 'center', backgroundColor: colors.primary, borderRadius: radius.md, marginTop: spacing.lg, paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  retryLabel: { color: colors.primaryInk, fontSize: 13, fontWeight: '900' },
});
