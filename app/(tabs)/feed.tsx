import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Avatar, Card, Eyebrow, Heading, Muted, Pill, PrimaryButton, Screen } from '@/components/ui';
import { useSession } from '@/context/SessionContext';
import { createPost, loadFeed, setPostLiked, type FeedPost } from '@/features/feed/api';
import { colors, radius, spacing } from '@/theme/tokens';

const topics = ['Random Thoughts', 'Music', 'Study', 'Travel'];

function relativeTime(value: string) {
  const seconds = Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return 'now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export default function FeedScreen() {
  const { profile, user } = useSession();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [body, setBody] = useState('');
  const [topic, setTopic] = useState('Random Thoughts');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setError('');
    try {
      setPosts(await loadFeed());
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not load the feed.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void refresh();
  }, [refresh]));

  const publish = async () => {
    if (!user || !body.trim() || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      await createPost(user.id, body, topic);
      setBody('');
      await refresh();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not publish this post.');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleLike = async (post: FeedPost) => {
    if (!user) return;
    const nextLiked = !post.liked_by_me;
    setPosts((current) => current.map((item) => item.post_id === post.post_id
      ? { ...item, liked_by_me: nextLiked, like_count: item.like_count + (nextLiked ? 1 : -1) }
      : item));
    try {
      await setPostLiked(post.post_id, user.id, nextLiked);
    } catch (nextError) {
      setPosts((current) => current.map((item) => item.post_id === post.post_id ? post : item));
      setError(nextError instanceof Error ? nextError.message : 'Could not update this like.');
    }
  };

  return (
    <Screen>
      <Eyebrow>For you</Eyebrow>
      <Heading compact>Conversations worth joining</Heading>

      <Card style={styles.composerCard}>
        <View style={styles.composeTop}>
          <Avatar label={profile?.displayName || 'You'} size={42} />
          <TextInput
            accessibilityLabel="New post"
            maxLength={500}
            multiline
            onChangeText={setBody}
            placeholder="Share a thought with the world…"
            placeholderTextColor={colors.textMuted}
            style={styles.composeInput}
            value={body}
          />
        </View>
        <View style={styles.topics}>
          {topics.map((option) => (
            <Pressable key={option} onPress={() => setTopic(option)} style={[styles.topicChoice, topic === option && styles.topicSelected]}>
              <Text style={[styles.topicText, topic === option && styles.topicTextSelected]}>{option}</Text>
            </Pressable>
          ))}
        </View>
        <PrimaryButton disabled={!body.trim() || submitting} label={submitting ? 'Posting…' : 'Post'} onPress={() => void publish()} />
      </Card>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? <ActivityIndicator color={colors.primary} style={styles.loading} /> : null}
      {!loading && posts.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>The feed is ready for its first thought.</Text>
          <Muted>Start the conversation above.</Muted>
        </Card>
      ) : null}

      <View style={styles.list}>
        {posts.map((post) => {
          const authorName = post.author_display_name || (post.author_handle ? `@${post.author_handle}` : 'Community member');
          return (
            <Card key={post.post_id}>
              <View style={styles.authorRow}>
                <Avatar label={authorName} size={42} />
                <View style={styles.authorCopy}>
                  <Text style={styles.name}>{authorName}</Text>
                  <Muted>@{post.author_handle ?? 'member'} · {relativeTime(post.created_at)}</Muted>
                </View>
                {post.topic ? <Pill label={post.topic} /> : null}
              </View>
              <Text style={styles.postBody}>{post.body}</Text>
              <View style={styles.actions}>
                <Pressable accessibilityRole="button" onPress={() => void toggleLike(post)}>
                  <Text style={[styles.action, post.liked_by_me && styles.actionActive]}>♥ {post.like_count}</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push({ pathname: '/post/[postId]', params: { postId: post.post_id, body: post.body, author: authorName } })}
                >
                  <Text style={styles.action}>Reply · {post.reply_count}</Text>
                </Pressable>
              </View>
            </Card>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  composerCard: { gap: spacing.md, marginTop: spacing.xl },
  composeTop: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.md },
  composeInput: { color: colors.text, flex: 1, fontSize: 16, lineHeight: 22, minHeight: 74, paddingTop: spacing.sm },
  topics: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  topicChoice: { borderColor: colors.border, borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 7 },
  topicSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  topicText: { color: colors.textMuted, fontSize: 11, fontWeight: '700' },
  topicTextSelected: { color: colors.primaryInk },
  loading: { marginVertical: spacing.xl },
  error: { color: colors.danger, fontSize: 13, marginTop: spacing.md, textAlign: 'center' },
  emptyCard: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg },
  emptyTitle: { color: colors.text, fontSize: 17, fontWeight: '800', textAlign: 'center' },
  list: { gap: spacing.md, marginTop: spacing.lg },
  authorRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  authorCopy: { flex: 1 },
  name: { color: colors.text, fontSize: 15, fontWeight: '800' },
  postBody: { color: colors.text, fontSize: 18, fontWeight: '600', lineHeight: 25, marginVertical: spacing.lg },
  actions: { flexDirection: 'row', gap: spacing.xl },
  action: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  actionActive: { color: colors.danger },
});
