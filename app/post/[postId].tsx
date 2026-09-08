import { Text, TextInput } from '@/components/Typography';
import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Avatar, PixelRule, RetroGlyph, RetroHeader, Screen } from '@/components/ui';
import { useSession } from '@/context/SessionContext';
import { createReply, loadPostReplies, type FeedReply } from '@/features/feed/api';
import { loadAvatarPathMap } from '@/features/profile/avatar-data';
import { colors, fonts, spacing } from '@/theme/tokens';

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function PostDetailScreen() {
  const params = useLocalSearchParams<{ postId: string; body?: string; author?: string; authorId?: string }>();
  const postId = first(params.postId);
  const body = first(params.body) ?? 'Conversation';
  const author = first(params.author) ?? 'Community member';
  const authorId = first(params.authorId);
  const { profile, user } = useSession();
  const [replies, setReplies] = useState<FeedReply[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [authorAvatarPath, setAuthorAvatarPath] = useState<string | null>(null);

  const refresh = async () => {
    if (!postId) return;
    try {
      const [nextReplies, avatars] = await Promise.all([
        loadPostReplies(postId),
        loadAvatarPathMap([authorId]),
      ]);
      setReplies(nextReplies);
      setAuthorAvatarPath(authorId ? avatars.get(authorId) ?? null : null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not load replies.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, [authorId, postId]);

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
      <RetroHeader
        action={<View style={styles.replyBadge}><Text style={styles.replyBadgeText}>{String(replies.length).padStart(2, '0')} REPLIES</Text></View>}
        eyebrow="PUBLIC THREAD"
        glyph="▤"
        title="Conversation"
        tone="cobalt"
      />
      <Pressable accessibilityLabel="Back to feed" accessibilityRole="button" onPress={() => router.back()} style={styles.backStrip}>
        <RetroGlyph glyph="‹" size="sm" tone="neutral" /><Text style={styles.backLabel}>BACK TO DISCOVER</Text><View style={styles.backPixels}><View style={styles.backPixel} /><View style={styles.backPixel} /></View>
      </Pressable>

      <View style={styles.postCard}>
        <Text style={styles.originalLabel}>ORIGINAL YAP / 01</Text>
        <Pressable
          accessibilityLabel={`Open ${author}'s profile`}
          accessibilityRole="button"
          disabled={!authorId}
          onPress={() => authorId && router.push({ pathname: '/people/[userId]', params: { userId: authorId } })}
          style={styles.authorRow}
        >
          <Avatar label={author} path={authorAvatarPath} size={42} />
          <Text style={styles.author}>{author}</Text>
        </Pressable>
        <Text style={styles.body}>{body}</Text>
        <View style={styles.threadStem} />
      </View>

      <View style={styles.composer}>
        <Avatar label={profile?.displayName || 'You'} path={profile?.avatarPath} size={36} />
        <TextInput
          accessibilityLabel="Reply"
          maxLength={500}
          multiline
          onChangeText={setDraft}
          placeholder={`Reply to ${author}`}
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          value={draft}
        />
        <Pressable
          accessibilityLabel="Send reply"
          accessibilityRole="button"
          disabled={!draft.trim() || submitting}
          onPress={() => void reply()}
          style={[styles.sendButton, (!draft.trim() || submitting) && styles.sendButtonDisabled]}
        >
          {submitting ? <ActivityIndicator color={colors.primary} size="small" /> : <Text style={styles.sendGlyph}>↑</Text>}
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? <ActivityIndicator color={colors.primary} style={styles.loading} /> : null}
      <PixelRule label={replies.length ? `${replies.length} ${replies.length === 1 ? 'reply' : 'replies'}` : 'replies'} />
      {!loading && replies.length === 0 ? <View style={styles.empty}><RetroGlyph glyph="⌁" tone="neutral" /><View><Text style={styles.emptyTitle}>NO SIGNAL YET</Text><Text style={styles.emptyText}>Be the first reply.</Text></View></View> : null}
      <View style={styles.replies}>
        {replies.map((item, index) => {
          const name = item.author_display_name || (item.author_handle ? `@${item.author_handle}` : 'Community member');
          return (
            <View key={item.reply_id} style={styles.replyCard}>
              <Text style={styles.replySerial}>R/{String(index + 1).padStart(2, '0')}</Text>
              <Pressable
                accessibilityLabel={`Open ${name}'s profile`}
                accessibilityRole="button"
                onPress={() => router.push({ pathname: '/people/[userId]', params: { userId: item.author_id } })}
              >
                <Avatar label={name} path={item.author_avatar_path} size={38} />
              </Pressable>
              <View style={styles.replyCopy}>
                <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/people/[userId]', params: { userId: item.author_id } })}>
                  <Text style={styles.author}>{name}</Text>
                </Pressable>
                <Text style={styles.replyBody}>{item.body}</Text>
              </View>
            </View>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  replyBadge: { backgroundColor: colors.cobaltSoft, borderColor: colors.border, borderRadius: 7, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 7 },
  replyBadgeText: { color: colors.cobalt, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  backStrip: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  backLabel: { color: colors.textSubtle, fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  backPixels: { flexDirection: 'row', gap: 3, marginLeft: 'auto' },
  backPixel: { backgroundColor: colors.accent, height: 4, width: 4 },
  postCard: { backgroundColor: 'transparent', borderColor: colors.primary, borderRadius: 0, borderWidth: 0, borderTopWidth: 1.5, borderBottomWidth: 1.5, gap: 18, marginTop: 20, paddingVertical: 24, paddingHorizontal: 0, position: 'relative' },
  originalLabel: { color: colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.1, position: 'absolute', right: 8, top: 7 },
  authorRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  author: { color: colors.text, fontSize: 14, fontWeight: '800' },
  body: { color: colors.text, fontFamily: fonts.editorial, fontSize: 30, lineHeight: 37 },
  threadStem: { backgroundColor: colors.borderStrong, bottom: -34, height: 34, left: 39, position: 'absolute', width: 2 },
  composer: { alignItems: 'center', backgroundColor: colors.backgroundRaised, borderColor: colors.border, borderRadius: 10, borderWidth: 1, flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, minHeight: 66, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm },
  input: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 8, borderWidth: 1, color: colors.text, flex: 1, fontSize: 14.5, maxHeight: 86, minHeight: 42, paddingHorizontal: spacing.md, paddingVertical: 10, textAlignVertical: 'center' },
  sendButton: { alignItems: 'center', backgroundColor: colors.accent, borderColor: colors.primary, borderRadius: 7, borderWidth: 2, height: 40, justifyContent: 'center', width: 40 },
  sendButtonDisabled: { opacity: 0.35 },
  sendGlyph: { color: colors.primaryInk, fontSize: 22, fontWeight: '700', lineHeight: 24 },
  error: { color: colors.danger, fontSize: 13, marginVertical: spacing.md, textAlign: 'center' },
  loading: { marginVertical: spacing.xl },
  empty: { alignItems: 'center', backgroundColor: colors.backgroundRaised, borderColor: colors.border, borderRadius: 10, borderStyle: 'dashed', borderWidth: 1, flexDirection: 'row', gap: spacing.md, padding: spacing.lg },
  emptyTitle: { color: colors.text, fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  emptyText: { color: colors.textSubtle, fontSize: 13, marginTop: 3 },
  replies: { gap: spacing.sm },
  replyCard: { alignItems: 'flex-start', borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: 'row', gap: 12, paddingVertical: 20, position: 'relative' },
  replySerial: { color: colors.borderStrong, fontSize: 10, fontWeight: '900', letterSpacing: 0.8, position: 'absolute', right: 6, top: 5 },
  replyCopy: { flex: 1, gap: spacing.sm },
  replyBody: { color: colors.text, fontSize: 15, lineHeight: 21 },
});
