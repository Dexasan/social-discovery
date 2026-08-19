import { supabase } from '@/lib/supabase';

export type FeedPost = {
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

export type FeedReply = {
  author_display_name: string | null;
  author_handle: string | null;
  author_id: string;
  body: string;
  created_at: string;
  reply_id: string;
};

function client() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

export async function loadFeed(beforeCreatedAt?: string) {
  const { data, error } = await client().rpc('get_feed', {
    feed_limit: 30,
    before_created_at: beforeCreatedAt,
  });
  if (error) throw error;
  return data as FeedPost[];
}

export async function createPost(authorId: string, body: string, topic?: string) {
  const { data, error } = await client()
    .from('posts')
    .insert({ author_id: authorId, body: body.trim(), topic: topic || null })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function setPostLiked(postId: string, userId: string, liked: boolean) {
  if (liked) {
    const { error } = await client().from('post_likes').insert({ post_id: postId, user_id: userId });
    if (error && error.code !== '23505') throw error;
    return;
  }

  const { error } = await client().from('post_likes').delete().eq('post_id', postId).eq('user_id', userId);
  if (error) throw error;
}

export async function loadPostReplies(postId: string) {
  const { data, error } = await client().rpc('get_post_replies', { target_post_id: postId });
  if (error) throw error;
  return data as FeedReply[];
}

export async function createReply(postId: string, authorId: string, body: string) {
  const { data, error } = await client()
    .from('replies')
    .insert({ post_id: postId, author_id: authorId, body: body.trim() })
    .select()
    .single();
  if (error) throw error;
  return data;
}
