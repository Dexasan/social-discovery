import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { Avatar, Card, Muted, Pill, Screen } from '@/components/ui';
import { useSession } from '@/context/SessionContext';
import { loadOwnSocialStats, type SocialStats } from '@/features/social/api';
import { isSupabaseConfigured } from '@/lib/supabase';
import { colors, radius, spacing } from '@/theme/tokens';

export default function ProfileScreen() {
  const { profile, signOut, user } = useSession();
  const [stats, setStats] = useState<SocialStats | null>(null);

  useFocusEffect(useCallback(() => {
    let active = true;

    if (!user || !isSupabaseConfigured) {
      setStats({ followers: 0, following: 0, posts: 0 });
      return () => { active = false; };
    }

    void loadOwnSocialStats(user.id)
      .then((nextStats) => { if (active) setStats(nextStats); })
      .catch(() => { if (active) setStats({ followers: 0, following: 0, posts: 0 }); });

    return () => { active = false; };
  }, [user]));

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
          <View style={styles.locationRow}><Text style={styles.locationDot}>●</Text><Muted>{profile.country} · {profile.languages.join(' · ')}</Muted></View>
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
      <Card style={styles.safetyCard}>
        <View style={styles.safetyTop}>
          <View style={styles.safetyIcon}><Text style={styles.safetyGlyph}>✓</Text></View>
          <View style={styles.safetyCopy}><Text style={styles.safetyTitle}>Safety & privacy</Text><Muted>Blocks, reports and message controls</Muted></View>
          <Text style={styles.chevron}>›</Text>
        </View>
        <Pill label={isSupabaseConfigured ? 'Protected account' : 'Local preview'} tone="success" />
      </Card>
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
  cover: { backgroundColor: colors.surfaceSoft, borderColor: colors.border, borderRadius: radius.xl, borderWidth: 1, gap: spacing.md, marginTop: spacing.xs, overflow: 'hidden', padding: spacing.xl },
  coverOrbOne: { backgroundColor: colors.primaryGlow, borderRadius: 90, height: 150, position: 'absolute', right: -30, top: -70, width: 150 },
  coverOrbTwo: { backgroundColor: colors.accentGlow, borderRadius: 60, bottom: -50, height: 110, left: -35, position: 'absolute', width: 110 },
  profileTop: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between' },
  avatarWrap: { backgroundColor: colors.primarySoft, borderRadius: 60, padding: 5 },
  editButton: { backgroundColor: colors.surfaceRaised, borderColor: colors.borderStrong, borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: spacing.lg, paddingVertical: 9 },
  editButtonPressed: { opacity: 0.72, transform: [{ scale: 0.97 }] },
  editLabel: { color: colors.text, fontSize: 12, fontWeight: '800' },
  identity: { gap: spacing.xs },
  name: { color: colors.text, fontSize: 29, fontWeight: '900', letterSpacing: -1 },
  handle: { color: colors.primary, fontSize: 14, fontWeight: '800' },
  locationRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  locationDot: { color: colors.accent, fontSize: 7 },
  bio: { color: colors.text, fontSize: 16, lineHeight: 24, marginTop: spacing.xl },
  stats: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-around', marginVertical: spacing.xl, paddingVertical: spacing.lg },
  stat: { alignItems: 'center', flex: 1, gap: 2 },
  statNumber: { color: colors.text, fontSize: 20, fontWeight: '900', textAlign: 'center' },
  statLabel: { color: colors.textSubtle, fontSize: 10.5, fontWeight: '700' },
  safetyCard: { gap: spacing.md },
  safetyTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  safetyIcon: { alignItems: 'center', backgroundColor: colors.successSoft, borderRadius: radius.md, height: 44, justifyContent: 'center', width: 44 },
  safetyGlyph: { color: colors.success, fontSize: 19, fontWeight: '900' },
  safetyCopy: { flex: 1, gap: 2, marginLeft: spacing.md },
  safetyTitle: { color: colors.text, fontSize: 15, fontWeight: '900' },
  chevron: { color: colors.textSubtle, fontSize: 24 },
  account: { alignItems: 'center', gap: spacing.md, marginTop: spacing.xl },
  signOutButton: { backgroundColor: colors.dangerSoft, borderColor: '#54242D', borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  signOutText: { color: colors.danger, fontSize: 14, fontWeight: '800' },
});
