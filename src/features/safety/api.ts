import { supabase } from '@/lib/supabase';
import { loadAvatarPathMap } from '@/features/profile/avatar-data';

export type MessagePermission = 'everyone' | 'followers' | 'following';

export type BlockedProfile = {
  avatar_path: string | null;
  blocked_at: string;
  country_code: string | null;
  display_name: string | null;
  handle: string | null;
  user_id: string;
};

function client() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

export async function loadSafetySettings() {
  const [settingsResult, blocksResult] = await Promise.all([
    client().rpc('get_privacy_settings'),
    client().rpc('list_blocked_profiles'),
  ]);
  if (settingsResult.error) throw settingsResult.error;
  if (blocksResult.error) throw blocksResult.error;

  const rows = blocksResult.data as Omit<BlockedProfile, 'avatar_path'>[];
  const avatars = await loadAvatarPathMap(rows.map((profile) => profile.user_id));
  return {
    messagePermission: (settingsResult.data[0]?.message_permission ?? 'everyone') as MessagePermission,
    blockedProfiles: rows.map((profile) => ({ ...profile, avatar_path: avatars.get(profile.user_id) ?? null })),
  };
}

export async function updateMessagePermission(permission: MessagePermission) {
  const { data, error } = await client().rpc('set_message_permission', { new_permission: permission });
  if (error) throw error;
  return data as MessagePermission;
}

export async function unblockProfile(profileId: string) {
  const { data, error } = await client().rpc('unblock_profile', { target_user_id: profileId });
  if (error) throw error;
  return data;
}
