import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { EmptyState, Screen, SignalBars } from '@/components/ui';
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

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

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
  const hostingClub = clubs.find((club) => club.club_id === hostingClubId) ?? null;

  return (
    <Screen>
      <View style={styles.topBar}>
        <Text style={styles.navTitle}>Clubs</Text>
        <Pressable accessibilityLabel="Create a club" accessibilityRole="button" onPress={() => router.push('/clubs/create')} style={styles.createButton}>
          <Text style={styles.createGlyph}>＋</Text>
        </Pressable>
      </View>

      <View style={styles.searchWrap}>
        <Text style={styles.searchGlyph}>⌕</Text>
        <TextInput accessibilityLabel="Search clubs" autoCapitalize="none" onChangeText={setQuery} placeholder="Search communities" placeholderTextColor={colors.textSubtle} style={styles.searchInput} value={query} />
        {query ? <Pressable accessibilityLabel="Clear search" onPress={() => setQuery('')}><Text style={styles.clearSearch}>×</Text></Pressable> : null}
      </View>

      {loading ? <ActivityIndicator color={colors.primary} style={styles.loading} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {liveClubs.length > 0 ? (
        <>
          <View style={styles.sectionLine}><Text style={styles.sectionTitle}>Live now</Text><View style={styles.liveStatus}><View style={styles.liveDot} /><Text style={styles.liveCount}>{liveClubs.length}</Text></View></View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.liveScroller}>
            <View style={styles.liveRow}>
              {liveClubs.map((club) => (
                <Pressable
                  key={club.club_id}
                  accessibilityRole="button"
                  onPress={() => router.push({ pathname: '/clubs/room/[roomId]', params: { roomId: club.live_room_id! } })}
                  style={({ pressed }) => [styles.liveCard, pressed && styles.pressed]}
                >
                  <View style={styles.liveTop}><View style={styles.liveLabel}><View style={styles.liveDot} /><Text style={styles.liveLabelText}>LIVE</Text></View><SignalBars /></View>
                  <Text numberOfLines={2} style={styles.roomTitle}>{club.live_room_title}</Text>
                  <Text numberOfLines={1} style={styles.liveClubName}>{club.name}</Text>
                  <View style={styles.listenerRow}><Text style={styles.listenerIcon}>◉</Text><Text style={styles.listenerCopy}>{club.live_listener_count} listening</Text><Text style={styles.enterArrow}>→</Text></View>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </>
      ) : null}

      {!loading ? <View style={styles.sectionLine}><Text style={styles.sectionTitle}>{query ? 'Results' : 'Find your people'}</Text><Text style={styles.sectionCount}>{visibleClubs.length} clubs</Text></View> : null}
      {!loading && visibleClubs.length === 0 ? <EmptyState description="Try another word or create the community you wish existed." glyph="⌕" title="No clubs found" /> : null}

      <View style={styles.clubGrid}>
        {visibleClubs.map((club, index) => (
          <View key={club.club_id} style={[styles.clubTile, index % 3 === 1 && styles.clubTileCobalt, index % 3 === 2 && styles.clubTileWarm]}>
            <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/clubs/[clubId]', params: { clubId: club.club_id } })} style={styles.clubLink}>
              <View style={[styles.clubMark, index % 3 === 1 && styles.clubMarkCobalt, index % 3 === 2 && styles.clubMarkWarm]}><Text style={styles.clubMarkText}>{club.name.slice(0, 2).toUpperCase()}</Text></View>
              <Text numberOfLines={2} style={styles.clubName}>{club.name}</Text>
              <Text numberOfLines={1} style={styles.clubTopic}>{club.topic}</Text>
              <Text style={styles.memberCount}>{club.member_count} members</Text>
            </Pressable>
            <View style={styles.tileActions}>
              <Pressable disabled={busyClubId === club.club_id} onPress={() => void toggleMembership(club)} style={[styles.joinButton, club.is_member && styles.joinedButton]}>
                <Text style={[styles.joinLabel, club.is_member && styles.joinedLabel]}>{busyClubId === club.club_id ? '…' : club.is_member ? 'Joined' : 'Join'}</Text>
              </Pressable>
              {club.is_member && !club.live_room_id ? (
                <Pressable accessibilityLabel={`Start a room in ${club.name}`} onPress={() => { setHostingClubId(club.club_id); setRoomTitle(''); }} style={styles.micButton}><Text style={styles.micGlyph}>◉</Text></Pressable>
              ) : null}
            </View>
          </View>
        ))}
      </View>

      {hostingClub ? (
        <View style={styles.hostPanel}>
          <View style={styles.hostPanelTop}><View><Text style={styles.hostTitle}>Go live in {hostingClub.name}</Text><Text style={styles.hostHint}>Give people a reason to tap in.</Text></View><Pressable onPress={() => setHostingClubId(null)}><Text style={styles.hostClose}>×</Text></Pressable></View>
          <TextInput autoFocus maxLength={80} onChangeText={setRoomTitle} placeholder="What are you talking about?" placeholderTextColor={colors.textSubtle} style={styles.roomInput} value={roomTitle} />
          <Pressable disabled={!roomTitle.trim() || busyClubId === hostingClub.club_id} onPress={() => void startRoom(hostingClub)} style={[styles.startButton, (!roomTitle.trim() || busyClubId === hostingClub.club_id) && styles.disabled]}>
            <Text style={styles.startLabel}>{busyClubId === hostingClub.club_id ? 'Starting…' : 'Start live room'}</Text>
          </Pressable>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  navTitle: { color: colors.text, fontSize: 25, fontWeight: '900', letterSpacing: -0.8 },
  createButton: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: 18, height: 48, justifyContent: 'center', width: 48 },
  createGlyph: { color: colors.white, fontSize: 25, fontWeight: '700' },
  searchWrap: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 18, borderWidth: 1, flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg, paddingHorizontal: spacing.lg },
  searchGlyph: { color: colors.textSubtle, fontSize: 19 },
  searchInput: { color: colors.text, flex: 1, fontSize: 16, minHeight: 54 },
  clearSearch: { color: colors.textMuted, fontSize: 23, paddingHorizontal: spacing.xs },
  loading: { marginVertical: spacing.xl },
  error: { color: colors.danger, fontSize: 14, lineHeight: 21, marginTop: spacing.md, textAlign: 'center' },
  sectionLine: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.md, marginTop: spacing.xl },
  sectionTitle: { color: colors.text, fontSize: 20, fontWeight: '900', letterSpacing: -0.45 },
  sectionCount: { color: colors.textSubtle, fontSize: 13, fontWeight: '700' },
  liveStatus: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  liveDot: { backgroundColor: colors.accent, borderRadius: 4, height: 8, width: 8 },
  liveCount: { color: colors.accent, fontSize: 13, fontWeight: '900' },
  liveScroller: { marginHorizontal: -18 },
  liveRow: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: 18 },
  liveCard: { backgroundColor: colors.primary, borderRadius: 24, gap: spacing.sm, minHeight: 196, padding: 18, width: 274 },
  liveTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  liveLabel: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  liveLabelText: { color: colors.accent, fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  roomTitle: { color: colors.white, fontSize: 23, fontWeight: '900', letterSpacing: -0.7, lineHeight: 27, marginTop: spacing.sm },
  liveClubName: { color: colors.signal, fontSize: 13, fontWeight: '800' },
  listenerRow: { alignItems: 'center', flexDirection: 'row', marginTop: 'auto' },
  listenerIcon: { color: colors.cobaltSoft, fontSize: 15 },
  listenerCopy: { color: '#C9C7C0', fontSize: 13, fontWeight: '700', marginLeft: 7 },
  enterArrow: { color: colors.white, fontSize: 22, marginLeft: 'auto' },
  pressed: { opacity: 0.75, transform: [{ scale: 0.985 }] },
  clubGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  clubTile: { backgroundColor: colors.signalSoft, borderColor: '#CDE987', borderRadius: 22, borderWidth: 1, minHeight: 220, padding: spacing.lg, width: '47.8%' },
  clubTileCobalt: { backgroundColor: colors.cobaltSoft, borderColor: '#BFC9FF' },
  clubTileWarm: { backgroundColor: '#FFF0CF', borderColor: '#F2D89D' },
  clubLink: { flex: 1 },
  clubMark: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: 15, height: 48, justifyContent: 'center', marginBottom: spacing.md, width: 48 },
  clubMarkCobalt: { backgroundColor: colors.cobalt },
  clubMarkWarm: { backgroundColor: colors.accent },
  clubMarkText: { color: colors.white, fontSize: 17, fontWeight: '900' },
  clubName: { color: colors.text, fontSize: 17, fontWeight: '900', letterSpacing: -0.35, lineHeight: 21 },
  clubTopic: { color: colors.textMuted, fontSize: 13, fontWeight: '700', marginTop: 4 },
  memberCount: { color: colors.textSubtle, fontSize: 12, marginTop: 7 },
  tileActions: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  joinButton: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: radius.pill, flex: 1, minHeight: 38, justifyContent: 'center', paddingHorizontal: spacing.sm },
  joinedButton: { backgroundColor: 'rgba(255,255,255,0.65)', borderColor: colors.borderStrong, borderWidth: 1 },
  joinLabel: { color: colors.white, fontSize: 13, fontWeight: '900' },
  joinedLabel: { color: colors.text },
  micButton: { alignItems: 'center', backgroundColor: colors.cobalt, borderRadius: 19, height: 38, justifyContent: 'center', width: 38 },
  micGlyph: { color: colors.white, fontSize: 13 },
  hostPanel: { backgroundColor: colors.surface, borderColor: colors.borderStrong, borderRadius: 22, borderWidth: 1, gap: spacing.md, marginTop: spacing.lg, padding: spacing.lg },
  hostPanelTop: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between' },
  hostTitle: { color: colors.text, fontSize: 18, fontWeight: '900' },
  hostHint: { color: colors.textMuted, fontSize: 13, marginTop: 3 },
  hostClose: { color: colors.textMuted, fontSize: 25, lineHeight: 25 },
  roomInput: { backgroundColor: colors.surfaceSoft, borderColor: colors.borderStrong, borderRadius: 16, borderWidth: 1, color: colors.text, fontSize: 16, minHeight: 54, paddingHorizontal: spacing.lg },
  startButton: { alignItems: 'center', backgroundColor: colors.cobalt, borderRadius: 16, minHeight: 52, justifyContent: 'center' },
  startLabel: { color: colors.white, fontSize: 15, fontWeight: '900' },
  disabled: { opacity: 0.45 },
});
