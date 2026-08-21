import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { Avatar, Card, Muted, Pill, Screen } from '@/components/ui';
import { useSession } from '@/context/SessionContext';
import { loadActivityUnreadCount, subscribeToActivity } from '@/features/activity/api';
import { loadCoinWallet, type CoinWallet } from '@/features/gifts/api';
import { loadOwnSocialStats, type SocialStats } from '@/features/social/api';
import { isSupabaseConfigured } from '@/lib/supabase';
import { colors, radius, spacing } from '@/theme/tokens';

export default function ProfileScreen() {
  const { profile, signOut, user } = useSession();
  const [stats, setStats] = useState<SocialStats | null>(null);
  const [wallet, setWallet] = useState<CoinWallet | null>(null);
  const [activityUnread, setActivityUnread] = useState(0);

  const refreshActivityUnread = useCallback(() => {
    void loadActivityUnreadCount()
      .then(setActivityUnread)
      .catch(() => setActivityUnread(0));
  }, []);

  useFocusEffect(useCallback(() => {
    let active = true;

    if (!user || !isSupabaseConfigured) {
      setStats({ followers: 0, following: 0, posts: 0 });
      return () => { active = false; };
    }

    void loadOwnSocialStats(user.id)
      .then((nextStats) => { if (active) setStats(nextStats); })
      .catch(() => { if (active) setStats({ followers: 0, following: 0, posts: 0 }); });
    void loadCoinWallet()
      .then((nextWallet) => { if (active) setWallet(nextWallet); })
      .catch(() => { if (active) setWallet(null); });
    refreshActivityUnread();

    return () => { active = false; };
  }, [refreshActivityUnread, user]));

  useEffect(() => {
    if (!user || !isSupabaseConfigured) return;
    return subscribeToActivity(user.id, refreshActivityUnread);
  }, [refreshActivityUnread, user]);

  if (!profile) return null;

  return (
    <Screen>
      <View style={styles.cover}>
        <View style={styles.coverOrbOne} /><View style={styles.coverOrbTwo} />
        <View style={styles.profileTop}>
          <View style={styles.avatarWrap}><Avatar label={profile.displayName} size={96} /></View>
          <Pressable
            accessibilityLabel="Edit profile"
            accessibilityRole="button"
            onPress={() => router.push('/profile/edit')}
            style={({ pressed }) => [styles.editButton, pressed && styles.editButtonPressed]}
          >
            <Text style={styles.editLabel}>Edit profile</Text>
          </Pressable>
        </View>
        <View style={styles.identity}>
          <Text style={styles.name}>{profile.displayName}</Text>
          <Text style={styles.handle}>@{profile.handle}</Text>
          <View style={styles.locationRow}><Text style={styles.locationDot}>●</Text><Muted style={styles.locationText}>{profile.country} · {profile.languages.join(' · ')}</Muted></View>
        </View>
      </View>
      <Text style={styles.bio}>{profile.bio || 'Here for good conversations and unexpected connections.'}</Text>
      <View style={styles.stats}>
        <Pressable
          accessibilityLabel="View people you follow"
          accessibilityRole="button"
          onPress={() => user && router.push({ pathname: '/people/connections', params: { userId: user.id, mode: 'following', name: profile.displayName } })}
          style={styles.stat}
        >
          <Text style={styles.statNumber}>{stats?.following ?? '—'}</Text><Text style={styles.statLabel}>Following</Text>
        </Pressable>
        <Pressable
          accessibilityLabel="View your followers"
          accessibilityRole="button"
          onPress={() => user && router.push({ pathname: '/people/connections', params: { userId: user.id, mode: 'followers', name: profile.displayName } })}
          style={styles.stat}
        >
          <Text style={styles.statNumber}>{stats?.followers ?? '—'}</Text><Text style={styles.statLabel}>Followers</Text>
        </Pressable>
        <View style={styles.stat}><Text style={styles.statNumber}>{stats?.posts ?? '—'}</Text><Text style={styles.statLabel}>Posts</Text></View>
      </View>
      {wallet ? (
        <Card style={styles.walletCard}>
          <View style={styles.coinIcon}><Text style={styles.coinGlyph}>✦</Text></View>
          <View style={styles.walletCopy}>
            <Text style={styles.walletTitle}>Your coin wallet</Text>
            <Muted>Send virtual gifts to people who make the app better.</Muted>
          </View>
          <View style={styles.balanceBadge}><Text style={styles.balance}>{wallet.balance}</Text><Text style={styles.balanceLabel}>coins</Text></View>
        </Card>
      ) : null}
      <Pressable accessibilityRole="button" onPress={() => router.push('/activity')} style={({ pressed }) => pressed && styles.safetyPressed}>
        <Card style={[styles.activityCard, activityUnread > 0 && styles.activityCardUnread]}>
          <View style={styles.safetyTop}>
            <View style={styles.activityIcon}><Text style={styles.activityGlyph}>✦</Text></View>
            <View style={styles.safetyCopy}>
              <Text style={styles.safetyTitle}>Activity</Text>
              <Muted>{activityUnread > 0 ? `${activityUnread} new interaction${activityUnread === 1 ? '' : 's'}` : 'Follows, replies, likes, and gifts'}</Muted>
            </View>
            {activityUnread > 0 ? <View style={styles.activityBadge}><Text style={styles.activityBadgeText}>{Math.min(activityUnread, 99)}</Text></View> : <Text style={styles.chevron}>›</Text>}
          </View>
        </Card>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => router.push('/settings/safety')} style={({ pressed }) => pressed && styles.safetyPressed}>
        <Card style={styles.safetyCard}>
          <View style={styles.safetyTop}>
            <View style={styles.safetyIcon}><Text style={styles.safetyGlyph}>✓</Text></View>
            <View style={styles.safetyCopy}><Text style={styles.safetyTitle}>Safety & privacy</Text><Muted>Blocks, reports and message controls</Muted></View>
            <Text style={styles.chevron}>›</Text>
          </View>
          <Pill label={isSupabaseConfigured ? 'Protected account' : 'Local preview'} tone="success" />
        </Card>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push({ pathname: '/legal/[document]', params: { document: 'community-guidelines' } })}
        style={({ pressed }) => pressed && styles.safetyPressed}
      >
        <Card style={styles.policyCard}>
          <View style={styles.safetyTop}>
            <View style={styles.policyIcon}><Text style={styles.policyGlyph}>§</Text></View>
            <View style={styles.safetyCopy}><Text style={styles.safetyTitle}>Rules & policies</Text><Muted>Terms, privacy, and community standards</Muted></View>
            <Text style={styles.chevron}>›</Text>
          </View>
        </Card>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => router.push('/settings/account')} style={({ pressed }) => pressed && styles.safetyPressed}>
        <Card style={styles.accountSettingsCard}>
          <View style={styles.safetyTop}>
            <View style={styles.accountSettingsIcon}><Text style={styles.accountSettingsGlyph}>@</Text></View>
            <View style={styles.safetyCopy}><Text style={styles.safetyTitle}>Account settings</Text><Muted>Password, account details, and deletion</Muted></View>
            <Text style={styles.chevron}>›</Text>
          </View>
        </Card>
      </Pressable>
      <View style={styles.account}>
        <Muted>Signed in as {user?.email ?? 'authenticated user'}</Muted>
        <Pressable accessibilityRole="button" onPress={() => void signOut()} style={styles.signOutButton}>
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cover: { backgroundColor: colors.primary, borderColor: colors.primary, borderRadius: 34, borderWidth: 1, gap: spacing.md, marginTop: spacing.xs, overflow: 'hidden', padding: spacing.xl },
  coverOrbOne: { backgroundColor: colors.primaryGlow, borderRadius: 90, height: 150, position: 'absolute', right: -30, top: -70, width: 150 },
  coverOrbTwo: { backgroundColor: colors.accentGlow, borderRadius: 60, bottom: -50, height: 110, left: -35, position: 'absolute', width: 110 },
  profileTop: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between' },
  avatarWrap: { backgroundColor: colors.signal, borderRadius: 34, padding: 7, transform: [{ rotate: '-4deg' }] },
  editButton: { backgroundColor: colors.signal, borderColor: colors.signal, borderRadius: 16, borderWidth: 1, minHeight: 46, paddingHorizontal: spacing.lg, paddingVertical: 11, transform: [{ rotate: '3deg' }] },
  editButtonPressed: { opacity: 0.72, transform: [{ scale: 0.97 }] },
  editLabel: { color: colors.text, fontSize: 14, fontWeight: '900' },
  identity: { gap: spacing.xs },
  name: { color: colors.white, fontSize: 34, fontWeight: '900', letterSpacing: -1.4 },
  handle: { color: colors.signal, fontSize: 16, fontWeight: '900' },
  locationRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  locationDot: { color: colors.accent, fontSize: 8 },
  locationText: { color: '#C9C7C0', fontSize: 14 },
  bio: { color: colors.text, fontSize: 19, fontWeight: '600', lineHeight: 28, marginTop: spacing.xl },
  stats: { backgroundColor: colors.signal, borderColor: '#B8E346', borderRadius: 24, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-around', marginVertical: spacing.xl, paddingVertical: 20, transform: [{ rotate: '-0.5deg' }] },
  stat: { alignItems: 'center', flex: 1, gap: 2 },
  statNumber: { color: colors.text, fontSize: 24, fontWeight: '900', textAlign: 'center' },
  statLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  walletCard: { alignItems: 'center', backgroundColor: '#FFF0CF', borderColor: '#F2D89D', flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  coinIcon: { alignItems: 'center', backgroundColor: colors.warningSoft, borderRadius: radius.pill, height: 46, justifyContent: 'center', width: 46 },
  coinGlyph: { color: colors.warning, fontSize: 22, fontWeight: '900' },
  walletCopy: { flex: 1, gap: 2 },
  walletTitle: { color: colors.text, fontSize: 17, fontWeight: '900' },
  balanceBadge: { alignItems: 'center', backgroundColor: colors.surfaceRaised, borderRadius: radius.md, minWidth: 62, paddingHorizontal: spacing.sm, paddingVertical: 8 },
  balance: { color: colors.warning, fontSize: 19, fontWeight: '900' },
  balanceLabel: { color: colors.textSubtle, fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  safetyCard: { gap: spacing.md },
  policyCard: { marginTop: spacing.md },
  accountSettingsCard: { marginTop: spacing.md },
  accountSettingsIcon: { alignItems: 'center', backgroundColor: colors.surfaceRaised, borderRadius: radius.md, height: 44, justifyContent: 'center', width: 44 },
  accountSettingsGlyph: { color: colors.cobalt, fontSize: 19, fontWeight: '900' },
  policyIcon: { alignItems: 'center', backgroundColor: colors.surfaceRaised, borderRadius: radius.md, height: 44, justifyContent: 'center', width: 44 },
  policyGlyph: { color: colors.textMuted, fontSize: 18, fontWeight: '900' },
  activityCard: { marginBottom: spacing.md },
  activityCardUnread: { backgroundColor: colors.accentSoft, borderColor: '#FFB9A7' },
  activityIcon: { alignItems: 'center', backgroundColor: colors.cobaltSoft, borderRadius: radius.md, height: 50, justifyContent: 'center', width: 50 },
  activityGlyph: { color: colors.cobalt, fontSize: 21, fontWeight: '900' },
  activityBadge: { alignItems: 'center', backgroundColor: colors.accent, borderRadius: 14, height: 30, justifyContent: 'center', minWidth: 30, paddingHorizontal: 7 },
  activityBadgeText: { color: colors.white, fontSize: 12, fontWeight: '900' },
  safetyPressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
  safetyTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  safetyIcon: { alignItems: 'center', backgroundColor: colors.successSoft, borderRadius: radius.md, height: 44, justifyContent: 'center', width: 44 },
  safetyGlyph: { color: colors.success, fontSize: 19, fontWeight: '900' },
  safetyCopy: { flex: 1, gap: 2, marginLeft: spacing.md },
  safetyTitle: { color: colors.text, fontSize: 17, fontWeight: '900' },
  chevron: { color: colors.textSubtle, fontSize: 24 },
  account: { alignItems: 'center', gap: spacing.md, marginTop: spacing.xl },
  signOutButton: { backgroundColor: colors.dangerSoft, borderColor: '#F2B8C5', borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  signOutText: { color: colors.danger, fontSize: 16, fontWeight: '800' },
});
