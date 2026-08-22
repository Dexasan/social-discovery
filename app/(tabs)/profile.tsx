import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { Avatar, Screen } from '@/components/ui';
import { useSession } from '@/context/SessionContext';
import { loadActivityUnreadCount, subscribeToActivity } from '@/features/activity/api';
import { loadCoinWallet, type CoinWallet } from '@/features/gifts/api';
import { loadOwnSocialStats, type SocialStats } from '@/features/social/api';
import { isSupabaseConfigured } from '@/lib/supabase';
import { colors, radius, spacing } from '@/theme/tokens';

function formatDate(value: string | null | undefined, includeDay = true) {
  if (!value) return 'Not set';
  const date = new Date(value.includes('T') ? value : `${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return 'Not set';
  return date.toLocaleDateString(undefined, includeDay
    ? { day: 'numeric', month: 'short', year: 'numeric' }
    : { month: 'short', year: 'numeric' });
}

export default function ProfileScreen() {
  const { profile, signOut, user } = useSession();
  const [stats, setStats] = useState<SocialStats | null>(null);
  const [wallet, setWallet] = useState<CoinWallet | null>(null);
  const [activityUnread, setActivityUnread] = useState(0);

  const refreshActivityUnread = useCallback(() => {
    void loadActivityUnreadCount().then(setActivityUnread).catch(() => setActivityUnread(0));
  }, []);

  useFocusEffect(useCallback(() => {
    let active = true;
    if (!user || !isSupabaseConfigured) {
      setStats({ followers: 0, following: 0, posts: 0 });
      return () => { active = false; };
    }
    void loadOwnSocialStats(user.id).then((nextStats) => { if (active) setStats(nextStats); }).catch(() => { if (active) setStats({ followers: 0, following: 0, posts: 0 }); });
    void loadCoinWallet().then((nextWallet) => { if (active) setWallet(nextWallet); }).catch(() => { if (active) setWallet(null); });
    refreshActivityUnread();
    return () => { active = false; };
  }, [refreshActivityUnread, user]));

  useEffect(() => {
    if (!user || !isSupabaseConfigured) return;
    return subscribeToActivity(user.id, refreshActivityUnread);
  }, [refreshActivityUnread, user]);

  if (!profile) return null;

  const metadata = [
    { label: 'Birthday', value: formatDate(profile.birthDate) },
    { label: 'Languages', value: profile.languages.join(', ') || 'Not set' },
    { label: 'From', value: profile.country || 'Worldwide' },
    { label: 'Joined', value: formatDate(user?.created_at, false) },
  ];

  return (
    <Screen>
      <View style={styles.topBar}>
        <View><Text style={styles.topName}>{profile.displayName}</Text><Text style={styles.topHandle}>@{profile.handle}</Text></View>
        <View style={styles.topActions}>
          <Pressable accessibilityLabel="Activity" onPress={() => router.push('/activity')} style={styles.iconButton}>
            <Text style={styles.iconGlyph}>✦</Text>
            {activityUnread > 0 ? <View style={styles.notificationBadge}><Text style={styles.notificationText}>{Math.min(activityUnread, 9)}</Text></View> : null}
          </Pressable>
          <Pressable accessibilityLabel="Account settings" onPress={() => router.push('/settings/account')} style={styles.iconButton}><Text style={styles.iconGlyph}>⚙</Text></Pressable>
        </View>
      </View>

      <View style={styles.profileHeader}>
        <Avatar label={profile.displayName} path={profile.avatarPath} size={78} />
        <View style={styles.profileCopy}>
          <Text style={styles.bio}>{profile.bio || 'Here for good conversations and unexpected connections.'}</Text>
          <Pressable accessibilityRole="button" onPress={() => router.push('/profile/edit')} style={styles.editButton}><Text style={styles.editLabel}>Edit profile</Text></Pressable>
        </View>
      </View>

      <View style={styles.stats}>
        <Pressable onPress={() => user && router.push({ pathname: '/people/connections', params: { userId: user.id, mode: 'following', name: profile.displayName } })} style={styles.stat}>
          <Text style={styles.statNumber}>{stats?.following ?? '—'}</Text><Text style={styles.statLabel}>Following</Text>
        </Pressable>
        <View style={styles.statDivider} />
        <Pressable onPress={() => user && router.push({ pathname: '/people/connections', params: { userId: user.id, mode: 'followers', name: profile.displayName } })} style={styles.stat}>
          <Text style={styles.statNumber}>{stats?.followers ?? '—'}</Text><Text style={styles.statLabel}>Followers</Text>
        </Pressable>
        <View style={styles.statDivider} />
        <View style={styles.stat}><Text style={styles.statNumber}>{stats?.posts ?? '—'}</Text><Text style={styles.statLabel}>Posts</Text></View>
      </View>

      <View style={styles.metadataGrid}>
        {metadata.map((item) => (
          <View key={item.label} style={styles.metadataItem}>
            <Text style={styles.metadataLabel}>{item.label}</Text>
            <Text numberOfLines={2} style={styles.metadataValue}>{item.value}</Text>
          </View>
        ))}
      </View>

      <View style={styles.quickGrid}>
        <Pressable onPress={() => router.push('/activity')} style={[styles.quickTile, styles.quickCobalt]}>
          <Text style={styles.quickGlyph}>✦</Text><Text style={styles.quickTitle}>Activity</Text><Text style={styles.quickMeta}>{activityUnread > 0 ? `${activityUnread} new` : 'All caught up'}</Text>
        </Pressable>
        <View style={[styles.quickTile, styles.quickWarm]}>
          <Text style={styles.quickGlyph}>◎</Text><Text style={styles.quickTitle}>Coins</Text><Text style={styles.quickMeta}>{wallet ? `${wallet.balance} available` : 'Wallet'}</Text>
        </View>
        <Pressable onPress={() => router.push('/settings/safety')} style={[styles.quickTile, styles.quickGreen]}>
          <Text style={styles.quickGlyph}>✓</Text><Text style={styles.quickTitle}>Safety</Text><Text style={styles.quickMeta}>Privacy & blocks</Text>
        </Pressable>
        <Pressable onPress={() => router.push({ pathname: '/legal/[document]', params: { document: 'community-guidelines' } })} style={styles.quickTile}>
          <Text style={styles.quickGlyph}>§</Text><Text style={styles.quickTitle}>Guidelines</Text><Text style={styles.quickMeta}>Community rules</Text>
        </Pressable>
      </View>

      <View style={styles.accountFooter}>
        <Text numberOfLines={1} style={styles.email}>{user?.email ?? 'Authenticated account'}</Text>
        <Pressable accessibilityRole="button" onPress={() => void signOut()} style={styles.signOutButton}><Text style={styles.signOutText}>Sign out</Text></Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  topName: { color: colors.text, fontSize: 24, fontWeight: '900', letterSpacing: -0.7 },
  topHandle: { color: colors.textMuted, fontSize: 14, marginTop: 2 },
  topActions: { flexDirection: 'row', gap: spacing.sm },
  iconButton: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 17, borderWidth: 1, height: 46, justifyContent: 'center', width: 46 },
  iconGlyph: { color: colors.text, fontSize: 19, fontWeight: '800' },
  notificationBadge: { alignItems: 'center', backgroundColor: colors.accent, borderColor: colors.background, borderRadius: 9, borderWidth: 2, height: 18, justifyContent: 'center', position: 'absolute', right: -3, top: -3, width: 18 },
  notificationText: { color: colors.white, fontSize: 10, fontWeight: '900' },
  profileHeader: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.lg, marginTop: spacing.xl },
  profileCopy: { flex: 1, gap: spacing.md },
  bio: { color: colors.text, fontSize: 16, lineHeight: 23 },
  editButton: { alignItems: 'center', alignSelf: 'flex-start', borderColor: colors.borderStrong, borderRadius: radius.pill, borderWidth: 1, minHeight: 38, justifyContent: 'center', paddingHorizontal: spacing.lg },
  editLabel: { color: colors.text, fontSize: 13, fontWeight: '900' },
  stats: { alignItems: 'center', borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', marginTop: spacing.xl, paddingVertical: spacing.lg },
  stat: { alignItems: 'center', flex: 1, gap: 2 },
  statDivider: { backgroundColor: colors.border, height: 27, width: StyleSheet.hairlineWidth },
  statNumber: { color: colors.text, fontSize: 19, fontWeight: '900' },
  statLabel: { color: colors.textSubtle, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  metadataGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.xl },
  metadataItem: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 18, borderWidth: 1, minHeight: 82, padding: spacing.md, width: '47.8%' },
  metadataLabel: { color: colors.textSubtle, fontSize: 11, fontWeight: '900', letterSpacing: 0.7, textTransform: 'uppercase' },
  metadataValue: { color: colors.text, fontSize: 15, fontWeight: '800', lineHeight: 20, marginTop: 7 },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.xl },
  quickTile: { backgroundColor: colors.surfaceRaised, borderColor: colors.border, borderRadius: 20, borderWidth: 1, minHeight: 126, padding: spacing.lg, width: '47.8%' },
  quickCobalt: { backgroundColor: colors.cobaltSoft, borderColor: '#34458F' },
  quickWarm: { backgroundColor: colors.warningSoft, borderColor: '#6D5520' },
  quickGreen: { backgroundColor: colors.signalSoft, borderColor: '#3B5421' },
  quickGlyph: { color: colors.text, fontSize: 21, fontWeight: '900' },
  quickTitle: { color: colors.text, fontSize: 16, fontWeight: '900', marginTop: 12 },
  quickMeta: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  accountFooter: { alignItems: 'center', borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: spacing.md, justifyContent: 'space-between', marginTop: spacing.xl, paddingTop: spacing.lg },
  email: { color: colors.textSubtle, flex: 1, fontSize: 13 },
  signOutButton: { borderColor: '#603128', borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: spacing.lg, paddingVertical: 10 },
  signOutText: { color: colors.danger, fontSize: 13, fontWeight: '900' },
});
