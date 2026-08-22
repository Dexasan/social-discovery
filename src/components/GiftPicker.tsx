import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { loadCoinWallet, loadGiftCatalog, sendVirtualGift, type CoinWallet, type GiftCatalogItem, type GiftContextKind, type SendGiftResult } from '@/features/gifts/api';
import { colors, radius, spacing } from '@/theme/tokens';

export function GiftPicker({
  contextId,
  contextKind,
  onClose,
  onSent,
  recipientId,
  recipientName,
  visible,
}: {
  contextId?: string;
  contextKind: GiftContextKind;
  onClose: () => void;
  onSent?: (result: SendGiftResult, gift: GiftCatalogItem) => void;
  recipientId: string;
  recipientName: string;
  visible: boolean;
}) {
  const [wallet, setWallet] = useState<CoinWallet | null>(null);
  const [catalog, setCatalog] = useState<GiftCatalogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [sendingSlug, setSendingSlug] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [nextWallet, nextCatalog] = await Promise.all([loadCoinWallet(), loadGiftCatalog()]);
      setWallet(nextWallet);
      setCatalog(nextCatalog);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Gifts are temporarily unavailable.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    setNotice('');
    setSelectedSlug(null);
    void refresh();
  }, [refresh, recipientId, visible]);

  const selectedGift = catalog.find((gift) => gift.slug === selectedSlug) ?? null;

  const send = async () => {
    const gift = selectedGift;
    if (!gift || !wallet || wallet.balance < gift.coin_cost || sendingSlug) return;
    setSendingSlug(gift.slug);
    setError('');
    setNotice('');
    try {
      const result = await sendVirtualGift({ contextId, contextKind, giftSlug: gift.slug, recipientId });
      setWallet((current) => current ? { ...current, balance: result.balance, lifetime_spent: current.lifetime_spent + result.coin_cost } : current);
      setNotice(`${gift.emoji} ${gift.name} sent!`);
      setSelectedSlug(null);
      onSent?.(result, gift);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not send this gift.');
    } finally {
      setSendingSlug(null);
    }
  };

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.modalRoot}>
        <Pressable accessibilityLabel="Close gift picker" accessibilityRole="button" onPress={onClose} style={styles.modalBackdrop} />
        <View style={styles.giftSheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <View style={styles.sheetTitleCopy}><Text style={styles.sheetTitle}>Make their day</Text><Text numberOfLines={1} style={styles.sheetSubtitle}>Pick something for {recipientName}</Text></View>
            <View style={styles.sheetBalance}><Text style={styles.sheetBalanceValue}>{wallet?.balance ?? '—'}</Text><Text style={styles.sheetBalanceLabel}>coins</Text></View>
          </View>

          {loading ? <ActivityIndicator color={colors.primary} style={styles.loading} /> : null}
          {!loading ? (
            <View style={styles.giftGrid}>
              {catalog.map((gift) => {
                const unavailable = !wallet || wallet.balance < gift.coin_cost;
                const busy = sendingSlug === gift.slug;
                const selected = selectedSlug === gift.slug;
                return (
                  <Pressable
                    key={gift.slug}
                    accessibilityLabel={`${gift.name}, ${gift.coin_cost} coins`}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: unavailable || Boolean(sendingSlug), selected }}
                    disabled={unavailable || Boolean(sendingSlug)}
                    onPress={() => { setSelectedSlug(gift.slug); setNotice(''); }}
                    style={[styles.giftChoice, selected && styles.giftChoiceSelected, unavailable && styles.giftChoiceUnavailable, busy && styles.giftChoiceBusy]}
                  >
                    <Text style={styles.giftEmoji}>{gift.emoji}</Text>
                    <Text style={styles.giftName}>{gift.name}</Text>
                    <Text style={styles.giftCost}>{gift.coin_cost} coins</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {selectedGift ? (
            <View style={styles.previewRow}>
              <Text style={styles.previewEmoji}>{selectedGift.emoji}</Text>
              <View style={styles.previewCopy}><Text style={styles.previewTitle}>{selectedGift.name} is ready</Text><Text style={styles.previewMeta}>Your balance after sending: {(wallet?.balance ?? 0) - selectedGift.coin_cost} coins</Text></View>
            </View>
          ) : null}
          {notice ? <Text accessibilityRole="alert" style={styles.success}>{notice}</Text> : null}
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          {error && catalog.length === 0 ? <Pressable accessibilityRole="button" onPress={() => void refresh()} style={styles.retry}><Text style={styles.retryLabel}>Retry gifts</Text></Pressable> : null}
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !selectedGift || Boolean(sendingSlug) }}
            disabled={!selectedGift || Boolean(sendingSlug)}
            onPress={() => void send()}
            style={[styles.sendButton, (!selectedGift || Boolean(sendingSlug)) && styles.sendButtonDisabled]}
          >
            {sendingSlug ? <ActivityIndicator color={colors.primaryInk} /> : <Text style={styles.sendLabel}>{selectedGift ? `Send ${selectedGift.name} · ${selectedGift.coin_cost} coins` : 'Choose a gift'}</Text>}
          </Pressable>
          <View style={styles.sheetFooter}>
            <Text style={styles.footnote}>Gifts are social-only and never convert to cash.</Text>
            <Pressable accessibilityRole="button" onPress={onClose}><Text style={styles.closeLabel}>Close</Text></Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { backgroundColor: 'rgba(3, 4, 8, 0.76)', bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 },
  giftSheet: { backgroundColor: colors.surface, borderColor: colors.borderStrong, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, borderWidth: 1, gap: spacing.lg, paddingBottom: 34, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  sheetHandle: { alignSelf: 'center', backgroundColor: colors.borderStrong, borderRadius: radius.pill, height: 4, width: 44 },
  sheetHeader: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, justifyContent: 'space-between' },
  sheetTitleCopy: { flex: 1 },
  sheetTitle: { color: colors.text, fontSize: 23, fontWeight: '900', letterSpacing: -0.7 },
  sheetSubtitle: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  sheetBalance: { alignItems: 'center', backgroundColor: colors.warningSoft, borderRadius: radius.md, minWidth: 68, paddingHorizontal: spacing.md, paddingVertical: 8 },
  sheetBalanceValue: { color: colors.warning, fontSize: 20, fontWeight: '900' },
  sheetBalanceLabel: { color: colors.textSubtle, fontSize: 12, fontWeight: '800', letterSpacing: 0.7, textTransform: 'uppercase' },
  loading: { marginVertical: spacing.xl },
  giftGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  giftChoice: { alignItems: 'center', backgroundColor: colors.surfaceRaised, borderColor: colors.borderStrong, borderRadius: radius.lg, borderWidth: 1, gap: 3, paddingHorizontal: spacing.sm, paddingVertical: spacing.md, width: '31%' },
  giftChoiceSelected: { backgroundColor: colors.signalSoft, borderColor: colors.signal, borderWidth: 2, paddingHorizontal: spacing.sm - 1, paddingVertical: spacing.md - 1 },
  giftChoiceUnavailable: { opacity: 0.35 },
  giftChoiceBusy: { backgroundColor: colors.signalSoft, borderColor: colors.signal },
  giftEmoji: { fontSize: 31, marginBottom: 2 },
  giftName: { color: colors.text, fontSize: 14, fontWeight: '900' },
  giftCost: { color: colors.warning, fontSize: 12, fontWeight: '800' },
  previewRow: { alignItems: 'center', backgroundColor: colors.backgroundRaised, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, flexDirection: 'row', gap: spacing.md, padding: spacing.md },
  previewEmoji: { fontSize: 34 },
  previewCopy: { flex: 1 },
  previewTitle: { color: colors.text, fontSize: 15, fontWeight: '900' },
  previewMeta: { color: colors.textMuted, fontSize: 12, marginTop: 3 },
  success: { color: colors.success, fontSize: 14, fontWeight: '900', textAlign: 'center' },
  error: { color: colors.danger, fontSize: 12, textAlign: 'center' },
  retry: { alignItems: 'center', alignSelf: 'center', backgroundColor: colors.surfaceRaised, borderColor: colors.borderStrong, borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  retryLabel: { color: colors.text, fontSize: 14, fontWeight: '900' },
  sendButton: { alignItems: 'center', backgroundColor: colors.signal, borderRadius: radius.md, justifyContent: 'center', minHeight: 52 },
  sendButtonDisabled: { backgroundColor: colors.surfaceRaised },
  sendLabel: { color: colors.black, fontSize: 15, fontWeight: '900' },
  sheetFooter: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, justifyContent: 'space-between' },
  footnote: { color: colors.textSubtle, flex: 1, fontSize: 11, lineHeight: 16 },
  closeLabel: { color: colors.text, fontSize: 13, fontWeight: '900', padding: spacing.sm },
});
