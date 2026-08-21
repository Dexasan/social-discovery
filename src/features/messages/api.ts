import { supabase } from '@/lib/supabase';

export type DirectConversation = {
  conversation_id: string;
  last_message_at: string;
  last_message_body: string | null;
  partner_country_code: string | null;
  partner_display_name: string | null;
  partner_handle: string | null;
  partner_id: string;
  unread_count: number;
};

export type MessageProfile = {
  bio: string | null;
  country_code: string | null;
  display_name: string | null;
  follows_me: boolean;
  handle: string | null;
  is_following: boolean;
  languages: string[];
  user_id: string;
};

function client() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

export async function listDirectConversations() {
  const { data, error } = await client().rpc('list_direct_conversations');
  if (error) throw error;
  return data as DirectConversation[];
}

export async function markConversationRead(conversationId: string) {
  const { error } = await client().rpc('mark_conversation_read', { target_conversation_id: conversationId });
  if (error) throw error;
}

export async function searchMessageProfiles(query: string) {
  const { data, error } = await client().rpc('search_message_profiles', {
    profile_query: query.trim() || undefined,
    profile_limit: 30,
  });
  if (error) throw error;
  return data as MessageProfile[];
}

export function subscribeToInbox(userId: string, onChange: () => void) {
  const activeClient = client();
  const channel = activeClient
    .channel(`inbox:${userId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, onChange)
    .subscribe();
  return () => { void activeClient.removeChannel(channel); };
}
