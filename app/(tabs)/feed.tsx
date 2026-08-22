import { useCallback, useMemo, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';

import { Avatar, EmptyState, Screen } from '@/components/ui';
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
  const [composerOpen, setComposerOpen] = useState(false);
  const [feedMode, setFeedMode] = useState<FeedMode>('global');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [topicFilter, setTopicFilter] = useState<string | null>(null);

  const popularTopics = useMemo(() => {
    const counts = new Map<string, number>();
    for (const post of posts) {
      if (post.topic) counts.set(post.topic, (counts.get(post.topic) ?? 0) + 1);
    }
    return [...counts.entries()].sort((left, right) => right[1] - left[1]).slice(0, 8).map(([name]) => name);
  }, [posts]);
  const visiblePosts = topicFilter ? posts.filter((post) => post.topic === topicFilter) : posts;

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

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  const publish = async () => {
    if (!user || !body.trim() || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      await createPost(user.id, body, topic);
      setBody('');
      setComposerOpen(false);
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
      await Share.share({ message: `${post.body}\n\n— ${authorName} on YAPPIE` });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not open the share menu.');
    }
  };

  return (
    <Screen refreshControl={<RefreshControl colors={[colors.primary]} onRefresh={() => void refresh(true)} progressBackgroundColor={colors.surfaceRaised} refreshing={refreshing} tintColor={colors.primary} />}>
      <View style={styles.topBar}>
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
              <Text style={[styles.feedModeLabel, feedMode === mode && styles.feedModeLabelSelected]}>{mode === 'global' ? 'For you' : 'Following'}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.fresh}><View style={styles.liveDot} /><Text style={styles.freshText}>Fresh</Text></View>
      </View>

      <View style={[styles.composer, composerOpen && styles.composerOpen]}>
        <Avatar label={profile?.displayName || 'You'} path={profile?.avatarPath} size={40} />
        <View style={styles.composerMain}>
          <TextInput
            accessibilityLabel="New post"
            maxLength={500}
            multiline
            onChangeText={setBody}
            onFocus={() => setComposerOpen(true)}
            placeholder="What’s happening?"
            placeholderTextColor={colors.textMuted}
            style={[styles.composeInput, composerOpen && styles.composeInputOpen]}
            value={body}
          />
          {composerOpen ? (
            <>
              <View style={styles.topics}>
                {topics.map((option) => (
                  <Pressable key={option} onPress={() => setTopic(option)} style={[styles.topicChoice, topic === option && styles.topicSelected]}>
                    <Text style={[styles.topicText, topic === option && styles.topicTextSelected]}>{option}</Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.publishRow}>
                <Text style={styles.counter}>{body.length}/500</Text>
                <Pressable disabled={!body.trim() || submitting} onPress={() => void publish()} style={[styles.publishButton, (!body.trim() || submitting) && styles.disabled]}>
                  <Text style={styles.publishLabel}>{submitting ? 'Posting…' : 'Post'}</Text>
                </Pressable>
              </View>
            </>
          ) : null}
        </View>
      </View>

      {popularTopics.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.topicRail}>
          <View style={styles.topicRailInner}>
            <Pressable onPress={() => setTopicFilter(null)} style={[styles.railTopic, !topicFilter && styles.railTopicSelected]}><Text style={[styles.railTopicText, !topicFilter && styles.railTopicTextSelected]}>Everything</Text></Pressable>
            {popularTopics.map((item) => (
              <Pressable key={item} onPress={() => setTopicFilter((current) => current === item ? null : item)} style={[styles.railTopic, topicFilter === item && styles.railTopicSelected]}>
                <Text style={[styles.railTopicText, topicFilter === item && styles.railTopicTextSelected]}>#{item.replace(/\s+/g, '')}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      ) : null}

      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {loading ? <ActivityIndicator color={colors.primary} style={styles.loading} /> : null}
      {!loading && error && posts.length === 0 ? (
        <Pressable accessibilityRole="button" onPress={() => { setLoading(true); void refresh(); }} style={styles.retryButton}><Text style={styles.retryLabel}>Try again</Text></Pressable>
      ) : null}
      {!loading && !error && posts.length === 0 ? (
        <EmptyState description={feedMode === 'following' ? 'Follow people from Quick Chat or Clubs to build your timeline.' : 'Break the silence with the first thought.'} glyph="✦" title={feedMode === 'following' ? 'Your people will show up here' : 'Nothing here yet'} />
      ) : null}

      {!loading && topicFilter && visiblePosts.length === 0 ? <Text style={styles.filterEmpty}>Nothing under #{topicFilter.replace(/\s+/g, '')} yet.</Text> : null}
      <View style={styles.timeline}>
        {visiblePosts.map((post) => {
          const authorName = post.author_display_name || (post.author_handle ? `@${post.author_handle}` : 'Community member');
          return (
            <View key={post.post_id} style={styles.post}>
              <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/people/[userId]', params: { userId: post.author_id } })}>
                <Avatar label={authorName} path={post.author_avatar_path} size={40} />
              </Pressable>
              <View style={styles.postMain}>
                <Pressable onPress={() => router.push({ pathname: '/people/[userId]', params: { userId: post.author_id } })} style={styles.authorLine}>
                  <Text numberOfLines={1} style={styles.name}>{authorName}</Text>
                  <Text numberOfLines={1} style={styles.meta}>@{post.author_handle ?? 'member'} · {relativeTime(post.created_at)}</Text>
                </Pressable>
                {post.topic ? <Pressable onPress={() => setTopicFilter(post.topic)}><Text style={styles.postTopic}>#{post.topic.replace(/\s+/g, '')}</Text></Pressable> : null}
                <Text style={styles.postBody}>{post.body}</Text>
                <View style={styles.actions}>
                  <Pressable accessibilityLabel="Like post" onPress={() => void toggleLike(post)} style={styles.actionButton}>
                    <Text style={[styles.actionIcon, post.liked_by_me && styles.actionLiked]}>{post.liked_by_me ? '♥' : '♡'}</Text><Text style={[styles.actionText, post.liked_by_me && styles.actionLiked]}>{post.like_count}</Text>
                  </Pressable>
                  <Pressable onPress={() => router.push({ pathname: '/post/[postId]', params: { postId: post.post_id, body: post.body, author: authorName, authorId: post.author_id } })} style={styles.actionButton}>
                    <Text style={styles.actionIcon}>○</Text><Text style={styles.actionText}>{post.reply_count}</Text>
                  </Pressable>
                  <Pressable accessibilityLabel="Share post" onPress={() => void sharePost(post, authorName)} style={styles.shareButton}><Text style={styles.shareIcon}>↗</Text></Pressable>
                </View>
              </View>
            </View>
          );
        })}
      </View>
      {posts.length > 0 && hasMore ? (
        <Pressable disabled={loadingMore} onPress={() => void loadMore()} style={styles.loadMoreButton}>
          {loadingMore ? <ActivityIndicator color={colors.primary} size="small" /> : <Text style={styles.loadMoreLabel}>Show more</Text>}
        </Pressable>
      ) : null}
      {posts.length > 0 && !hasMore ? <Text style={styles.feedEnd}>You’re all caught up.</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: { alignItems: 'flex-end', borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', justifyContent: 'space-between', marginBottom: 0, marginHorizontal: -18, paddingHorizontal: 18 },
  feedModeRow: { flexDirection: 'row', gap: spacing.xl },
  feedModeButton: { borderBottomColor: 'transparent', borderBottomWidth: 3, minWidth: 78, paddingBottom: 12, paddingHorizontal: 2, paddingTop: 5 },
  feedModeSelected: { borderBottomColor: colors.signal },
  feedModeLabel: { color: colors.textMuted, fontSize: 15, fontWeight: '800', textAlign: 'center' },
  feedModeLabelSelected: { color: colors.text },
  fresh: { alignItems: 'center', flexDirection: 'row', gap: 6, paddingBottom: 14 },
  liveDot: { backgroundColor: colors.success, borderRadius: 5, height: 9, marginRight: spacing.sm, width: 9 },
  freshText: { color: colors.textSubtle, fontSize: 11, fontWeight: '900', letterSpacing: 0.8, textTransform: 'uppercase' },
  composer: { alignItems: 'flex-start', backgroundColor: colors.background, borderBottomColor: colors.border, borderWidth: 0, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: spacing.md, marginHorizontal: -18, paddingHorizontal: 18, paddingVertical: 11 },
  composerOpen: { paddingBottom: spacing.lg },
  composerMain: { flex: 1, gap: spacing.md },
  composeInput: { color: colors.text, fontSize: 16, lineHeight: 22, minHeight: 40, paddingHorizontal: 0, paddingTop: 8, textAlignVertical: 'top' },
  composeInputOpen: { minHeight: 74 },
  topics: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  topicChoice: { borderColor: colors.border, borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6 },
  topicSelected: { backgroundColor: colors.signalSoft, borderColor: '#3B5421' },
  topicText: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  topicTextSelected: { color: colors.signal, fontWeight: '900' },
  publishRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  counter: { color: colors.textSubtle, fontSize: 12 },
  publishButton: { backgroundColor: colors.signal, borderRadius: radius.pill, paddingHorizontal: 20, paddingVertical: 10 },
  publishLabel: { color: colors.primary, fontSize: 14, fontWeight: '900' },
  topicRail: { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth, marginHorizontal: -18 },
  topicRailInner: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: 18, paddingVertical: 9 },
  railTopic: { borderColor: 'transparent', borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 7 },
  railTopicSelected: { backgroundColor: colors.surfaceRaised, borderColor: colors.borderStrong },
  railTopicText: { color: colors.textSubtle, fontSize: 12.5, fontWeight: '800' },
  railTopicTextSelected: { color: colors.text },
  disabled: { opacity: 0.4 },
  loading: { marginVertical: spacing.xl },
  error: { color: colors.danger, fontSize: 14, lineHeight: 21, marginTop: spacing.md, textAlign: 'center' },
  retryButton: { alignItems: 'center', alignSelf: 'center', backgroundColor: colors.primary, borderRadius: radius.md, marginTop: spacing.lg, paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  retryLabel: { color: colors.white, fontSize: 15, fontWeight: '900' },
  timeline: { marginHorizontal: -18 },
  filterEmpty: { color: colors.textMuted, fontSize: 14, paddingVertical: spacing.xl, textAlign: 'center' },
  post: { alignItems: 'flex-start', backgroundColor: colors.background, borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: spacing.md, paddingHorizontal: 18, paddingVertical: 11 },
  postMain: { flex: 1 },
  authorLine: { alignItems: 'baseline', flexDirection: 'row', gap: 5 },
  name: { color: colors.text, fontSize: 15, fontWeight: '900', maxWidth: '48%' },
  meta: { color: colors.textSubtle, flex: 1, fontSize: 13 },
  postTopic: { color: colors.signal, fontSize: 11.5, fontWeight: '800', marginTop: 2 },
  postBody: { color: colors.text, fontSize: 15.5, lineHeight: 21, marginTop: 4 },
  actions: { alignItems: 'center', flexDirection: 'row', gap: 32, marginTop: 7 },
  actionButton: { alignItems: 'center', flexDirection: 'row', gap: 5, minHeight: 28 },
  actionIcon: { color: colors.textMuted, fontSize: 18 },
  actionText: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  actionLiked: { color: colors.danger },
  shareButton: { marginLeft: 'auto', paddingHorizontal: spacing.sm, paddingVertical: 3 },
  shareIcon: { color: colors.textMuted, fontSize: 17, fontWeight: '900' },
  loadMoreButton: { alignItems: 'center', alignSelf: 'center', borderColor: colors.borderStrong, borderRadius: radius.pill, borderWidth: 1, marginTop: spacing.lg, minWidth: 150, paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  loadMoreLabel: { color: colors.text, fontSize: 14, fontWeight: '900' },
  feedEnd: { color: colors.textSubtle, fontSize: 13, marginTop: spacing.lg, textAlign: 'center' },
});
