import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Avatar, Card, Heading, Muted, PrimaryButton, Screen } from '@/components/ui';
import { useSession } from '@/context/SessionContext';
import { createReply, loadPostReplies, type FeedReply } from '@/features/feed/api';
import { colors, radius, spacing } from '@/theme/tokens';

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function PostDetailScreen() {
  const params = useLocalSearchParams<{ postId: string; body?: string; author?: string }>();
  const postId = first(params.postId);
  const body = first(params.body) ?? 'Conversation';
  const author = first(params.author) ?? 'Community member';
  const { user } = useSession();
  const [replies, setReplies] = useState<FeedReply[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const refresh = async () => {
    if (!postId) return;
    try {
      setReplies(await loadPostReplies(postId));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not load replies.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, [postId]);

  const reply = async () => {
    if (!postId || !user || !draft.trim() || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      await createReply(postId, user.id, draft);
      setDraft('');
      await refresh();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not publish this reply.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <Pressable accessibilityLabel="Back to feed" onPress={() => router.back()} style={styles.back}>
        <Text style={styles.backText}>‹ Feed</Text>
      </Pressable>
      <Heading compact>Replies</Heading>
      <Card style={styles.postCard}>
        <View style={styles.authorRow}>
          <Avatar label={author} size={42} />
          <Text style={styles.author}>{author}</Text>
        </View>
        <Text style={styles.body}>{body}</Text>
      </Card>

      <Card style={styles.composer}>
        <TextInput
          accessibilityLabel="Reply"
          maxLength={500}
          multiline
          onChangeText={setDraft}
          placeholder="Add to the conversation…"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          value={draft}
        />
        <PrimaryButton disabled={!draft.trim() || submitting} label={submitting ? 'Replying…' : 'Reply'} onPress={() => void reply()} />
      </Card>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? <ActivityIndicator color={colors.primary} style={styles.loading} /> : null}
      {!loading && replies.length === 0 ? <Muted>No replies yet. Start the conversation.</Muted> : null}
      <View style={styles.replies}>
        {replies.map((item) => {
          const name = item.author_display_name || (item.author_handle ? `@${item.author_handle}` : 'Community member');
          return (
            <Card key={item.reply_id} style={styles.replyCard}>
              <Avatar label={name} size={38} />
              <View style={styles.replyCopy}>
                <Text style={styles.author}>{name}</Text>
                <Text style={styles.replyBody}>{item.body}</Text>
              </View>
            </Card>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { alignSelf: 'flex-start', paddingVertical: spacing.sm },
  backText: { color: colors.primary, fontSize: 14, fontWeight: '800' },
  postCard: { gap: spacing.lg, marginTop: spacing.lg },
  authorRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  author: { color: colors.text, fontSize: 14, fontWeight: '800' },
  body: { color: colors.text, fontSize: 20, fontWeight: '700', lineHeight: 28 },
  composer: { gap: spacing.md, marginTop: spacing.lg },
  input: { backgroundColor: colors.background, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, color: colors.text, fontSize: 15, minHeight: 82, padding: spacing.md, textAlignVertical: 'top' },
  error: { color: colors.danger, fontSize: 13, marginVertical: spacing.md, textAlign: 'center' },
  loading: { marginVertical: spacing.xl },
  replies: { gap: spacing.md, marginTop: spacing.lg },
  replyCard: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.md },
  replyCopy: { flex: 1, gap: spacing.sm },
  replyBody: { color: colors.text, fontSize: 15, lineHeight: 21 },
});
