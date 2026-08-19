import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar, Card, Muted, Pill, Screen } from '@/components/ui';
import { useSession } from '@/context/SessionContext';
import { isSupabaseConfigured } from '@/lib/supabase';
import { colors, spacing } from '@/theme/tokens';

export default function ProfileScreen() {
  const { profile, signOut, user } = useSession();

  if (!profile) return null;

  return (
    <Screen>
      <View style={styles.hero}>
        <Avatar label={profile.displayName} size={92} />
        <View style={styles.identity}>
          <Text style={styles.name}>{profile.displayName}</Text>
          <Text style={styles.handle}>@{profile.handle}</Text>
          <Muted>{profile.country} · {profile.languages.join(' · ')}</Muted>
        </View>
      </View>
      <Text style={styles.bio}>{profile.bio}</Text>
      <View style={styles.stats}>
        <View><Text style={styles.statNumber}>0</Text><Muted>Following</Muted></View>
        <View><Text style={styles.statNumber}>0</Text><Muted>Followers</Muted></View>
        <View><Text style={styles.statNumber}>0</Text><Muted>Posts</Muted></View>
      </View>
      <Card style={styles.safetyCard}>
        <View style={styles.safetyTop}>
          <Text style={styles.safetyTitle}>Safety center</Text>
          <Pill label={isSupabaseConfigured ? 'Backend connected' : 'Local preview'} />
        </View>
        <Muted>Manage blocked accounts, reports, message permissions, and community rules.</Muted>
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
  hero: { alignItems: 'center', flexDirection: 'row', gap: spacing.lg, marginTop: spacing.md },
  identity: { flex: 1, gap: spacing.xs },
  name: { color: colors.text, fontSize: 28, fontWeight: '900' },
  handle: { color: colors.primary, fontSize: 14, fontWeight: '700' },
  bio: { color: colors.text, fontSize: 17, lineHeight: 25, marginTop: spacing.xl },
  stats: { borderBottomColor: colors.border, borderBottomWidth: 1, borderTopColor: colors.border, borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-around', marginVertical: spacing.xl, paddingVertical: spacing.lg },
  statNumber: { color: colors.text, fontSize: 20, fontWeight: '900', textAlign: 'center' },
  safetyCard: { gap: spacing.md },
  safetyTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  safetyTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  account: { alignItems: 'center', gap: spacing.md, marginTop: spacing.xl },
  signOutButton: { borderColor: colors.border, borderRadius: 12, borderWidth: 1, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  signOutText: { color: colors.danger, fontSize: 14, fontWeight: '800' },
});
