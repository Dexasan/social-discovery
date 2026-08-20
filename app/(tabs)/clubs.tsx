import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Card, EmptyState, Eyebrow, Heading, Muted, Pill, PrimaryButton, Screen, SectionHeader } from '@/components/ui';
import { joinClub, leaveClub, loadClubs, startClubRoom, type ClubSummary } from '@/features/clubs/api';
import { colors, radius, spacing } from '@/theme/tokens';

export default function ClubsScreen() {
  const [clubs, setClubs] = useState<ClubSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyClubId, setBusyClubId] = useState<string | null>(null);
  const [hostingClubId, setHostingClubId] = useState<string | null>(null);
  const [roomTitle, setRoomTitle] = useState('');
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

  const liveClubs = clubs.filter((club) => club.live_room_id);

  return (
    <Screen>
      <View style={styles.pageHeader}>
        <View style={styles.headerCopy}>
          <Eyebrow>Clubs · live audio</Eyebrow>
          <Heading compact>Find your room.</Heading>
          <Muted>Drop into conversations happening around the world.</Muted>
        </View>
        <View style={styles.waveMark}><Text style={styles.waveGlyph}>≋</Text></View>
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
            <Text style={styles.roomTitle}>{club.live_room_title}</Text>
            <View style={styles.listenerStack}>
              <View style={[styles.listenerDot, styles.listenerOne]} /><View style={[styles.listenerDot, styles.listenerTwo]} /><View style={[styles.listenerDot, styles.listenerThree]} />
              <Text style={styles.listenerCopy}>People are talking now</Text>
            </View>
            <PrimaryButton
              label="Listen in"
              onPress={() => router.push({ pathname: '/clubs/room/[roomId]', params: { roomId: club.live_room_id! } })}
            />
          </Card>
        ))}
      </View>

      {!loading && clubs.length === 0 ? <EmptyState description="New communities will show up here." glyph="◎" title="No clubs yet" /> : null}
      {clubs.length > 0 ? <SectionHeader title="Explore communities" /> : null}
      <View style={styles.list}>
        {clubs.map((club) => (
          <Card key={club.club_id} style={styles.clubCard}>
            <View style={styles.cardTop}>
              <View style={styles.clubMark}><Text style={styles.clubMarkText}>{club.name.slice(0, 1)}</Text></View>
              <View style={styles.clubIdentity}>
                <Text style={styles.clubName}>{club.name}</Text>
                <Text style={styles.clubMeta}>{club.member_count} members · {club.topic}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                disabled={busyClubId === club.club_id}
                onPress={() => void toggleMembership(club)}
                style={[styles.joinButton, club.is_member && styles.joinedButton]}
              >
                <Text style={[styles.joinLabel, club.is_member && styles.joinedLabel]}>{club.is_member ? 'Joined' : 'Join'}</Text>
              </Pressable>
            </View>
            <Muted style={styles.description}>{club.description}</Muted>

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
  waveMark: { alignItems: 'center', backgroundColor: colors.accentSoft, borderColor: '#552534', borderRadius: 24, borderWidth: 1, height: 58, justifyContent: 'center', width: 58 },
  waveGlyph: { color: colors.accent, fontSize: 30, fontWeight: '900', transform: [{ rotate: '90deg' }] },
  loading: { marginVertical: spacing.xl },
  error: { color: colors.danger, fontSize: 13, marginTop: spacing.md, textAlign: 'center' },
  list: { gap: spacing.md },
  liveCard: { backgroundColor: colors.surfaceSoft, gap: spacing.lg, overflow: 'hidden', paddingLeft: spacing.xl },
  liveRail: { backgroundColor: colors.accent, bottom: 18, borderRadius: 3, left: 0, position: 'absolute', top: 18, width: 4 },
  clubCard: { gap: spacing.md },
  cardTop: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, justifyContent: 'space-between' },
  topic: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  roomTitle: { color: colors.text, fontSize: 23, fontWeight: '900', letterSpacing: -0.6, lineHeight: 29 },
  listenerStack: { alignItems: 'center', flexDirection: 'row', minHeight: 24 },
  listenerDot: { borderColor: colors.surfaceSoft, borderRadius: 12, borderWidth: 2, height: 24, width: 24 },
  listenerOne: { backgroundColor: '#39518C' },
  listenerTwo: { backgroundColor: '#74394A', marginLeft: -7 },
  listenerThree: { backgroundColor: '#386559', marginLeft: -7 },
  listenerCopy: { color: colors.textSubtle, fontSize: 11, fontWeight: '700', marginLeft: spacing.sm },
  clubMark: { alignItems: 'center', backgroundColor: colors.primarySoft, borderColor: '#304377', borderRadius: radius.md, borderWidth: 1, height: 46, justifyContent: 'center', width: 46 },
  clubMarkText: { color: colors.primary, fontSize: 18, fontWeight: '900' },
  clubIdentity: { flex: 1, gap: 3 },
  clubName: { color: colors.text, fontSize: 17, fontWeight: '900', letterSpacing: -0.3 },
  clubMeta: { color: colors.textSubtle, fontSize: 11.5, fontWeight: '600' },
  description: { paddingLeft: 58 },
  joinButton: { backgroundColor: colors.primary, borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: 9 },
  joinedButton: { backgroundColor: colors.primarySoft, borderColor: '#304377', borderWidth: 1 },
  joinLabel: { color: colors.primaryInk, fontSize: 12, fontWeight: '800' },
  joinedLabel: { color: colors.primary },
  hostButton: { alignItems: 'center', backgroundColor: colors.surfaceRaised, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, padding: spacing.md },
  hostLabel: { color: colors.primary, fontSize: 13, fontWeight: '800' },
  hostForm: { gap: spacing.md },
  input: { backgroundColor: colors.surfaceSoft, borderColor: colors.borderStrong, borderRadius: radius.md, borderWidth: 1, color: colors.text, fontSize: 14, minHeight: 50, paddingHorizontal: spacing.md },
  hostActions: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'flex-end' },
  cancelButton: { borderColor: colors.border, borderRadius: radius.sm, borderWidth: 1, paddingHorizontal: spacing.lg, paddingVertical: 10 },
  cancelLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  startButton: { backgroundColor: colors.primary, borderRadius: radius.sm, paddingHorizontal: spacing.lg, paddingVertical: 10 },
  startLabel: { color: colors.primaryInk, fontSize: 12, fontWeight: '800' },
});
