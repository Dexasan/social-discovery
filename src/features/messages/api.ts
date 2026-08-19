import { supabase } from '@/lib/supabase';

export type DirectConversation = {
  conversation_id: string;
  last_message_at: string;
  last_message_body: string | null;
  partner_country_code: string | null;
  partner_display_name: string | null;
  partner_handle: string | null;
  partner_id: string;
};

export async function listDirectConversations() {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.rpc('list_direct_conversations');
  if (error) throw error;
  return data as DirectConversation[];
}
