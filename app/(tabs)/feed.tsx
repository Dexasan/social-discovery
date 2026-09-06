import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { ActivityIndicator, Animated, AppState, PanResponder, Pressable, RefreshControl, Share, StyleSheet, Text, TextInput, View } from 'react-native';

import { Avatar, EmptyState, RetroHeader, Screen, SkeletonRows } from '@/components/ui';
import { useSession } from '@/context/SessionContext';
import { createPost, loadFeed, loadFollowingFeed, setPostLiked, subscribeToNewPosts, type FeedPost } from '@/features/feed/api';
import { colors, radius, spacing } from '@/theme/tokens';

type FeedMode = 'global' | 'following';

function CommentIcon() {
  return (
    <View style={styles.commentIcon}>
      <View style={styles.commentTail} />
    </View>
  );
}

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
  const [composerOpen, setComposerOpen] = useState(false);
  const [feedMode, setFeedMode] = useState<FeedMode>('global');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [newPostsAvailable, setNewPostsAvailable] = useState(false);
  const likesInFlight = useRef(new Set<string>());
  const refreshGeneration = useRef(0);
  const [appIsActive, setAppIsActive] = useState(AppState.currentState === 'active');
  const feedSlideX = useRef(new Animated.Value(0)).current;
  const feedIsSwitching = useRef(false);

  const switchFeedMode = useCallback((nextMode: FeedMode) => {
    if (nextMode === feedMode || feedIsSwitching.current) return;
    feedIsSwitching.current = true;
    const exitDirection = nextMode === 'following' ? -1 : 1;
    Animated.timing(feedSlideX, {
      duration: 120,
      toValue: exitDirection * 48,
      useNativeDriver: true,
    }).start(() => {
      setLoading(true);
      setPosts([]);
      setFeedMode(nextMode);
      feedSlideX.setValue(exitDirection * -48);
      Animated.spring(feedSlideX, {
        damping: 18,
        mass: 0.7,
        stiffness: 210,
        toValue: 0,
        useNativeDriver: true,
      }).start(() => {
        feedIsSwitching.current = false;
      });
    });
  }, [feedMode, feedSlideX]);

  const feedSwipeResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => (
      Math.abs(gesture.dx) > 10 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.25
    ),
    onPanResponderGrant: () => feedSlideX.stopAnimation(),
    onPanResponderMove: (_, gesture) => {
      const swipingPastStart = feedMode === 'global' && gesture.dx > 0;
      const swipingPastEnd = feedMode === 'following' && gesture.dx < 0;
      const resistance = swipingPastStart || swipingPastEnd ? 0.16 : 1;
      feedSlideX.setValue(Math.max(-96, Math.min(96, gesture.dx * resistance)));
    },
    onPanResponderRelease: (_, gesture) => {
      const committed = Math.abs(gesture.dx) >= 58 || Math.abs(gesture.vx) >= 0.55;
      const nextMode: FeedMode = gesture.dx < 0 ? 'following' : 'global';
      if (committed && nextMode !== feedMode) {
        switchFeedMode(nextMode);
        return;
      }
      Animated.spring(feedSlideX, {
        damping: 18,
        mass: 0.7,
        stiffness: 220,
        toValue: 0,
        useNativeDriver: true,
      }).start();
    },
    onPanResponderTerminate: () => {
      Animated.spring(feedSlideX, {
        damping: 18,
        mass: 0.7,
        stiffness: 220,
        toValue: 0,
        useNativeDriver: true,
      }).start();
    },
  }), [feedMode, feedSlideX, switchFeedMode]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => setAppIsActive(state === 'active'));
    return () => subscription.remove();
  }, []);

  const refresh = useCallback(async (showRefreshIndicator = false) => {
    const generation = ++refreshGeneration.current;
    if (showRefreshIndicator) setRefreshing(true);
    setError('');
    try {
      const nextPosts = await (feedMode === 'following' ? loadFollowingFeed() : loadFeed());
      if (generation !== refreshGeneration.current) return;
      setPosts(nextPosts);
      setNewPostsAvailable(false);
      setHasMore(nextPosts.length === 30);
    } catch (nextError) {
      if (generation !== refreshGeneration.current) return;
      setError(nextError instanceof Error ? nextError.message : 'Could not load the feed.');
    } finally {
      if (generation === refreshGeneration.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [feedMode]);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  useFocusEffect(useCallback(() => {
    if (!appIsActive) return;
    return subscribeToNewPosts(() => setNewPostsAvailable(true));
  }, [appIsActive, refresh]));

  const publish = async () => {
    if (!user || !body.trim() || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      await createPost(user.id, body);
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
    if (!user || likesInFlight.current.has(post.post_id)) return;
    likesInFlight.current.add(post.post_id);
    const nextLiked = !post.liked_by_me;
    setPosts((current) => current.map((item) => item.post_id === post.post_id
      ? { ...item, liked_by_me: nextLiked, like_count: item.like_count + (nextLiked ? 1 : -1) }
      : item));
    try {
      await setPostLiked(post.post_id, user.id, nextLiked);
    } catch (nextError) {
      setPosts((current) => current.map((item) => item.post_id === post.post_id ? post : item));
      setError(nextError instanceof Error ? nextError.message : 'Could not update this like.');
    } finally {
      likesInFlight.current.delete(post.post_id);
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

  const openPost = (post: FeedPost, authorName: string) => router.push({
    pathname: '/post/[postId]',
    params: { postId: post.post_id, body: post.body, author: authorName, authorId: post.author_id },
  });

  return (
    <Screen refreshControl={<RefreshControl colors={[colors.accent]} onRefresh={() => void refresh(true)} progressBackgroundColor={colors.surfaceRaised} refreshing={refreshing} tintColor={colors.accent} />}>
      <RetroHeader
        eyebrow="A LITTLE OF EVERYONE’S WORLD"
        action={<Pressable accessibilityRole="button" accessibilityLabel="Your profile" onPress={() => router.push('/(tabs)/profile')}><Avatar label={profile?.displayName || 'You'} path={profile?.avatarPath} size={42} /></Pressable>}
        title="Discover"
        tone="cobalt"
      />
      <View style={styles.topBar}>
        <View style={styles.feedModeRow}>
          {(['global', 'following'] as const).map((mode) => (
            <Pressable
              key={mode}
              accessibilityRole="tab"
              accessibilityState={{ selected: feedMode === mode }}
              onPress={() => switchFeedMode(mode)}
              style={[styles.feedModeButton, feedMode === mode && styles.feedModeSelected]}
            >
              <Text style={[styles.feedModeLabel, feedMode === mode && styles.feedModeLabelSelected]}>{mode === 'global' ? 'For you' : 'Following'}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {newPostsAvailable ? <Pressable accessibilityRole="button" accessibilityLabel="Show new posts" onPress={() => void refresh(true)} style={styles.newPostsButton}><Text style={styles.newPostsLabel}>↑  New conversations · Tap to refresh</Text></Pressable> : null}

      <Animated.View
        {...feedSwipeResponder.panHandlers}
        accessibilityLabel={`${feedMode === 'global' ? 'For you' : 'Following'} feed. Swipe horizontally to switch feeds.`}
        style={[styles.feedPane, { transform: [{ translateX: feedSlideX }] }]}
      >
      <View style={[styles.composer, composerOpen && styles.composerOpen]}>
        <Avatar label={profile?.displayName || 'You'} path={profile?.avatarPath} size={40} />
        <View style={styles.composerMain}>
          <TextInput
            accessibilityLabel="New post"
            maxLength={500}
            multiline
            onChangeText={setBody}
            onFocus={() => setComposerOpen(true)}
            placeholder="What’s on your mind?"
            placeholderTextColor={colors.textMuted}
            style={[styles.composeInput, composerOpen && styles.composeInputOpen]}
            value={body}
          />
          {composerOpen ? (
            <View style={styles.publishRow}>
              <Text style={styles.counter}>{body.length}/500</Text>
              <Pressable accessibilityRole="button" disabled={!body.trim() || submitting} onPress={() => void publish()} style={[styles.publishButton, (!body.trim() || submitting) && styles.disabled]}>
                <Text style={styles.publishLabel}>{submitting ? 'Posting…' : 'Post'}</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </View>

      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {loading ? <SkeletonRows /> : null}
      {!loading && error && posts.length === 0 ? (
        <Pressable accessibilityRole="button" onPress={() => { setLoading(true); void refresh(); }} style={styles.retryButton}><Text style={styles.retryLabel}>Try again</Text></Pressable>
      ) : null}
      {!loading && !error && posts.length === 0 ? (
        <EmptyState description={feedMode === 'following' ? 'Follow people from Quick Chat or Clubs to build your timeline.' : 'Break the silence with the first thought.'} glyph="✦" title={feedMode === 'following' ? 'Your people will show up here' : 'Nothing here yet'} />
      ) : null}

      <View style={styles.timeline}>
        {posts.map((post) => {
          const authorName = post.author_display_name || (post.author_handle ? `@${post.author_handle}` : 'Community member');
          return (
            <View key={post.post_id} style={styles.post}>
              <Pressable accessibilityRole="button" accessibilityLabel={`View ${authorName}’s profile`} onPress={() => router.push({ pathname: '/people/[userId]', params: { userId: post.author_id } })}>
                <Avatar label={authorName} path={post.author_avatar_path} size={44} />
              </Pressable>
              <View style={styles.postMain}>
                <Pressable accessibilityLabel={`Open post and ${post.reply_count} replies`} accessibilityRole="button" onPress={() => openPost(post, authorName)} style={styles.postTapArea}>
                  <View style={styles.authorLine}>
                    <Text numberOfLines={1} style={styles.name}>{authorName}</Text>
                    <Text numberOfLines={1} style={styles.meta}>{relativeTime(post.created_at)}</Text>
                  </View>
                  <Text numberOfLines={1} style={styles.handle}>@{post.author_handle ?? 'member'}</Text>
                  <Text style={styles.postBody}>{post.body}</Text>
                </Pressable>
                <View style={styles.actions}>
                  <Pressable accessibilityRole="button" accessibilityState={{ selected: post.liked_by_me }} accessibilityLabel={post.liked_by_me ? 'Unlike post' : 'Like post'} onPress={() => void toggleLike(post)} style={({ pressed }) => [styles.actionButton, pressed && styles.actionPressed]}>
                    <Text style={[styles.actionIcon, post.liked_by_me && styles.actionLiked]}>{post.liked_by_me ? '♥' : '♡'}</Text><Text style={[styles.actionText, post.liked_by_me && styles.actionLiked]}>{post.like_count}</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel="View replies" onPress={() => openPost(post, authorName)} style={styles.actionButton}>
                    <CommentIcon /><Text style={styles.actionText}>{post.reply_count}</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel="Share post" onPress={() => void sharePost(post, authorName)} style={styles.shareButton}><Text style={styles.shareGlyph}>↗</Text></Pressable>
                </View>
              </View>
            </View>
          );
        })}
      </View>
      {posts.length > 0 && hasMore ? (
        <Pressable disabled={loadingMore} onPress={() => void loadMore()} style={styles.loadMoreButton}>
          {loadingMore ? <ActivityIndicator color={colors.accent} size="small" /> : <Text style={styles.loadMoreLabel}>Show more</Text>}
        </Pressable>
      ) : null}
      {posts.length > 0 && !hasMore ? <Text style={styles.feedEnd}>You’re all caught up.</Text> : null}
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  handle: { color: colors.textSubtle, fontSize: 12, marginTop: 3 },
  actionPressed: { transform: [{ scale: 0.9 }] },
  shareGlyph: { color: colors.textSubtle, fontSize: 23 },
  newPostsButton: { alignSelf: 'center', backgroundColor: colors.cobaltSoft, borderRadius: 22, marginTop: 10, paddingHorizontal: 18, paddingVertical: 14 },
  newPostsLabel: { color: colors.cobalt, fontSize: 12, fontWeight: '700' },
  feedPane: { width: '100%' },
  topBar: { backgroundColor: colors.surface, borderRadius: 16, marginBottom: 8, marginTop: 22, paddingHorizontal: 5, paddingVertical: 5 },
  feedModeRow: { flexDirection: 'row', gap: 6 },
  feedModeButton: { borderRadius: 12, flex: 1, paddingVertical: 12, paddingHorizontal: 8 },
  feedModeSelected: { backgroundColor: colors.surfaceRaised },
  feedModeLabel: { color: colors.textSubtle, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  feedModeLabelSelected: { color: colors.text },
  composer: { alignItems: 'flex-start', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 20, borderWidth: 1, flexDirection: 'row', gap: 12, marginTop: 10, padding: 14 },
  composerOpen: { paddingBottom: spacing.lg },
  composerMain: { flex: 1, gap: spacing.md },
  composeInput: { color: colors.text, fontSize: 16, lineHeight: 22, minHeight: 40, paddingHorizontal: 0, paddingTop: 8, textAlignVertical: 'top' },
  composeInputOpen: { minHeight: 74 },
  publishRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  counter: { color: colors.textSubtle, fontSize: 12 },
  publishButton: { backgroundColor: colors.accent, borderRadius: radius.pill, paddingHorizontal: 22, paddingVertical: 12 },
  publishLabel: { color: colors.primary, fontSize: 14, fontWeight: '900' },
  disabled: { opacity: 0.4 },
  loading: { marginVertical: spacing.xl },
  error: { color: colors.danger, fontSize: 14, lineHeight: 21, marginTop: spacing.md, textAlign: 'center' },
  retryButton: { alignItems: 'center', alignSelf: 'center', backgroundColor: colors.primary, borderRadius: radius.md, marginTop: spacing.lg, paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  retryLabel: { color: colors.white, fontSize: 15, fontWeight: '900' },
  timeline: { gap: 12, marginTop: 18 },
  post: { alignItems: 'flex-start', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 22, borderWidth: 1, flexDirection: 'row', gap: 12, padding: 16 },
  postMain: { flex: 1 },
  postTapArea: { borderRadius: 6, minHeight: 42 },
  authorLine: { alignItems: 'center', flexDirection: 'row', gap: 10, justifyContent: 'space-between' },
  name: { color: colors.text, flex: 1, fontSize: 15, fontWeight: '700' },
  meta: { color: colors.textSubtle, fontSize: 12 },
  postBody: { color: colors.text, fontSize: 16, lineHeight: 25, marginTop: 12 },
  actions: { alignItems: 'center', flexDirection: 'row', gap: 20, marginTop: 8 },
  actionButton: { alignItems: 'center', flexDirection: 'row', gap: 7, minHeight: 44, minWidth: 44 },
  actionIcon: { color: colors.textSubtle, fontSize: 24 },
  commentIcon: { borderColor: colors.textSubtle, borderRadius: 6, borderWidth: 1.6, height: 16, width: 19 },
  commentTail: { backgroundColor: colors.surface, borderBottomColor: colors.textSubtle, borderBottomWidth: 1.6, bottom: -3, height: 6, left: 3, position: 'absolute', transform: [{ rotate: '38deg' }], width: 6 },
  actionText: { color: colors.textSubtle, fontSize: 12, fontWeight: '600' },
  actionLiked: { color: colors.danger },
  shareButton: { alignItems: 'center', justifyContent: 'center', marginLeft: 'auto', minHeight: 44, minWidth: 44 },
  loadMoreButton: { alignItems: 'center', alignSelf: 'center', borderColor: colors.borderStrong, borderRadius: radius.pill, borderWidth: 1, marginTop: spacing.lg, minWidth: 150, paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  loadMoreLabel: { color: colors.text, fontSize: 14, fontWeight: '900' },
  feedEnd: { color: colors.textSubtle, fontSize: 13, marginTop: spacing.lg, textAlign: 'center' },
});
