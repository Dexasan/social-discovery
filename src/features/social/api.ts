import { supabase } from '@/lib/supabase';

function client() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

export async function followProfile(followerId: string, followedId: string) {
  const { error } = await client().from('follows').insert({ follower_id: followerId, followed_id: followedId });
  if (error && error.code !== '23505') throw error;
}

export async function getOrCreateDirectConversation(otherUserId: string) {
  const { data, error } = await client().rpc('get_or_create_direct_conversation', { other_user_id: otherUserId });
  if (error) throw error;
  return data;
}
