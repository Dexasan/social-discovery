import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Card, Eyebrow, Heading, Muted, Pill, PrimaryButton, Screen } from '@/components/ui';
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
      <Eyebrow>Live communities</Eyebrow>
      <Heading compact>Drop in. Listen. Join the stage.</Heading>
      {loading ? <ActivityIndicator color={colors.primary} style={styles.loading} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {liveClubs.length > 0 ? <Text style={styles.section}>Live now</Text> : null}
      <View style={styles.list}>
        {liveClubs.map((club) => (
          <Card key={`live-${club.club_id}`} style={styles.liveCard}>
            <View style={styles.cardTop}>
              <Pill label={`Live · ${club.live_listener_count}`} tone="live" />
              <Text style={styles.topic}>{club.name}</Text>
            </View>
            <Text style={styles.roomTitle}>{club.live_room_title}</Text>
            <PrimaryButton
              label="Join as listener"
              onPress={() => router.push({ pathname: '/clubs/room/[roomId]', params: { roomId: club.live_room_id! } })}
            />
          </Card>
        ))}
      </View>

      <Text style={styles.section}>Explore clubs</Text>
      <View style={styles.list}>
        {clubs.map((club) => (
          <Card key={club.club_id} style={styles.clubCard}>
            <View style={styles.cardTop}>
              <View style={styles.clubIdentity}>
                <Text style={styles.clubName}>{club.name}</Text>
                <Muted>{club.member_count} members · {club.topic}</Muted>
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
            <Muted>{club.description}</Muted>

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
  loading: { marginVertical: spacing.xl },
  error: { color: colors.danger, fontSize: 13, marginTop: spacing.md, textAlign: 'center' },
  section: { color: colors.text, fontSize: 17, fontWeight: '800', marginBottom: spacing.md, marginTop: spacing.xl },
  list: { gap: spacing.md },
  liveCard: { gap: spacing.lg },
  clubCard: { gap: spacing.md },
  cardTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  topic: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  roomTitle: { color: colors.text, fontSize: 23, fontWeight: '800', lineHeight: 29 },
  clubIdentity: { flex: 1, gap: 3 },
  clubName: { color: colors.text, fontSize: 18, fontWeight: '800' },
  joinButton: { backgroundColor: colors.primary, borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: 9 },
  joinedButton: { backgroundColor: colors.surfaceRaised, borderColor: colors.border, borderWidth: 1 },
  joinLabel: { color: colors.primaryInk, fontSize: 12, fontWeight: '800' },
  joinedLabel: { color: colors.textMuted },
  hostButton: { alignItems: 'center', borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, padding: spacing.md },
  hostLabel: { color: colors.primary, fontSize: 13, fontWeight: '800' },
  hostForm: { gap: spacing.md },
  input: { backgroundColor: colors.background, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, color: colors.text, fontSize: 14, minHeight: 50, paddingHorizontal: spacing.md },
  hostActions: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'flex-end' },
  cancelButton: { borderColor: colors.border, borderRadius: radius.sm, borderWidth: 1, paddingHorizontal: spacing.lg, paddingVertical: 10 },
  cancelLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  startButton: { backgroundColor: colors.primary, borderRadius: radius.sm, paddingHorizontal: spacing.lg, paddingVertical: 10 },
  startLabel: { color: colors.primaryInk, fontSize: 12, fontWeight: '800' },
});
