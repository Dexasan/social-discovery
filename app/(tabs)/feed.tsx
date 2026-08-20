import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Avatar, Card, EmptyState, Eyebrow, Heading, Muted, Pill, PrimaryButton, Screen, SectionHeader } from '@/components/ui';
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
      <View style={styles.pageHeader}>
        <View>
          <Eyebrow>World feed</Eyebrow>
          <Heading compact>What’s on your mind?</Heading>
        </View>
        <View style={styles.livePulse}><View style={styles.liveDot} /><Text style={styles.liveText}>Live</Text></View>
      </View>

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
        <View style={styles.composerRule} />
        <View style={styles.topics}>
          {topics.map((option) => (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityState={{ checked: topic === option }}
              onPress={() => setTopic(option)}
              style={[styles.topicChoice, topic === option && styles.topicSelected]}
            >
              <Text style={[styles.topicText, topic === option && styles.topicTextSelected]}>{option}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.publishRow}>
          <Text style={styles.counter}>{body.length}/500</Text>
          <View style={styles.publishButton}>
            <PrimaryButton disabled={!body.trim() || submitting} label={submitting ? 'Sharing…' : 'Share post'} onPress={() => void publish()} />
          </View>
        </View>
      </Card>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? <ActivityIndicator color={colors.primary} style={styles.loading} /> : null}
      {!loading && posts.length === 0 ? (
        <EmptyState description="Break the silence with the first thought." glyph="✦" title="A fresh corner of the internet" />
      ) : null}

      {posts.length ? <SectionHeader title="Happening now" /> : null}
      <View style={styles.list}>
        {posts.map((post) => {
          const authorName = post.author_display_name || (post.author_handle ? `@${post.author_handle}` : 'Community member');
          return (
            <Card key={post.post_id}>
              <View style={styles.authorRow}>
                <Pressable
                  accessibilityLabel={`Open ${authorName}'s profile`}
                  accessibilityRole="button"
                  onPress={() => router.push({ pathname: '/people/[userId]', params: { userId: post.author_id } })}
                  style={styles.authorLink}
                >
                  <Avatar label={authorName} size={42} />
                  <View style={styles.authorCopy}>
                    <Text style={styles.name}>{authorName}</Text>
                    <Text style={styles.meta}>@{post.author_handle ?? 'member'} · {relativeTime(post.created_at)}</Text>
                  </View>
                </Pressable>
                {post.topic ? <Pill label={post.topic} /> : null}
              </View>
              <Text style={styles.postBody}>{post.body}</Text>
              <View style={styles.actions}>
                <Pressable accessibilityRole="button" onPress={() => void toggleLike(post)} style={[styles.actionButton, post.liked_by_me && styles.actionButtonActive]}>
                  <Text style={[styles.actionIcon, post.liked_by_me && styles.actionActive]}>{post.liked_by_me ? '♥' : '♡'}</Text>
                  <Text style={[styles.action, post.liked_by_me && styles.actionActive]}>{post.like_count}</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push({ pathname: '/post/[postId]', params: { postId: post.post_id, body: post.body, author: authorName, authorId: post.author_id } })}
                  style={styles.actionButton}
                >
                  <Text style={styles.actionIcon}>◌</Text><Text style={styles.action}>{post.reply_count}</Text>
                </Pressable>
                <View style={styles.actionSpacer} />
                <Text style={styles.more}>•••</Text>
              </View>
            </Card>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pageHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  livePulse: { alignItems: 'center', backgroundColor: colors.accentSoft, borderRadius: radius.pill, flexDirection: 'row', gap: 6, paddingHorizontal: 11, paddingVertical: 7 },
  liveDot: { backgroundColor: colors.accent, borderRadius: 4, height: 7, width: 7 },
  liveText: { color: colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 0.8, textTransform: 'uppercase' },
  composerCard: { backgroundColor: colors.surfaceSoft, gap: spacing.md, marginTop: spacing.xl },
  composeTop: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.md },
  composeInput: { color: colors.text, flex: 1, fontSize: 16, lineHeight: 23, minHeight: 78, paddingTop: spacing.sm, textAlignVertical: 'top' },
  composerRule: { backgroundColor: colors.border, height: StyleSheet.hairlineWidth },
  topics: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  topicChoice: { backgroundColor: colors.surfaceRaised, borderColor: colors.border, borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 7 },
  topicSelected: { backgroundColor: colors.primarySoft, borderColor: '#344A88' },
  topicText: { color: colors.textMuted, fontSize: 11, fontWeight: '700' },
  topicTextSelected: { color: colors.primary },
  publishRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  counter: { color: colors.textSubtle, fontSize: 11, fontWeight: '700' },
  publishButton: { minWidth: 138 },
  loading: { marginVertical: spacing.xl },
  error: { color: colors.danger, fontSize: 13, marginTop: spacing.md, textAlign: 'center' },
  list: { gap: spacing.md },
  authorRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  authorLink: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: spacing.md },
  authorCopy: { flex: 1 },
  name: { color: colors.text, fontSize: 15, fontWeight: '900', letterSpacing: -0.2 },
  meta: { color: colors.textSubtle, fontSize: 12, marginTop: 2 },
  postBody: { color: colors.text, fontSize: 17, fontWeight: '600', letterSpacing: -0.15, lineHeight: 25, marginVertical: spacing.lg },
  actions: { alignItems: 'center', borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: spacing.sm, paddingTop: spacing.md },
  actionButton: { alignItems: 'center', backgroundColor: colors.surfaceRaised, borderRadius: radius.pill, flexDirection: 'row', gap: 6, minWidth: 54, paddingHorizontal: 11, paddingVertical: 7 },
  actionButtonActive: { backgroundColor: colors.accentSoft },
  actionIcon: { color: colors.textMuted, fontSize: 15, fontWeight: '700' },
  action: { color: colors.textMuted, fontSize: 12, fontWeight: '800' },
  actionActive: { color: colors.danger },
  actionSpacer: { flex: 1 },
  more: { color: colors.textSubtle, fontSize: 13, letterSpacing: 1 },
});
