import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Card, EmptyState, Eyebrow, Heading, Muted, Pill, Screen, SectionHeader, SignalBars } from '@/components/ui';
import { joinClub, leaveClub, loadClubs, startClubRoom, type ClubSummary } from '@/features/clubs/api';
import { colors, radius, spacing } from '@/theme/tokens';

export default function ClubsScreen() {
  const [clubs, setClubs] = useState<ClubSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyClubId, setBusyClubId] = useState<string | null>(null);
  const [hostingClubId, setHostingClubId] = useState<string | null>(null);
  const [roomTitle, setRoomTitle] = useState('');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setError('');
    try {
      setClubs(await loadClubs());
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not load clubs.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void refresh();
  }, [refresh]));

  const toggleMembership = async (club: ClubSummary) => {
    setBusyClubId(club.club_id);
    setError('');
    try {
      if (club.is_member) await leaveClub(club.club_id);
      else await joinClub(club.club_id);
      await refresh();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not update this membership.');
    } finally {
      setBusyClubId(null);
    }
  };

  const startRoom = async (club: ClubSummary) => {
    if (!roomTitle.trim()) return;
    setBusyClubId(club.club_id);
    setError('');
    try {
      const roomId = await startClubRoom(club.club_id, roomTitle);
      setHostingClubId(null);
      setRoomTitle('');
      router.push({ pathname: '/clubs/room/[roomId]', params: { roomId } });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not start this room.');
    } finally {
      setBusyClubId(null);
    }
  };

  const normalizedQuery = query.trim().toLowerCase();
  const visibleClubs = normalizedQuery
    ? clubs.filter((club) => [club.name, club.description, club.topic].some((value) => value.toLowerCase().includes(normalizedQuery)))
    : clubs;
  const liveClubs = visibleClubs.filter((club) => club.live_room_id);

  return (
    <Screen>
      <View style={styles.pageHeader}>
        <View style={styles.headerCopy}>
          <Eyebrow>YAPPIE CLUBS · LIVE AUDIO</Eyebrow>
          <Heading compact>Hear the room before you enter.</Heading>
          <Muted>Live voices, odd little communities, and absolutely no camera pressure.</Muted>
        </View>
        <Pressable accessibilityLabel="Create a club" accessibilityRole="button" onPress={() => router.push('/clubs/create')} style={styles.createButton}>
          <Text style={styles.createGlyph}>＋</Text>
        </Pressable>
      </View>
      <View style={styles.searchWrap}>
        <Text style={styles.searchGlyph}>⌕</Text>
        <TextInput
          accessibilityLabel="Search clubs"
          autoCapitalize="none"
          onChangeText={setQuery}
          placeholder="Search communities or topics"
          placeholderTextColor={colors.textSubtle}
          style={styles.searchInput}
          value={query}
        />
        {query ? <Pressable accessibilityLabel="Clear search" onPress={() => setQuery('')}><Text style={styles.clearSearch}>×</Text></Pressable> : null}
      </View>
      {loading ? <ActivityIndicator color={colors.primary} style={styles.loading} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {liveClubs.length > 0 ? <SectionHeader action={<Pill label={`${liveClubs.length} rooms`} tone="live" />} title="Live now" /> : null}
      <View style={styles.list}>
        {liveClubs.map((club) => (
          <Card key={`live-${club.club_id}`} style={styles.liveCard}>
            <View style={styles.liveRail} />
            <View style={styles.cardTop}>
              <Pill label={`Live · ${club.live_listener_count}`} tone="live" />
              <Text style={styles.topic}>{club.name}</Text>
            </View>
            <View style={styles.liveSignal}><SignalBars /><Text style={styles.liveSignalLabel}>ON AIR</Text></View>
            <Text style={styles.roomTitle}>{club.live_room_title}</Text>
            <View style={styles.listenerStack}>
              <View style={[styles.listenerDot, styles.listenerOne]} /><View style={[styles.listenerDot, styles.listenerTwo]} /><View style={[styles.listenerDot, styles.listenerThree]} />
              <Text style={styles.listenerCopy}>People are talking now</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/clubs/room/[roomId]', params: { roomId: club.live_room_id! } })}
              style={({ pressed }) => [styles.listenButton, pressed && styles.pressed]}
            >
              <Text style={styles.listenLabel}>Listen in</Text><Text style={styles.listenArrow}>↗</Text>
            </Pressable>
          </Card>
        ))}
      </View>

      {!loading && clubs.length === 0 ? <EmptyState description="Create the first community and give people a place to return to." glyph="◎" title="No clubs yet" /> : null}
      {!loading && clubs.length > 0 && visibleClubs.length === 0 ? <EmptyState description="Try another name or topic." glyph="⌕" title="No matching clubs" /> : null}
      {visibleClubs.length > 0 ? <SectionHeader title={normalizedQuery ? 'Search results' : 'Explore communities'} /> : null}
      <View style={styles.list}>
        {visibleClubs.map((club, index) => (
          <Card key={club.club_id} style={[styles.clubCard, index % 3 === 0 && styles.clubCardSignal, index % 3 === 1 && styles.clubCardCobalt]}>
            <View style={styles.cardTop}>
              <Pressable
                accessibilityLabel={`Open ${club.name}`}
                accessibilityRole="button"
                onPress={() => router.push({ pathname: '/clubs/[clubId]', params: { clubId: club.club_id } })}
                style={styles.clubLink}
              >
                <View style={[styles.clubMark, index % 2 === 1 && styles.clubMarkAlternate]}><Text style={styles.clubMarkText}>{club.name.slice(0, 1)}</Text></View>
                <View style={styles.clubIdentity}>
                  <Text style={styles.clubName}>{club.name}</Text>
                  <Text style={styles.clubMeta}>{club.member_count} members · {club.topic}</Text>
                </View>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={busyClubId === club.club_id}
                onPress={() => void toggleMembership(club)}
                style={[styles.joinButton, club.is_member && styles.joinedButton]}
              >
                <Text style={[styles.joinLabel, club.is_member && styles.joinedLabel]}>{club.is_member ? 'Joined' : 'Join'}</Text>
              </Pressable>
            </View>
            <Pressable onPress={() => router.push({ pathname: '/clubs/[clubId]', params: { clubId: club.club_id } })}>
              <Muted style={styles.description}>{club.description}</Muted>
            </Pressable>

            {club.is_member && !club.live_room_id ? (
              hostingClubId === club.club_id ? (
                <View style={styles.hostForm}>
                  <TextInput
                    accessibilityLabel="Room title"
                    maxLength={120}
                    onChangeText={setRoomTitle}
                    placeholder="What should people talk about?"
                    placeholderTextColor={colors.textMuted}
                    style={styles.input}
                    value={roomTitle}
                  />
                  <View style={styles.hostActions}>
                    <Pressable onPress={() => { setHostingClubId(null); setRoomTitle(''); }} style={styles.cancelButton}>
                      <Text style={styles.cancelLabel}>Cancel</Text>
                    </Pressable>
                    <Pressable disabled={!roomTitle.trim()} onPress={() => void startRoom(club)} style={styles.startButton}>
                      <Text style={styles.startLabel}>Go live</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <Pressable onPress={() => setHostingClubId(club.club_id)} style={styles.hostButton}>
                  <Text style={styles.hostLabel}>＋ Start a room</Text>
                </Pressable>
              )
            ) : null}
          </Card>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pageHeader: { alignItems: 'center', flexDirection: 'row', gap: spacing.lg },
  headerCopy: { flex: 1, gap: spacing.sm },
  createButton: { alignItems: 'center', backgroundColor: colors.signal, borderRadius: 20, height: 58, justifyContent: 'center', transform: [{ rotate: '4deg' }], width: 58 },
  createGlyph: { color: colors.primaryInk, fontSize: 26, fontWeight: '700' },
  searchWrap: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.borderStrong, borderRadius: 20, borderWidth: 1, flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xl, paddingHorizontal: spacing.lg },
  searchGlyph: { color: colors.textSubtle, fontSize: 20 },
  searchInput: { color: colors.text, flex: 1, fontSize: 16, minHeight: 58 },
  clearSearch: { color: colors.textMuted, fontSize: 22, paddingHorizontal: spacing.xs },
  loading: { marginVertical: spacing.xl },
  error: { color: colors.danger, fontSize: 14, lineHeight: 21, marginTop: spacing.md, textAlign: 'center' },
  list: { gap: spacing.lg },
  liveCard: { backgroundColor: colors.primary, borderColor: colors.primary, borderRadius: 32, gap: spacing.lg, overflow: 'hidden', paddingLeft: spacing.xl },
  liveRail: { backgroundColor: colors.signal, bottom: 22, borderRadius: 3, left: 0, position: 'absolute', top: 22, width: 7 },
  liveSignal: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  liveSignalLabel: { color: colors.signal, fontSize: 14, fontWeight: '900', letterSpacing: 2 },
  clubCard: { gap: spacing.md, overflow: 'hidden' },
  clubCardSignal: { backgroundColor: colors.signalSoft, borderColor: '#CDE987', transform: [{ rotate: '-0.35deg' }] },
  clubCardCobalt: { backgroundColor: colors.cobaltSoft, borderColor: '#BFC9FF', transform: [{ rotate: '0.35deg' }] },
  cardTop: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, justifyContent: 'space-between' },
  clubLink: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: spacing.md },
  topic: { color: '#C9C7C0', fontSize: 14, fontWeight: '800' },
  roomTitle: { color: colors.white, fontSize: 28, fontWeight: '900', letterSpacing: -1, lineHeight: 33 },
  listenerStack: { alignItems: 'center', flexDirection: 'row', minHeight: 24 },
  listenerDot: { borderColor: colors.surfaceSoft, borderRadius: 12, borderWidth: 2, height: 24, width: 24 },
  listenerOne: { backgroundColor: colors.cobalt },
  listenerTwo: { backgroundColor: '#FF8B79', marginLeft: -7 },
  listenerThree: { backgroundColor: '#65BFA6', marginLeft: -7 },
  listenerCopy: { color: '#C9C7C0', fontSize: 13, fontWeight: '700', marginLeft: spacing.sm },
  listenButton: { alignItems: 'center', backgroundColor: colors.signal, borderRadius: 20, flexDirection: 'row', justifyContent: 'space-between', minHeight: 62, paddingHorizontal: 21 },
  listenLabel: { color: colors.primary, fontSize: 17, fontWeight: '900' },
  listenArrow: { color: colors.primary, fontSize: 26, fontWeight: '900' },
  pressed: { opacity: 0.75, transform: [{ scale: 0.985 }] },
  clubMark: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: 17, height: 54, justifyContent: 'center', transform: [{ rotate: '-4deg' }], width: 54 },
  clubMarkAlternate: { backgroundColor: colors.cobalt, transform: [{ rotate: '4deg' }] },
  clubMarkText: { color: colors.white, fontSize: 21, fontWeight: '900' },
  clubIdentity: { flex: 1, gap: 3 },
  clubName: { color: colors.text, fontSize: 19, fontWeight: '900', letterSpacing: -0.45 },
  clubMeta: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  description: { paddingLeft: 58 },
  joinButton: { backgroundColor: colors.primary, borderRadius: radius.pill, minHeight: 42, paddingHorizontal: spacing.lg, paddingVertical: 10 },
  joinedButton: { backgroundColor: 'rgba(255,255,255,0.6)', borderColor: colors.borderStrong, borderWidth: 1 },
  joinLabel: { color: colors.primaryInk, fontSize: 14, fontWeight: '800' },
  joinedLabel: { color: colors.primary },
  hostButton: { alignItems: 'center', backgroundColor: colors.surfaceRaised, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, padding: spacing.md },
  hostLabel: { color: colors.primary, fontSize: 15, fontWeight: '800' },
  hostForm: { gap: spacing.md },
  input: { backgroundColor: colors.surfaceSoft, borderColor: colors.borderStrong, borderRadius: radius.md, borderWidth: 1, color: colors.text, fontSize: 16, minHeight: 56, paddingHorizontal: spacing.md },
  hostActions: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'flex-end' },
  cancelButton: { borderColor: colors.border, borderRadius: radius.sm, borderWidth: 1, paddingHorizontal: spacing.lg, paddingVertical: 10 },
  cancelLabel: { color: colors.textMuted, fontSize: 14, fontWeight: '700' },
  startButton: { backgroundColor: colors.primary, borderRadius: radius.sm, paddingHorizontal: spacing.lg, paddingVertical: 10 },
  startLabel: { color: colors.primaryInk, fontSize: 14, fontWeight: '800' },
});
