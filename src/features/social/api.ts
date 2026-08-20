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

export type SocialStats = {
  followers: number;
  following: number;
  posts: number;
};

export type UpdateProfileInput = {
  bio: string;
  countryCode: string | null;
  displayName: string;
  handle: string;
  languages: string[];
};

export async function updateOwnProfile(userId: string, input: UpdateProfileInput) {
  const { error } = await client()
    .from('profiles')
    .update({
      bio: input.bio,
      country_code: input.countryCode,
      display_name: input.displayName,
      handle: input.handle,
      languages: input.languages,
    })
    .eq('id', userId);

  if (error) throw error;
}

export async function loadOwnSocialStats(userId: string): Promise<SocialStats> {
  const db = client();
  const [followingResult, followersResult, postsResult] = await Promise.all([
    db.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId),
    db.from('follows').select('*', { count: 'exact', head: true }).eq('followed_id', userId),
    db.from('posts').select('*', { count: 'exact', head: true }).eq('author_id', userId).is('deleted_at', null),
  ]);

  if (followingResult.error) throw followingResult.error;
  if (followersResult.error) throw followersResult.error;
  if (postsResult.error) throw postsResult.error;

  return {
    followers: followersResult.count ?? 0,
    following: followingResult.count ?? 0,
    posts: postsResult.count ?? 0,
  };
}
