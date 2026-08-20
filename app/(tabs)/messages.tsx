import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar, Card, EmptyState, Eyebrow, Heading, Muted, Screen, SectionHeader } from '@/components/ui';
import { listDirectConversations, type DirectConversation } from '@/features/messages/api';
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
  const [conversations, setConversations] = useState<DirectConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setError('');
    try {
      setConversations(await listDirectConversations());
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not load messages.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void refresh();
  }, [refresh]));

  return (
    <Screen>
      <View style={styles.headerRow}>
        <View>
          <Eyebrow>Your people</Eyebrow>
          <Heading compact>Messages</Heading>
        </View>
        <View style={styles.composeMark}><Text style={styles.composeGlyph}>＋</Text></View>
      </View>
      {loading ? <ActivityIndicator color={colors.primary} style={styles.loading} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!loading && conversations.length === 0 ? (
        <EmptyState description="Follow someone after Quick Chat and your conversation will live here." glyph="⌁" title="Turn a moment into a connection" />
      ) : null}
      {conversations.length ? <SectionHeader title="Recent conversations" /> : null}
      <View style={styles.list}>
        {conversations.map((chat) => {
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
              <Card style={styles.chat}>
                <View><Avatar label={name} size={52} /><View style={styles.presence} /></View>
                <View style={styles.copy}>
                  <Text style={styles.name}>{name}</Text>
                  <Text numberOfLines={1} style={styles.preview}>{chat.last_message_body ?? 'Start your conversation'}</Text>
                </View>
                <View style={styles.trailing}><Text style={styles.time}>{relativeTime(chat.last_message_at)}</Text><Text style={styles.chevron}>›</Text></View>
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
  composeMark: { alignItems: 'center', backgroundColor: colors.primarySoft, borderColor: '#304377', borderRadius: 20, borderWidth: 1, height: 44, justifyContent: 'center', width: 44 },
  composeGlyph: { color: colors.primary, fontSize: 23, fontWeight: '500' },
  loading: { marginVertical: spacing.xl },
  error: { color: colors.danger, fontSize: 13, marginTop: spacing.lg, textAlign: 'center' },
  list: { gap: spacing.sm },
  chat: { alignItems: 'center', backgroundColor: colors.surfaceSoft, flexDirection: 'row', gap: spacing.md, paddingVertical: 14 },
  copy: { flex: 1, gap: 3 },
  name: { color: colors.text, fontSize: 15, fontWeight: '900', letterSpacing: -0.2 },
  preview: { color: colors.textSubtle, fontSize: 13, lineHeight: 19 },
  presence: { backgroundColor: colors.success, borderColor: colors.surfaceSoft, borderRadius: 5, borderWidth: 2, bottom: 0, height: 11, position: 'absolute', right: 0, width: 11 },
  trailing: { alignItems: 'flex-end', gap: 5 },
  time: { color: colors.textSubtle, fontSize: 10.5, fontWeight: '700' },
  chevron: { color: colors.textSubtle, fontSize: 22, fontWeight: '300' },
  pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
});
