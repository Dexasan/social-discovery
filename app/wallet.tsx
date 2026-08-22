import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { EmptyState, Screen } from '@/components/ui';
import { useSession } from '@/context/SessionContext';
import { loadCoinWallet, loadGiftCatalog, loadProfileGifts, type CoinWallet, type GiftCatalogItem, type ProfileGift } from '@/features/gifts/api';
import { colors, radius, spacing } from '@/theme/tokens';

export default function WalletScreen() {
  const { user } = useSession();
  const [wallet, setWallet] = useState<CoinWallet | null>(null);
  const [catalog, setCatalog] = useState<GiftCatalogItem[]>([]);
  const [receivedGifts, setReceivedGifts] = useState<ProfileGift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (!user) throw new Error('Sign in to open your wallet.');
      const [nextWallet, nextCatalog, nextReceivedGifts] = await Promise.all([loadCoinWallet(), loadGiftCatalog(), loadProfileGifts(user.id)]);
      setWallet(nextWallet);
      setCatalog(nextCatalog);
      setReceivedGifts(nextReceivedGifts);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Your wallet is temporarily unavailable.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  return (
    <Screen>
      <View style={styles.topRow}>
        <Pressable accessibilityLabel="Go back" accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}><Text style={styles.backGlyph}>‹</Text></Pressable>
        <Text style={styles.pageLabel}>WALLET</Text>
        <View style={styles.topSpacer} />
      </View>

      {loading ? <ActivityIndicator color={colors.warning} style={styles.loading} /> : null}
      {!loading && error ? <><EmptyState description={error} glyph="◎" title="Wallet unavailable" /><Pressable accessibilityRole="button" onPress={() => void refresh()} style={styles.retryButton}><Text style={styles.retryLabel}>Try again</Text></Pressable></> : null}

      {!loading && wallet ? (
        <>
          <View style={styles.balanceHero}>
            <View pointerEvents="none" style={styles.balanceOrb} />
            <Text style={styles.balanceKicker}>READY TO SEND</Text>
            <Text style={styles.balanceValue}>{wallet.balance}</Text>
            <Text style={styles.balanceLabel}>YAPPIE coins</Text>
            <View style={styles.balanceStats}>
              <View><Text style={styles.statValue}>{wallet.lifetime_earned}</Text><Text style={styles.statLabel}>Received</Text></View>
              <View style={styles.statDivider} />
              <View><Text style={styles.statValue}>{wallet.lifetime_spent}</Text><Text style={styles.statLabel}>Gifted</Text></View>
            </View>
          </View>

          <View style={styles.introRow}>
            <View><Text style={styles.catalogTitle}>The gift shelf</Text><Text style={styles.catalogSubtitle}>Open a person, chat, or live room to send one.</Text></View>
            <Text style={styles.catalogCount}>{catalog.length}</Text>
          </View>
          <View style={styles.catalog}>
            {catalog.map((gift) => {
              const affordable = wallet.balance >= gift.coin_cost;
              return (
                <View key={gift.slug} style={[styles.catalogItem, !affordable && styles.catalogItemMuted]}>
                  <Text style={styles.giftEmoji}>{gift.emoji}</Text>
                  <View style={styles.giftCopy}><Text style={styles.giftName}>{gift.name}</Text><Text style={styles.giftStatus}>{affordable ? 'Ready to send' : `${gift.coin_cost - wallet.balance} more needed`}</Text></View>
                  <Text style={styles.giftCost}>{gift.coin_cost}</Text>
                </View>
              );
            })}
          </View>

          <View style={styles.receivedHeader}>
            <Text style={styles.receivedTitle}>Sent your way</Text>
            <Text style={styles.receivedCount}>{receivedGifts.length ? `${receivedGifts.length} recent` : 'No gifts yet'}</Text>
          </View>
          {receivedGifts.length ? (
            <View style={styles.receivedRail}>
              {receivedGifts.slice(0, 8).map((gift) => (
                <View key={gift.gift_id} style={styles.receivedGift}>
                  <Text style={styles.receivedEmoji}>{gift.gift_emoji}</Text>
                  <Text numberOfLines={1} style={styles.receivedFrom}>{gift.sender_display_name || (gift.sender_handle ? `@${gift.sender_handle}` : 'Someone')}</Text>
                </View>
              ))}
            </View>
          ) : <Text style={styles.receivedEmpty}>When someone sends you a gift, your newest ones will live here.</Text>}

          <View style={styles.note}>
            <Text style={styles.noteGlyph}>i</Text>
            <Text style={styles.noteText}>Your account starts with 100 coins. Gifts are a social gesture only—they cannot be sold, withdrawn, or exchanged for money.</Text>
          </View>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  topRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  backButton: { alignItems: 'center', backgroundColor: colors.surfaceRaised, borderColor: colors.border, borderRadius: radius.pill, borderWidth: 1, height: 48, justifyContent: 'center', width: 48 },
  backGlyph: { color: colors.text, fontSize: 30, lineHeight: 32 },
  pageLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '900', letterSpacing: 1.8 },
  topSpacer: { width: 48 },
  loading: { marginTop: 160 },
  retryButton: { alignItems: 'center', alignSelf: 'center', borderColor: colors.borderStrong, borderRadius: radius.pill, borderWidth: 1, marginTop: spacing.lg, paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  retryLabel: { color: colors.text, fontSize: 14, fontWeight: '900' },
  balanceHero: { backgroundColor: colors.warningSoft, borderColor: '#6D5520', borderRadius: radius.xl, borderWidth: 1, marginTop: spacing.xl, overflow: 'hidden', padding: spacing.xl },
  balanceOrb: { backgroundColor: 'rgba(255, 190, 74, 0.13)', borderRadius: 140, height: 240, position: 'absolute', right: -85, top: -105, width: 240 },
  balanceKicker: { color: colors.warning, fontSize: 10, fontWeight: '900', letterSpacing: 1.3 },
  balanceValue: { color: colors.text, fontSize: 72, fontWeight: '900', letterSpacing: -4, lineHeight: 78, marginTop: spacing.sm },
  balanceLabel: { color: colors.textMuted, fontSize: 15, fontWeight: '800' },
  balanceStats: { alignItems: 'center', borderTopColor: '#6D5520', borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: spacing.xl, marginTop: spacing.xl, paddingTop: spacing.lg },
  statValue: { color: colors.text, fontSize: 18, fontWeight: '900' },
  statLabel: { color: colors.textSubtle, fontSize: 11, marginTop: 2 },
  statDivider: { backgroundColor: '#6D5520', height: 34, width: StyleSheet.hairlineWidth },
  introRow: { alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xxl },
  catalogTitle: { color: colors.text, fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  catalogSubtitle: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  catalogCount: { color: colors.warning, fontSize: 22, fontWeight: '900' },
  catalog: { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth, marginTop: spacing.md },
  catalogItem: { alignItems: 'center', borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: spacing.md, minHeight: 72, paddingVertical: spacing.md },
  catalogItemMuted: { opacity: 0.48 },
  giftEmoji: { fontSize: 32, width: 44 },
  giftCopy: { flex: 1 },
  giftName: { color: colors.text, fontSize: 16, fontWeight: '900' },
  giftStatus: { color: colors.textSubtle, fontSize: 11, marginTop: 3 },
  giftCost: { color: colors.warning, fontSize: 17, fontWeight: '900' },
  receivedHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xxl },
  receivedTitle: { color: colors.text, fontSize: 20, fontWeight: '900', letterSpacing: -0.4 },
  receivedCount: { color: colors.textSubtle, fontSize: 11, fontWeight: '800' },
  receivedRail: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  receivedGift: { alignItems: 'center', backgroundColor: colors.surfaceRaised, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, gap: 4, minWidth: 78, paddingHorizontal: spacing.sm, paddingVertical: spacing.md },
  receivedEmoji: { fontSize: 27 },
  receivedFrom: { color: colors.textMuted, fontSize: 10, maxWidth: 76 },
  receivedEmpty: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginTop: spacing.sm },
  note: { alignItems: 'flex-start', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl, padding: spacing.lg },
  noteGlyph: { color: colors.signal, fontSize: 15, fontWeight: '900' },
  noteText: { color: colors.textMuted, flex: 1, fontSize: 12, lineHeight: 18 },
});
