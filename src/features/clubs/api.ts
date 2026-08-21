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
  member_role: 'owner' | 'moderator' | 'member' | null;
  name: string;
  slug: string;
  topic: string;
};

export type ClubDetail = ClubSummary & {
  allow_member_rooms: boolean;
  created_at: string;
  owner_display_name: string | null;
  owner_handle: string | null;
  owner_id: string | null;
};

export type ClubMember = {
  country_code: string | null;
  display_name: string | null;
  handle: string | null;
  joined_at: string;
  role: 'owner' | 'moderator' | 'member';
  user_id: string;
};

export type ClubPost = {
  author_country_code: string | null;
  author_display_name: string | null;
  author_handle: string | null;
  author_id: string;
  body: string;
  created_at: string;
  like_count: number;
  liked_by_me: boolean;
  post_id: string;
  reply_count: number;
  topic: string | null;
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
  return (data as Omit<ClubSummary, 'member_role'>[]).map((club) => ({
    ...club,
    member_role: club.is_member ? 'member' as const : null,
  }));
}

export async function createClub(input: {
  allowMemberRooms: boolean;
  description: string;
  name: string;
  topic: string;
}) {
  const { data, error } = await client().rpc('create_club', {
    club_name: input.name,
    club_description: input.description,
    club_topic: input.topic,
    member_rooms: input.allowMemberRooms,
  });
  if (error) throw error;
  return data;
}

export async function loadClubDetail(clubId: string) {
  const { data, error } = await client().rpc('get_club_detail', { target_club_id: clubId });
  if (error) throw error;
  const detail = (data as ClubDetail[])[0];
  if (!detail) throw new Error('This club is unavailable.');
  return detail;
}

export async function loadClubMembers(clubId: string) {
  const { data, error } = await client().rpc('list_club_members', {
    target_club_id: clubId,
    member_limit: 40,
  });
  if (error) throw error;
  return data as ClubMember[];
}

export async function loadClubPosts(clubId: string, beforeCreatedAt?: string) {
  const { data, error } = await client().rpc('get_club_posts', {
    target_club_id: clubId,
    post_limit: 30,
    before_created_at: beforeCreatedAt,
  });
  if (error) throw error;
  return data as ClubPost[];
}

export async function createClubPost(clubId: string, body: string) {
  const { data, error } = await client().rpc('create_club_post', {
    target_club_id: clubId,
    post_body: body.trim(),
  });
  if (error) throw error;
  return data;
}

export async function manageClubMember(
  clubId: string,
  userId: string,
  action: 'promote' | 'demote' | 'remove' | 'ban',
) {
  const { error } = await client().rpc('manage_club_member', {
    target_club_id: clubId,
    target_user_id: userId,
    management_action: action,
  });
  if (error) throw error;
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

export async function loadOwnClubRole(clubId: string, userId: string) {
  const { data, error } = await client()
    .from('club_memberships')
    .select('role')
    .eq('club_id', clubId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();
  if (error) throw error;
  return (data?.role as 'owner' | 'moderator' | 'member' | undefined) ?? null;
}

export async function joinClubRoom(roomId: string) {
  const { error } = await client().rpc('join_club_room', { target_room_id: roomId });
  if (error) throw error;
}

export async function leaveClubRoom(roomId: string) {
  const { error } = await client().rpc('leave_club_room', { target_room_id: roomId });
  if (error) throw error;
}

export async function heartbeatClubRoom(roomId: string) {
  const { error } = await client().rpc('heartbeat_club_room', { target_room_id: roomId });
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
