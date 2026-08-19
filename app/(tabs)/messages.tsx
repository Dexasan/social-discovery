import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar, Card, Eyebrow, Heading, Muted, Screen } from '@/components/ui';
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
      <Eyebrow>Stay connected</Eyebrow>
      <Heading compact>Messages</Heading>
      {loading ? <ActivityIndicator color={colors.primary} style={styles.loading} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!loading && conversations.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Connections become conversations.</Text>
          <Muted>Follow someone in Quick Chat to keep talking here.</Muted>
        </Card>
      ) : null}
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
            >
              <Card style={styles.chat}>
                <Avatar label={name} />
                <View style={styles.copy}>
                  <Text style={styles.name}>{name}</Text>
                  <Muted>{chat.last_message_body ?? 'Start your conversation'}</Muted>
                </View>
                <Text style={styles.time}>{relativeTime(chat.last_message_at)}</Text>
              </Card>
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { marginVertical: spacing.xl },
  error: { color: colors.danger, fontSize: 13, marginTop: spacing.lg, textAlign: 'center' },
  emptyCard: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.xl },
  emptyTitle: { color: colors.text, fontSize: 17, fontWeight: '800', textAlign: 'center' },
  list: { gap: spacing.md, marginTop: spacing.xl },
  chat: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  copy: { flex: 1, gap: 3 },
  name: { color: colors.text, fontSize: 15, fontWeight: '800' },
  time: { color: colors.textMuted, fontSize: 11 },
});
