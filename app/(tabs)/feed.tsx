import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { ActivityIndicator, Pressable, RefreshControl, Share, StyleSheet, Text, TextInput, View } from 'react-native';

import { Avatar, Card, EmptyState, Eyebrow, Heading, Muted, Pill, PrimaryButton, Screen, SectionHeader } from '@/components/ui';
import { useSession } from '@/context/SessionContext';
import { createPost, loadFeed, loadFollowingFeed, setPostLiked, type FeedPost } from '@/features/feed/api';
import { colors, radius, spacing } from '@/theme/tokens';

const topics = ['Random Thoughts', 'Music', 'Study', 'Travel'];
type FeedMode = 'global' | 'following';

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
  const [feedMode, setFeedMode] = useState<FeedMode>('global');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) setRefreshing(true);
    setError('');
    try {
      const nextPosts = await (feedMode === 'following' ? loadFollowingFeed() : loadFeed());
      setPosts(nextPosts);
      setHasMore(nextPosts.length === 30);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not load the feed.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [feedMode]);

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
      if (feedMode !== 'global') setFeedMode('global');
      else await refresh();
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

  const loadMore = async () => {
    const oldestPost = posts.at(-1);
    if (!oldestPost || !hasMore || loadingMore) return;
    setLoadingMore(true);
    setError('');
    try {
      const olderPosts = await (feedMode === 'following' ? loadFollowingFeed(oldestPost.created_at) : loadFeed(oldestPost.created_at));
      setPosts((current) => {
        const existingIds = new Set(current.map((item) => item.post_id));
        return [...current, ...olderPosts.filter((item) => !existingIds.has(item.post_id))];
      });
      setHasMore(olderPosts.length === 30);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not load older posts.');
    } finally {
      setLoadingMore(false);
    }
  };

  const sharePost = async (post: FeedPost, authorName: string) => {
    try {
      await Share.share({ message: `${post.body}\n\n— ${authorName} on Social Discovery` });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not open the share menu.');
    }
  };

  return (
    <Screen refreshControl={<RefreshControl colors={[colors.primary]} onRefresh={() => void refresh(true)} progressBackgroundColor={colors.surfaceRaised} refreshing={refreshing} tintColor={colors.primary} />}>
      <View style={styles.pageHeader}>
        <View>
          <Eyebrow>World feed</Eyebrow>
          <Heading compact>What’s on your mind?</Heading>
        </View>
        <View style={styles.livePulse}><View style={styles.liveDot} /><Text style={styles.liveText}>Live</Text></View>
      </View>

      <View style={styles.feedModeRow}>
        {(['global', 'following'] as const).map((mode) => (
          <Pressable
            key={mode}
            accessibilityRole="tab"
            accessibilityState={{ selected: feedMode === mode }}
            onPress={() => {
              if (mode === feedMode) return;
              setLoading(true);
              setPosts([]);
              setFeedMode(mode);
            }}
            style={[styles.feedModeButton, feedMode === mode && styles.feedModeSelected]}
          >
            <Text style={[styles.feedModeLabel, feedMode === mode && styles.feedModeLabelSelected]}>{mode === 'global' ? 'For everyone' : 'Following'}</Text>
          </Pressable>
        ))}
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

      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {loading ? <ActivityIndicator color={colors.primary} style={styles.loading} /> : null}
      {!loading && error && posts.length === 0 ? (
        <Pressable accessibilityRole="button" onPress={() => { setLoading(true); void refresh(); }} style={styles.retryButton}><Text style={styles.retryLabel}>Try again</Text></Pressable>
      ) : null}
      {!loading && !error && posts.length === 0 ? (
        <EmptyState
          description={feedMode === 'following' ? 'Follow people from Quick Chat, Clubs, or the world feed to build this space.' : 'Break the silence with the first thought.'}
          glyph="✦"
          title={feedMode === 'following' ? 'Your people will show up here' : 'A fresh corner of the internet'}
        />
      ) : null}

      {posts.length > 0 ? <SectionHeader title="Happening now" /> : null}
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
                <Pressable accessibilityLabel="Share post" accessibilityRole="button" onPress={() => void sharePost(post, authorName)} style={styles.shareButton}>
                  <Text style={styles.shareIcon}>↗</Text><Text style={styles.shareLabel}>Share</Text>
                </Pressable>
              </View>
            </Card>
          );
        })}
      </View>
      {posts.length > 0 && hasMore ? (
        <Pressable accessibilityRole="button" disabled={loadingMore} onPress={() => void loadMore()} style={[styles.loadMoreButton, loadingMore && styles.loadMoreDisabled]}>
          {loadingMore ? <ActivityIndicator color={colors.primary} size="small" /> : <Text style={styles.loadMoreLabel}>Load older conversations</Text>}
        </Pressable>
      ) : null}
      {posts.length > 0 && !hasMore ? <Text style={styles.feedEnd}>You’re all caught up.</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pageHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  livePulse: { alignItems: 'center', backgroundColor: colors.accentSoft, borderRadius: radius.pill, flexDirection: 'row', gap: 6, paddingHorizontal: 11, paddingVertical: 7 },
  liveDot: { backgroundColor: colors.accent, borderRadius: 4, height: 7, width: 7 },
  liveText: { color: colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 0.8, textTransform: 'uppercase' },
  feedModeRow: { backgroundColor: colors.surfaceSoft, borderColor: colors.border, borderRadius: radius.pill, borderWidth: 1, flexDirection: 'row', marginTop: spacing.xl, padding: 4 },
  feedModeButton: { alignItems: 'center', borderRadius: radius.pill, flex: 1, paddingVertical: 10 },
  feedModeSelected: { backgroundColor: colors.surfaceRaised },
  feedModeLabel: { color: colors.textSubtle, fontSize: 12, fontWeight: '800' },
  feedModeLabelSelected: { color: colors.text },
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
  retryButton: { alignItems: 'center', alignSelf: 'center', backgroundColor: colors.primary, borderRadius: radius.md, marginTop: spacing.lg, paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  retryLabel: { color: colors.primaryInk, fontSize: 13, fontWeight: '900' },
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
  shareButton: { alignItems: 'center', flexDirection: 'row', gap: 5, paddingHorizontal: spacing.sm, paddingVertical: 7 },
  shareIcon: { color: colors.primary, fontSize: 15, fontWeight: '900' },
  shareLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '800' },
  loadMoreButton: { alignItems: 'center', alignSelf: 'center', backgroundColor: colors.surfaceRaised, borderColor: colors.borderStrong, borderRadius: radius.pill, borderWidth: 1, marginTop: spacing.xl, minWidth: 210, paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  loadMoreDisabled: { opacity: 0.6 },
  loadMoreLabel: { color: colors.primary, fontSize: 12, fontWeight: '900' },
  feedEnd: { color: colors.textSubtle, fontSize: 11, fontWeight: '700', marginTop: spacing.xl, textAlign: 'center' },
});
