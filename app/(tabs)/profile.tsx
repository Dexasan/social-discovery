import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import type { Href } from 'expo-router';

import { Avatar, Screen } from '@/components/ui';
import { useSession } from '@/context/SessionContext';
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

  useFocusEffect(useCallback(() => {
    let active = true;
    if (!user || !isSupabaseConfigured) {
      setStats({ followers: 0, following: 0, posts: 0 });
      return () => { active = false; };
    }
    void loadOwnSocialStats(user.id).then((nextStats) => { if (active) setStats(nextStats); }).catch(() => { if (active) setStats({ followers: 0, following: 0, posts: 0 }); });
    void loadCoinWallet().then((nextWallet) => { if (active) setWallet(nextWallet); }).catch(() => { if (active) setWallet(null); });
    return () => { active = false; };
  }, [user]));

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
        <Pressable accessibilityLabel="Account settings" onPress={() => router.push('/settings/account')} style={styles.iconButton}><Text style={styles.iconGlyph}>⚙</Text></Pressable>
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

      <Pressable accessibilityRole="button" onPress={() => router.push('/wallet' as Href)} style={styles.walletStrip}>
        <View><Text style={styles.walletKicker}>YAPPIE WALLET</Text><Text style={styles.walletTitle}>{wallet ? `${wallet.balance} coins` : 'Your coins'}</Text><Text style={styles.walletMeta}>Small gifts for conversations worth remembering</Text></View>
        <View style={styles.walletArrow}><Text style={styles.walletArrowText}>›</Text></View>
      </Pressable>

      <View style={styles.utilityRow}>
        <Pressable onPress={() => router.push('/settings/safety')} style={styles.utilityButton}>
          <Text style={styles.utilityGlyph}>✓</Text><View style={styles.utilityCopy}><Text style={styles.utilityTitle}>Safety</Text><Text style={styles.utilityMeta}>Privacy & blocks</Text></View>
        </Pressable>
        <Pressable onPress={() => router.push({ pathname: '/legal/[document]', params: { document: 'community-guidelines' } })} style={styles.utilityButton}>
          <Text style={styles.utilityGlyph}>§</Text><View style={styles.utilityCopy}><Text style={styles.utilityTitle}>Guidelines</Text><Text style={styles.utilityMeta}>How YAPPIE works</Text></View>
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
  iconButton: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 17, borderWidth: 1, height: 46, justifyContent: 'center', width: 46 },
  iconGlyph: { color: colors.text, fontSize: 19, fontWeight: '800' },
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
  walletStrip: { alignItems: 'center', backgroundColor: colors.warningSoft, borderColor: '#6D5520', borderRadius: radius.lg, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xl, minHeight: 122, padding: spacing.lg },
  walletKicker: { color: colors.warning, fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  walletTitle: { color: colors.text, fontSize: 25, fontWeight: '900', letterSpacing: -0.6, marginTop: 7 },
  walletMeta: { color: colors.textMuted, fontSize: 12, marginTop: 4, maxWidth: 250 },
  walletArrow: { alignItems: 'center', backgroundColor: colors.warning, borderRadius: radius.pill, height: 42, justifyContent: 'center', width: 42 },
  walletArrowText: { color: colors.black, fontSize: 28, fontWeight: '700', lineHeight: 30 },
  utilityRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  utilityButton: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, flex: 1, flexDirection: 'row', gap: spacing.sm, minHeight: 78, padding: spacing.md },
  utilityGlyph: { color: colors.signal, fontSize: 20, fontWeight: '900' },
  utilityCopy: { flex: 1 },
  utilityTitle: { color: colors.text, fontSize: 14, fontWeight: '900' },
  utilityMeta: { color: colors.textSubtle, fontSize: 10, marginTop: 3 },
  accountFooter: { alignItems: 'center', borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: spacing.md, justifyContent: 'space-between', marginTop: spacing.xl, paddingTop: spacing.lg },
  email: { color: colors.textSubtle, flex: 1, fontSize: 13 },
  signOutButton: { borderColor: '#603128', borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: spacing.lg, paddingVertical: 10 },
  signOutText: { color: colors.danger, fontSize: 13, fontWeight: '900' },
});
