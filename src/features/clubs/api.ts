import { supabase } from '@/lib/supabase';
import type { Tables } from '@/types/database';

export type ClubSummary = {
  club_id: string;
  description: string;
  is_member: boolean;
  live_listener_count: number;
  live_room_id: string | null;
  live_room_title: string | null;
  member_count: number;
  name: string;
  slug: string;
  topic: string;
};

export type RoomParticipant = {
  display_name: string | null;
  hand_raised_at: string | null;
  handle: string | null;
  is_host: boolean;
  role: 'host' | 'speaker' | 'listener';
  user_id: string;
};

export type ClubRoom = Tables<'club_rooms'> & { clubs: Pick<Tables<'clubs'>, 'name' | 'topic'> | null };

function client() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

export async function loadClubs() {
  const { data, error } = await client().rpc('list_clubs');
  if (error) throw error;
  return data as ClubSummary[];
}

export async function joinClub(clubId: string) {
  const { error } = await client().rpc('join_club', { target_club_id: clubId });
  if (error) throw error;
}

export async function leaveClub(clubId: string) {
  const { error } = await client().rpc('leave_club', { target_club_id: clubId });
  if (error) throw error;
}

export async function startClubRoom(clubId: string, title: string) {
  const { data, error } = await client().rpc('start_club_room', { target_club_id: clubId, room_title: title });
  if (error) throw error;
  return data;
}

export async function loadClubRoom(roomId: string) {
  const { data, error } = await client()
    .from('club_rooms')
    .select('*, clubs(name, topic)')
    .eq('id', roomId)
    .single();
  if (error) throw error;
  return data as ClubRoom;
}

export async function joinClubRoom(roomId: string) {
  const { error } = await client().rpc('join_club_room', { target_room_id: roomId });
  if (error) throw error;
}

export async function leaveClubRoom(roomId: string) {
  const { error } = await client().rpc('leave_club_room', { target_room_id: roomId });
  if (error) throw error;
}

export async function setRoomHandRaised(roomId: string, raised: boolean) {
  const { error } = await client().rpc('set_room_hand_raised', { target_room_id: roomId, raised });
  if (error) throw error;
}

export async function moderateRoomParticipant(
  roomId: string,
  userId: string,
  action: 'invite_speaker' | 'move_listener' | 'remove',
) {
  const { error } = await client().rpc('moderate_room_participant', {
    target_room_id: roomId,
    target_user_id: userId,
    moderation_action: action,
  });
  if (error) throw error;
}

export async function endClubRoom(roomId: string) {
  const { error } = await client().rpc('end_club_room', { target_room_id: roomId });
  if (error) throw error;
}

export async function loadRoomParticipants(roomId: string) {
  const { data, error } = await client().rpc('list_room_participants', { target_room_id: roomId });
  if (error) throw error;
  return data as RoomParticipant[];
}

export function subscribeToRoomState(roomId: string, onChange: () => void) {
  const activeClient = client();
  const participants = activeClient
    .channel(`room:${roomId}:participants`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'room_participants', filter: `room_id=eq.${roomId}` }, onChange)
    .subscribe();
  const room = activeClient
    .channel(`room:${roomId}:state`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'club_rooms', filter: `id=eq.${roomId}` }, onChange)
    .subscribe();

  return () => {
    void activeClient.removeChannel(participants);
    void activeClient.removeChannel(room);
  };
}
