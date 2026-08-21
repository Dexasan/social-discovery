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
      await Share.share({ message: `${post.body}\n\n— ${authorName} on YAPPIE` });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not open the share menu.');
    }
  };

  return (
    <Screen refreshControl={<RefreshControl colors={[colors.primary]} onRefresh={() => void refresh(true)} progressBackgroundColor={colors.surfaceRaised} refreshing={refreshing} tintColor={colors.primary} />}>
      <View style={styles.pageHeader}>
        <View>
          <Eyebrow>OPEN FREQUENCY</Eyebrow>
          <Heading compact>The internet, with a pulse.</Heading>
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
            <Text style={[styles.feedModeLabel, feedMode === mode && styles.feedModeLabelSelected]}>{mode === 'global' ? 'Everyone' : 'My people'}</Text>
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
            placeholder="Start a conversation…"
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
        {posts.map((post, index) => {
          const authorName = post.author_display_name || (post.author_handle ? `@${post.author_handle}` : 'Community member');
          return (
            <Card key={post.post_id} style={[styles.postCard, index % 3 === 0 && styles.postCardSignal, index % 3 === 1 && styles.postCardCobalt]}>
              <Text style={styles.postIndex}>{String(index + 1).padStart(2, '0')}</Text>
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
  pageHeader: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.md, justifyContent: 'space-between' },
  livePulse: { alignItems: 'center', backgroundColor: colors.accentSoft, borderColor: '#FFC4B9', borderRadius: radius.pill, borderWidth: 1, flexDirection: 'row', gap: 6, paddingHorizontal: 11, paddingVertical: 7 },
  liveDot: { backgroundColor: colors.accent, borderRadius: 4, height: 7, width: 7 },
  liveText: { color: colors.accent, fontSize: 12, fontWeight: '900', letterSpacing: 0.8, textTransform: 'uppercase' },
  feedModeRow: { backgroundColor: colors.surfaceRaised, borderColor: colors.border, borderRadius: 19, borderWidth: 1, flexDirection: 'row', marginTop: spacing.xl, padding: 5 },
  feedModeButton: { alignItems: 'center', borderRadius: 15, flex: 1, paddingVertical: 13 },
  feedModeSelected: { backgroundColor: colors.primary },
  feedModeLabel: { color: colors.textMuted, fontSize: 14, fontWeight: '800' },
  feedModeLabelSelected: { color: colors.white },
  composerCard: { backgroundColor: colors.cobaltSoft, borderColor: '#BFC9FF', borderRadius: 30, gap: spacing.md, marginTop: spacing.xl, transform: [{ rotate: '-0.5deg' }] },
  composeTop: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.md },
  composeInput: { color: colors.text, flex: 1, fontSize: 18, fontWeight: '600', lineHeight: 27, minHeight: 92, paddingTop: spacing.sm, textAlignVertical: 'top' },
  composerRule: { backgroundColor: colors.border, height: StyleSheet.hairlineWidth },
  topics: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  topicChoice: { backgroundColor: 'rgba(255,255,255,0.58)', borderColor: '#BFC9FF', borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9 },
  topicSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  topicText: { color: colors.textMuted, fontSize: 13, fontWeight: '800' },
  topicTextSelected: { color: colors.white },
  publishRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  counter: { color: colors.textMuted, fontSize: 13, fontWeight: '800' },
  publishButton: { minWidth: 156 },
  loading: { marginVertical: spacing.xl },
  error: { color: colors.danger, fontSize: 14, lineHeight: 21, marginTop: spacing.md, textAlign: 'center' },
  retryButton: { alignItems: 'center', alignSelf: 'center', backgroundColor: colors.primary, borderRadius: radius.md, marginTop: spacing.lg, paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  retryLabel: { color: colors.primaryInk, fontSize: 15, fontWeight: '900' },
  list: { gap: spacing.lg },
  postCard: { overflow: 'hidden', paddingTop: 52 },
  postCardSignal: { backgroundColor: colors.signalSoft, borderColor: '#CDE987', transform: [{ rotate: '0.45deg' }] },
  postCardCobalt: { backgroundColor: colors.cobaltSoft, borderColor: '#BFC9FF', transform: [{ rotate: '-0.45deg' }] },
  postIndex: { color: 'rgba(23,24,27,0.12)', fontSize: 50, fontWeight: '900', letterSpacing: -3, position: 'absolute', right: 15, top: 0 },
  authorRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  authorLink: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: spacing.md },
  authorCopy: { flex: 1 },
  name: { color: colors.text, fontSize: 17, fontWeight: '900', letterSpacing: -0.25 },
  meta: { color: colors.textMuted, fontSize: 13, marginTop: 3 },
  postBody: { color: colors.text, fontSize: 20, fontWeight: '600', letterSpacing: -0.3, lineHeight: 29, marginVertical: spacing.lg },
  actions: { alignItems: 'center', borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: spacing.sm, paddingTop: spacing.md },
  actionButton: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.65)', borderRadius: radius.pill, flexDirection: 'row', gap: 7, minHeight: 42, minWidth: 62, paddingHorizontal: 13, paddingVertical: 8 },
  actionButtonActive: { backgroundColor: colors.primarySoft },
  actionIcon: { color: colors.textMuted, fontSize: 18, fontWeight: '700' },
  action: { color: colors.textMuted, fontSize: 14, fontWeight: '800' },
  actionActive: { color: colors.danger },
  actionSpacer: { flex: 1 },
  shareButton: { alignItems: 'center', flexDirection: 'row', gap: 5, paddingHorizontal: spacing.sm, paddingVertical: 7 },
  shareIcon: { color: colors.primary, fontSize: 15, fontWeight: '900' },
  shareLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '800' },
  loadMoreButton: { alignItems: 'center', alignSelf: 'center', backgroundColor: colors.surfaceRaised, borderColor: colors.borderStrong, borderRadius: radius.pill, borderWidth: 1, marginTop: spacing.xl, minWidth: 210, paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  loadMoreDisabled: { opacity: 0.6 },
  loadMoreLabel: { color: colors.primary, fontSize: 15, fontWeight: '900' },
  feedEnd: { color: colors.textSubtle, fontSize: 14, fontWeight: '700', marginTop: spacing.xl, textAlign: 'center' },
});
