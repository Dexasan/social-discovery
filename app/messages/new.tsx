import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Avatar, EmptyState, Eyebrow, Heading, Muted, Pill, Screen } from '@/components/ui';
import { searchMessageProfiles, type MessageProfile } from '@/features/messages/api';
import { getOrCreateDirectConversation } from '@/features/social/api';
import { colors, radius, spacing } from '@/theme/tokens';

export default function NewMessageScreen() {
  const [query, setQuery] = useState('');
  const [profiles, setProfiles] = useState<MessageProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      setLoading(true);
      setError('');
      void searchMessageProfiles(query)
        .then((results) => { if (active) setProfiles(results); })
        .catch((nextError: unknown) => {
          if (active) setError(nextError instanceof Error ? nextError.message : 'Could not find people.');
        })
        .finally(() => { if (active) setLoading(false); });
    }, query ? 280 : 0);
    return () => { active = false; clearTimeout(timer); };
  }, [query]);

  const startConversation = async (person: MessageProfile) => {
    if (busyUserId) return;
    const name = person.display_name || (person.handle ? `@${person.handle}` : 'Connection');
    setBusyUserId(person.user_id);
    setError('');
    try {
      const conversationId = await getOrCreateDirectConversation(person.user_id);
      router.replace({
        pathname: '/messages/[conversationId]',
        params: { conversationId, partnerId: person.user_id, partnerName: name },
      });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Messaging is unavailable for this person.');
      setBusyUserId(null);
    }
  };

  return (
    <Screen>
      <View style={styles.topRow}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backGlyph}>‹</Text><Text style={styles.backLabel}>Messages</Text>
        </Pressable>
      </View>
      <View style={styles.hero}>
        <Eyebrow>Reconnect</Eyebrow>
        <Heading compact>Start a conversation.</Heading>
        <Muted>People you follow appear first. Their privacy preference still decides whether a new message can begin.</Muted>
      </View>

      <View style={styles.searchWrap}>
        <Text style={styles.searchGlyph}>⌕</Text>
        <TextInput
          accessibilityLabel="Search people"
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setQuery}
          placeholder="Search name or @handle"
          placeholderTextColor={colors.textSubtle}
          style={styles.searchInput}
          value={query}
        />
        {query ? <Pressable accessibilityLabel="Clear search" onPress={() => setQuery('')}><Text style={styles.clear}>×</Text></Pressable> : null}
      </View>

      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {loading ? <ActivityIndicator color={colors.primary} style={styles.loading} /> : null}
      {!loading && profiles.length === 0 ? (
        <EmptyState description={query ? 'Try another name or handle.' : 'Follow people from Quick Chat, Feed, or Clubs to find them quickly here.'} glyph="⌕" title={query ? 'No people found' : 'Meet someone first'} />
      ) : null}

      <View style={styles.list}>
        {profiles.map((person) => {
          const name = person.display_name || (person.handle ? `@${person.handle}` : 'Community member');
          return (
            <Pressable
              key={person.user_id}
              accessibilityLabel={`Message ${name}`}
              accessibilityRole="button"
              disabled={Boolean(busyUserId)}
              onPress={() => void startConversation(person)}
              style={({ pressed }) => [styles.personRow, pressed && styles.pressed]}
            >
              <Avatar label={name} size={48} />
              <View style={styles.personCopy}>
                <View style={styles.nameRow}>
                  <Text numberOfLines={1} style={styles.name}>{name}</Text>
                  {person.is_following ? <Pill label="Following" tone="accent" /> : person.follows_me ? <Pill label="Follows you" tone="success" /> : null}
                </View>
                <Text style={styles.handle}>@{person.handle || 'member'} · {person.country_code || 'Worldwide'}</Text>
                <Text numberOfLines={1} style={styles.bio}>{person.bio || person.languages.join(' · ') || 'Open to new conversations'}</Text>
              </View>
              {busyUserId === person.user_id ? <ActivityIndicator color={colors.primary} size="small" /> : <Text style={styles.arrow}>›</Text>}
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row' },
  backButton: { alignItems: 'center', flexDirection: 'row', gap: 4, paddingVertical: spacing.sm },
  backGlyph: { color: colors.primary, fontSize: 28, lineHeight: 28 },
  backLabel: { color: colors.primary, fontSize: 14, fontWeight: '800' },
  hero: { gap: spacing.sm, marginTop: spacing.xl },
  searchWrap: { alignItems: 'center', backgroundColor: colors.surfaceSoft, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xl, paddingHorizontal: spacing.md },
  searchGlyph: { color: colors.textSubtle, fontSize: 20 },
  searchInput: { color: colors.text, flex: 1, fontSize: 14, minHeight: 52 },
  clear: { color: colors.textMuted, fontSize: 22, paddingHorizontal: spacing.xs },
  loading: { marginTop: spacing.xl },
  error: { color: colors.danger, fontSize: 13, marginTop: spacing.lg, textAlign: 'center' },
  list: { gap: spacing.sm, marginTop: spacing.xl },
  personRow: { alignItems: 'center', backgroundColor: colors.surfaceSoft, borderColor: colors.border, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: spacing.md, padding: spacing.md },
  personCopy: { flex: 1, gap: 3 },
  nameRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  name: { color: colors.text, flexShrink: 1, fontSize: 14, fontWeight: '900' },
  handle: { color: colors.textSubtle, fontSize: 10.5, fontWeight: '700' },
  bio: { color: colors.textMuted, fontSize: 11.5 },
  arrow: { color: colors.primary, fontSize: 25, fontWeight: '300' },
  pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
});
