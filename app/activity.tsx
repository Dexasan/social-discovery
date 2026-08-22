import { useCallback, useEffect, useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { Avatar, EmptyState, Eyebrow, Heading, Muted, Pill, Screen, SectionHeader } from '@/components/ui';
import { useSession } from '@/context/SessionContext';
import { loadActivity, markActivityRead, subscribeToActivity, type ActivityEvent } from '@/features/activity/api';
import { colors, radius, spacing } from '@/theme/tokens';

function relativeTime(value: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(value).toLocaleDateString();
}

function metadataText(event: ActivityEvent, key: string) {
  const metadata = event.metadata;
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return '';
  const value = metadata[key];
  return typeof value === 'string' ? value : '';
}

function activityCopy(event: ActivityEvent) {
  if (event.kind === 'follow') return 'started following you';
  if (event.kind === 'post_like') return 'liked your post';
  if (event.kind === 'post_reply') return 'replied to your post';
  const emoji = metadataText(event, 'gift_emoji');
  const name = metadataText(event, 'gift_name');
  return `sent you ${emoji ? `${emoji} ` : ''}${name || 'a gift'}`;
}

function activityPreview(event: ActivityEvent) {
  if (event.kind === 'post_reply') return metadataText(event, 'reply_preview');
  if (event.kind === 'post_like') return event.post_body || metadataText(event, 'post_preview');
  if (event.kind === 'gift') return 'A little appreciation from the community.';
  return event.actor_country_code ? `From ${event.actor_country_code}` : 'A new connection from the community.';
}

export default function ActivityScreen() {
  const { user } = useSession();
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async (showIndicator = false) => {
    if (showIndicator) setRefreshing(true);
    setError('');
    try {
      setEvents(await loadActivity());
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not load activity.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (!user) return;
    return subscribeToActivity(user.id, () => void refresh());
  }, [refresh, user]);

  const unread = events.filter((event) => !event.read_at);
  const earlier = events.filter((event) => event.read_at);

  const openEvent = async (event: ActivityEvent) => {
    if (!event.read_at) {
      setEvents((current) => current.map((item) => item.activity_id === event.activity_id
        ? { ...item, read_at: new Date().toISOString() }
        : item));
      void markActivityRead(event.activity_id).catch(() => void refresh());
    }

    if (event.post_id && event.post_body && event.post_author_id) {
      router.push({
        pathname: '/post/[postId]',
        params: {
          postId: event.post_id,
          body: event.post_body,
          author: event.post_author_name || 'Community member',
          authorId: event.post_author_id,
        },
      });
      return;
    }
    router.push({ pathname: '/people/[userId]', params: { userId: event.actor_id } });
  };

  const markAll = async () => {
    if (!unread.length || markingAll) return;
    setMarkingAll(true);
    const readAt = new Date().toISOString();
    setEvents((current) => current.map((event) => ({ ...event, read_at: event.read_at || readAt })));
    try {
      await markActivityRead();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not mark activity as read.');
      await refresh();
    } finally {
      setMarkingAll(false);
    }
  };

  const renderEvent = (event: ActivityEvent) => {
    const name = event.actor_display_name || (event.actor_handle ? `@${event.actor_handle}` : 'Someone');
    return (
      <Pressable
        key={event.activity_id}
        accessibilityRole="button"
        onPress={() => void openEvent(event)}
        style={({ pressed }) => [styles.event, !event.read_at && styles.unreadEvent, pressed && styles.pressed]}
      >
        <View>
          <Avatar label={name} path={event.actor_avatar_path} size={48} />
          <View style={[styles.kindBadge, event.kind === 'gift' && styles.giftBadge]}>
            <Text style={styles.kindGlyph}>{event.kind === 'follow' ? '+' : event.kind === 'post_like' ? '♥' : event.kind === 'post_reply' ? '↩' : '✦'}</Text>
          </View>
        </View>
        <View style={styles.eventCopy}>
          <Text style={styles.eventTitle}><Text style={styles.actorName}>{name}</Text> {activityCopy(event)}</Text>
          <Text numberOfLines={2} style={styles.preview}>{activityPreview(event)}</Text>
          <Text style={styles.time}>{relativeTime(event.created_at)}</Text>
        </View>
        {!event.read_at ? <View accessibilityLabel="Unread" style={styles.unreadDot} /> : <Text style={styles.chevron}>›</Text>}
      </Pressable>
    );
  };

  return (
    <Screen refreshControl={<RefreshControl colors={[colors.primary]} onRefresh={() => void refresh(true)} progressBackgroundColor={colors.surfaceRaised} refreshing={refreshing} />}>
      <View style={styles.topRow}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backGlyph}>‹</Text><Text style={styles.backLabel}>Profile</Text>
        </Pressable>
        {unread.length > 0 ? <Pill label={`${unread.length} new`} tone="accent" /> : <Pill label="Caught up" tone="success" />}
      </View>
      <View style={styles.hero}>
        <Eyebrow>Your community</Eyebrow>
        <Heading compact>Activity</Heading>
        <Muted>Follows, replies, likes, and gifts from the people you meet.</Muted>
      </View>

      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {loading ? <ActivityIndicator color={colors.primary} style={styles.loading} /> : null}
      {!loading && events.length === 0 ? <EmptyState description="When people interact with you, it will appear here." glyph="✦" title="Nothing new yet" /> : null}

      {unread.length > 0 ? (
        <>
          <SectionHeader
            action={<Pressable disabled={markingAll} onPress={() => void markAll()}><Text style={styles.markAll}>{markingAll ? 'Updating…' : 'Mark all read'}</Text></Pressable>}
            title="New"
          />
          <View style={styles.list}>{unread.map(renderEvent)}</View>
        </>
      ) : null}
      {earlier.length > 0 ? (
        <>
          <SectionHeader title="Earlier" />
          <View style={styles.list}>{earlier.map(renderEvent)}</View>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  topRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  backButton: { alignItems: 'center', flexDirection: 'row', gap: 4, paddingVertical: spacing.sm },
  backGlyph: { color: colors.text, fontSize: 28, lineHeight: 28 },
  backLabel: { color: colors.text, fontSize: 14, fontWeight: '800' },
  hero: { gap: spacing.sm, marginTop: spacing.xl },
  loading: { marginTop: spacing.xxl },
  error: { color: colors.danger, fontSize: 13, marginTop: spacing.lg, textAlign: 'center' },
  list: { gap: spacing.sm },
  event: { alignItems: 'center', backgroundColor: colors.surfaceSoft, borderColor: colors.border, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: spacing.md, padding: spacing.md },
  unreadEvent: { backgroundColor: colors.accentSoft, borderColor: '#603128' },
  eventCopy: { flex: 1, gap: 3 },
  eventTitle: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  actorName: { color: colors.text, fontWeight: '900' },
  preview: { color: colors.textSubtle, fontSize: 14, lineHeight: 20 },
  time: { color: colors.textMuted, fontSize: 12, fontWeight: '800', marginTop: 2, textTransform: 'uppercase' },
  kindBadge: { alignItems: 'center', backgroundColor: colors.primary, borderColor: colors.surfaceSoft, borderRadius: 9, borderWidth: 2, bottom: -2, height: 19, justifyContent: 'center', position: 'absolute', right: -3, width: 19 },
  giftBadge: { backgroundColor: colors.warning },
  kindGlyph: { color: colors.primaryInk, fontSize: 12, fontWeight: '900' },
  unreadDot: { backgroundColor: colors.primary, borderRadius: 5, height: 9, width: 9 },
  chevron: { color: colors.textSubtle, fontSize: 23, fontWeight: '300' },
  markAll: { color: colors.link, fontSize: 14, fontWeight: '900', paddingVertical: spacing.sm },
  pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
});
