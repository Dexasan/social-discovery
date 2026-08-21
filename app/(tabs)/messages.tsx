import { useCallback, useEffect, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { Avatar, Card, EmptyState, Eyebrow, Heading, Muted, Screen, SectionHeader } from '@/components/ui';
import { useSession } from '@/context/SessionContext';
import { listDirectConversations, subscribeToInbox, type DirectConversation } from '@/features/messages/api';
import { colors, spacing } from '@/theme/tokens';

function relativeTime(value: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export default function MessagesScreen() {
  const { user } = useSession();
  const [conversations, setConversations] = useState<DirectConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async (showIndicator = false) => {
    if (showIndicator) setRefreshing(true);
    setError('');
    try {
      setConversations(await listDirectConversations());
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not load messages.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void refresh();
  }, [refresh]));

  useEffect(() => {
    if (!user) return;
    return subscribeToInbox(user.id, () => void refresh());
  }, [refresh, user]);

  const totalUnread = conversations.reduce((total, conversation) => total + conversation.unread_count, 0);

  return (
    <Screen refreshControl={<RefreshControl colors={[colors.primary]} onRefresh={() => void refresh(true)} progressBackgroundColor={colors.surfaceRaised} refreshing={refreshing} />}>
      <View style={styles.headerRow}>
        <View>
          <Eyebrow>YOUR YAPPIES</Eyebrow>
          <Heading compact>Keep talking.</Heading>
        </View>
        <Pressable accessibilityLabel="Start a new message" accessibilityRole="button" onPress={() => router.push('/messages/new')} style={styles.composeMark}>
          <Text style={styles.composeGlyph}>＋</Text>
        </Pressable>
      </View>
      {loading ? <ActivityIndicator color={colors.primary} style={styles.loading} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!loading && conversations.length === 0 ? (
        <EmptyState description="Follow someone after Quick Chat and your conversation will live here." glyph="⌁" title="Turn a moment into a connection" />
      ) : null}
      {conversations.length > 0 ? <SectionHeader action={totalUnread > 0 ? <View style={styles.unreadSummary}><Text style={styles.unreadSummaryText}>{totalUnread} new</Text></View> : undefined} title="Recent conversations" /> : null}
      <View style={styles.list}>
        {conversations.map((chat, index) => {
          const name = chat.partner_display_name || (chat.partner_handle ? `@${chat.partner_handle}` : 'Connection');
          return (
            <Pressable
              key={chat.conversation_id}
              accessibilityRole="button"
              onPress={() => router.push({
                pathname: '/messages/[conversationId]',
                params: { conversationId: chat.conversation_id, partnerId: chat.partner_id, partnerName: name },
              })}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <Card style={[styles.chat, index % 3 === 0 && styles.chatSignal, index % 3 === 1 && styles.chatCobalt, chat.unread_count > 0 && styles.unreadChat]}>
                <View><Avatar label={name} size={52} /><View style={styles.presence} /></View>
                <View style={styles.copy}>
                  <Text style={styles.name}>{name}</Text>
                  <Text numberOfLines={1} style={[styles.preview, chat.unread_count > 0 && styles.unreadPreview]}>{chat.last_message_body ?? 'Start your conversation'}</Text>
                </View>
                <View style={styles.trailing}>
                  <Text style={styles.time}>{relativeTime(chat.last_message_at)}</Text>
                  {chat.unread_count > 0 ? <View style={styles.unreadBadge}><Text style={styles.unreadBadgeText}>{Math.min(chat.unread_count, 99)}</Text></View> : <Text style={styles.chevron}>›</Text>}
                </View>
              </Card>
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  composeMark: { alignItems: 'center', backgroundColor: colors.signal, borderRadius: 20, height: 58, justifyContent: 'center', transform: [{ rotate: '4deg' }], width: 58 },
  composeGlyph: { color: colors.primary, fontSize: 29, fontWeight: '700' },
  loading: { marginVertical: spacing.xl },
  error: { color: colors.danger, fontSize: 14, lineHeight: 21, marginTop: spacing.lg, textAlign: 'center' },
  list: { gap: spacing.md },
  chat: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: 24, flexDirection: 'row', gap: spacing.md, minHeight: 86, paddingVertical: 16 },
  chatSignal: { backgroundColor: colors.signalSoft, borderColor: '#CDE987', transform: [{ rotate: '-0.25deg' }] },
  chatCobalt: { backgroundColor: colors.cobaltSoft, borderColor: '#BFC9FF', transform: [{ rotate: '0.25deg' }] },
  unreadChat: { borderColor: colors.accent, borderWidth: 2 },
  copy: { flex: 1, gap: 3 },
  name: { color: colors.text, fontSize: 18, fontWeight: '900', letterSpacing: -0.3 },
  preview: { color: colors.textMuted, fontSize: 15, lineHeight: 21 },
  unreadPreview: { color: colors.textMuted, fontWeight: '700' },
  presence: { backgroundColor: colors.success, borderColor: colors.surfaceSoft, borderRadius: 5, borderWidth: 2, bottom: 0, height: 11, position: 'absolute', right: 0, width: 11 },
  trailing: { alignItems: 'flex-end', gap: 5 },
  time: { color: colors.textSubtle, fontSize: 12, fontWeight: '800' },
  chevron: { color: colors.textSubtle, fontSize: 22, fontWeight: '300' },
  unreadSummary: { backgroundColor: colors.accentSoft, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  unreadSummaryText: { color: colors.danger, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  unreadBadge: { alignItems: 'center', backgroundColor: colors.accent, borderRadius: 13, height: 26, justifyContent: 'center', minWidth: 26, paddingHorizontal: 7 },
  unreadBadgeText: { color: colors.white, fontSize: 12, fontWeight: '900' },
  pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
});
