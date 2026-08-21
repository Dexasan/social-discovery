import { supabase } from '@/lib/supabase';
import type { Json } from '@/types/database';

export type ActivityEvent = {
  activity_id: string;
  actor_country_code: string | null;
  actor_display_name: string | null;
  actor_handle: string | null;
  actor_id: string;
  created_at: string;
  kind: 'follow' | 'post_like' | 'post_reply' | 'gift';
  metadata: Json;
  post_author_id: string | null;
  post_author_name: string | null;
  post_body: string | null;
  post_id: string | null;
  read_at: string | null;
  source_id: string;
};

function client() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

export async function loadActivity(beforeCreatedAt?: string) {
  const { data, error } = await client().rpc('list_activity_events', {
    activity_limit: 50,
    before_created_at: beforeCreatedAt,
  });
  if (error) throw error;
  return data as ActivityEvent[];
}

export async function loadActivityUnreadCount() {
  const { data, error } = await client().rpc('get_activity_unread_count');
  if (error) throw error;
  return Number(data ?? 0);
}

export async function markActivityRead(activityId?: string) {
  const { data, error } = await client().rpc('mark_activity_read', {
    target_activity_id: activityId,
  });
  if (error) throw error;
  return data;
}

export function subscribeToActivity(userId: string, onChange: () => void) {
  const activeClient = client();
  const channel = activeClient
    .channel(`activity:${userId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'activity_events', filter: `recipient_id=eq.${userId}` },
      onChange,
    )
    .subscribe();
  return () => { void activeClient.removeChannel(channel); };
}
