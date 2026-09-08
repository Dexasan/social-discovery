import { Text } from '@/components/Typography';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import type { Href } from 'expo-router';

import { GiftArtwork } from '@/components/GiftArtwork';
import { Avatar, RetroGlyph, RetroHeader, Screen } from '@/components/ui';
import { useSession } from '@/context/SessionContext';
import { formatUsd, giftCheckoutEnabled, loadEarningsWallet, loadProfileGifts, type EarningsWallet, type ProfileGift } from '@/features/gifts/api';
import { loadOwnSocialStats, type SocialStats } from '@/features/social/api';
import { isSupabaseConfigured } from '@/lib/supabase';
import { colors, fonts, radius, spacing } from '@/theme/tokens';

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
  const checkoutEnabled = giftCheckoutEnabled();
  const [stats, setStats] = useState<SocialStats | null>(null);
  const [wallet, setWallet] = useState<EarningsWallet | null>(null);
  const [receivedGifts, setReceivedGifts] = useState<ProfileGift[]>([]);

  useFocusEffect(useCallback(() => {
    let active = true;
    if (!user || !isSupabaseConfigured) {
      setStats({ followers: 0, following: 0, posts: 0 });
      setReceivedGifts([]);
      return () => { active = false; };
    }
    void loadOwnSocialStats(user.id).then((nextStats) => { if (active) setStats(nextStats); }).catch(() => { if (active) setStats({ followers: 0, following: 0, posts: 0 }); });
    if (checkoutEnabled) {
      void loadEarningsWallet().then((nextWallet) => { if (active) setWallet(nextWallet); }).catch(() => { if (active) setWallet(null); });
    } else {
      setWallet(null);
    }
    void loadProfileGifts(user.id).then((gifts) => { if (active) setReceivedGifts(gifts); }).catch(() => { if (active) setReceivedGifts([]); });
    return () => { active = false; };
  }, [checkoutEnabled, user]));

  if (!profile) return null;

  const metadata = [
    { glyph: '✦', label: 'Birthday', value: formatDate(profile.birthDate) },
    { glyph: '⌁', label: 'Languages', value: profile.languages.join(', ') || 'Not set' },
    { glyph: '⌖', label: 'From', value: profile.country || 'Worldwide' },
    { glyph: '◷', label: 'Joined', value: formatDate(user?.created_at, false) },
  ];

  return (
    <Screen>
      <RetroHeader
        action={<Pressable accessibilityLabel="Account settings" onPress={() => router.push('/settings/account')}><RetroGlyph glyph="⚙" tone="neutral" /></Pressable>}
        eyebrow="A LITTLE MORE YOU"
        title="Your profile"
        tone="accent"
      />

      <View style={styles.profileHeader}>
        <View pointerEvents="none" style={styles.cover}><View style={styles.coverCircle} /><View style={styles.coverOrbit} /></View>
        <View style={styles.avatarFrame}><Avatar label={profile.displayName} path={profile.avatarPath} size={110} /></View>
        <Text style={styles.profileName}>{profile.displayName}</Text>
        <Text style={styles.profileHandle}>@{profile.handle}</Text>
        <Text style={styles.bio}>{profile.bio || 'Here for good conversations and unexpected connections.'}</Text>
        <Pressable accessibilityRole="button" onPress={() => router.push('/profile/edit')} style={styles.editButton}><Text style={styles.editLabel}>Edit profile</Text></Pressable>
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
            <View style={styles.metadataTop}><RetroGlyph glyph={item.glyph} size="sm" tone="neutral" /><Text style={styles.metadataLabel}>{item.label}</Text></View>
            <Text numberOfLines={2} style={styles.metadataValue}>{item.value}</Text>
          </View>
        ))}
      </View>

      <Pressable accessibilityRole="button" onPress={() => router.push('/wallet' as Href)} style={styles.walletStrip}>
        <View style={{ flex: 1 }}>
          <Text style={styles.walletKicker}>{checkoutEnabled ? 'GIFT EARNINGS' : 'GIFT LAB · FREE BETA'}</Text>
          <Text style={styles.walletTitle}>{checkoutEnabled ? wallet ? formatUsd(wallet.available_cents) : 'Your wallet' : 'Preview the collection'}</Text>
          <Text style={styles.walletMeta}>{checkoutEnabled ? wallet?.pending_cents ? `${formatUsd(wallet.pending_cents)} pending · withdraw at $100` : receivedGifts.length ? `${receivedGifts.length} recent gift${receivedGifts.length === 1 ? '' : 's'} received` : 'Half of every gift goes to you' : 'Little ways to make someone’s day. Coming after beta.'}</Text>
        </View>
        <RetroGlyph glyph="›" tone="warning" />
      </Pressable>

      <View style={styles.giftsSection}>
        <View style={styles.giftsHeader}>
          <View style={styles.giftsTitleRow}><RetroGlyph glyph="✦" size="sm" tone="warning" /><View><Text style={styles.giftsTitle}>{checkoutEnabled ? 'Gifts received' : 'Gift archive'}</Text><Text style={styles.giftsMeta}>{checkoutEnabled ? 'Sent your way' : 'Preview mode'}</Text></View></View>
          <Pressable accessibilityRole="button" onPress={() => router.push('/wallet' as Href)}><Text style={styles.giftsLink}>View all</Text></Pressable>
        </View>
        {receivedGifts.length ? (
          <View style={styles.giftRow}>
            {receivedGifts.slice(0, 3).map((gift) => {
              const sender = gift.sender_display_name || (gift.sender_handle ? `@${gift.sender_handle}` : 'Someone');
              return (
                <Pressable
                  key={gift.gift_id}
                  accessibilityLabel={`${gift.gift_name} from ${sender}`}
                  onPress={() => router.push({ pathname: '/people/[userId]', params: { userId: gift.sender_id } })}
                  style={styles.giftCard}
                >
                  <GiftArtwork size={52} slug={gift.gift_slug} />
                  <Text numberOfLines={1} style={styles.giftName}>{gift.gift_name}</Text>
                  <Text numberOfLines={1} style={styles.giftSender}>from {sender}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <Pressable accessibilityRole="button" onPress={() => router.push('/wallet' as Href)} style={styles.noGifts}>
            <Text style={styles.noGiftsEmoji}>✦</Text><Text style={styles.noGiftsText}>{checkoutEnabled ? 'Your received gifts will appear here.' : 'A little something, just for you. Explore the upcoming collection.'}</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.utilityRow}>
        <Pressable onPress={() => router.push('/settings/safety')} style={styles.utilityButton}>
          <RetroGlyph glyph="✓" size="sm" /><View style={styles.utilityCopy}><Text style={styles.utilityTitle}>Safety</Text><Text style={styles.utilityMeta}>Privacy & blocks</Text></View>
        </Pressable>
        <Pressable onPress={() => router.push({ pathname: '/legal/[document]', params: { document: 'community-guidelines' } })} style={styles.utilityButton}>
          <RetroGlyph glyph="§" size="sm" tone="cobalt" /><View style={styles.utilityCopy}><Text style={styles.utilityTitle}>Guidelines</Text><Text style={styles.utilityMeta}>How YAPPIE works</Text></View>
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
  cover: { backgroundColor: colors.accentSolid, height: 108, left: 0, position: 'absolute', right: 0, top: 0, overflow: 'hidden' },
  coverCircle: { borderColor: colors.primary, borderRadius: 100, borderWidth: 28, height: 180, position: 'absolute', right: -32, top: -85, width: 180 },
  coverOrbit: { borderColor: colors.primary, borderRadius: 100, borderWidth: 3, height: 150, left: -28, position: 'absolute', top: 32, transform: [{ rotate: '-30deg' }], width: 230 },
  profileHeader: { alignItems: 'center', borderBottomColor: colors.primary, borderBottomWidth: 1.5, marginTop: 20, overflow: 'hidden', padding: 24, position: 'relative' },
  avatarFrame: { marginTop: 26, position: 'relative' },
  profileName: { color: colors.text, fontFamily: fonts.display, fontSize: 46, lineHeight: 50, letterSpacing: -0.5, marginTop: 16, textTransform: 'uppercase' },
  profileHandle: { color: colors.textMuted, fontSize: 14, marginTop: 2 },
  bio: { color: colors.text, fontFamily: fonts.italic, fontSize: 24, lineHeight: 28, marginTop: 12, maxWidth: 310, textAlign: 'center' },
  editButton: { alignItems: 'center', borderColor: colors.primary, borderRadius: 3, borderWidth: 1, justifyContent: 'center', marginTop: 18, minHeight: 44, paddingHorizontal: 28 },
  editLabel: { color: colors.text, fontSize: 13, fontWeight: '700' },
  stats: { alignItems: 'center', borderBottomColor: colors.primary, borderBottomWidth: 1.5, flexDirection: 'row', paddingVertical: 20 },
  stat: { alignItems: 'center', flex: 1, gap: 2 },
  statDivider: { backgroundColor: colors.border, height: 27, width: StyleSheet.hairlineWidth },
  statNumber: { color: colors.text, fontFamily: fonts.display, fontSize: 36 },
  statLabel: { color: colors.textSubtle, fontSize: 12, fontWeight: '500' },
  metadataGrid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: '4%', rowGap: 12, marginTop: 24 },
  metadataItem: { borderBottomColor: colors.border, borderBottomWidth: 1, minHeight: 96, paddingVertical: 12, width: '48%' },
  metadataTop: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  metadataLabel: { color: colors.textSubtle, flex: 1, fontSize: 11, fontWeight: '500' },
  metadataValue: { color: colors.text, fontSize: 14, fontWeight: '600', lineHeight: 21, marginTop: 10 },
  walletStrip: { alignItems: 'center', backgroundColor: colors.warningSoft, borderColor: colors.primary, borderRadius: 4, borderWidth: 1, flexDirection: 'row', gap: 12, justifyContent: 'space-between', marginTop: 24, padding: 20 },
  walletKicker: { color: colors.cobalt, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  walletTitle: { color: colors.text, fontFamily: fonts.editorial, fontSize: 31, marginTop: 8 },
  walletMeta: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: 6 },
  giftsSection: { marginTop: spacing.lg },
  giftsHeader: { alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.md },
  giftsTitleRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  giftsTitle: { fontFamily: fonts.display, color: colors.text, fontSize: 21, fontWeight: '900', letterSpacing: -0.5 },
  giftsMeta: { color: colors.textSubtle, fontSize: 11, fontWeight: '800', marginTop: 2, textTransform: 'uppercase' },
  giftsLink: { color: colors.warning, fontSize: 13, fontWeight: '900', paddingVertical: spacing.xs },
  giftRow: { flexDirection: 'row', gap: spacing.sm },
  giftCard: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 8, borderWidth: 1, flex: 1, minWidth: 0, paddingHorizontal: 4, paddingVertical: 16 },
  giftName: { color: colors.text, fontSize: 12, fontWeight: '900', marginTop: spacing.xs, maxWidth: '100%' },
  giftSender: { color: colors.textSubtle, fontSize: 10, marginTop: 2, maxWidth: '100%' },
  noGifts: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, flexDirection: 'row', gap: spacing.md, padding: spacing.lg },
  noGiftsEmoji: { color: colors.warning, fontSize: 23 },
  noGiftsText: { color: colors.textMuted, flex: 1, fontSize: 13 },
  utilityRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  utilityButton: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 8, borderWidth: 1, flex: 1, flexDirection: 'row', gap: 8, minHeight: 76, padding: 12 },
  utilityCopy: { flex: 1 },
  utilityTitle: { color: colors.text, fontSize: 14, fontWeight: '900' },
  utilityMeta: { color: colors.textSubtle, fontSize: 10, marginTop: 3 },
  accountFooter: { alignItems: 'center', borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: spacing.md, justifyContent: 'space-between', marginTop: spacing.lg, paddingTop: spacing.md },
  email: { color: colors.textSubtle, flex: 1, fontSize: 13 },
  signOutButton: { borderColor: colors.border, borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: spacing.lg, paddingVertical: 10 },
  signOutText: { color: colors.danger, fontSize: 13, fontWeight: '900' },
});
