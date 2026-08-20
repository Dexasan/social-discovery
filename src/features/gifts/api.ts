import { supabase } from '@/lib/supabase';

export type CoinWallet = {
  balance: number;
  lifetime_earned: number;
  lifetime_spent: number;
};

export type GiftCatalogItem = {
  coin_cost: number;
  emoji: string;
  name: string;
  slug: string;
};

export type ProfileGift = {
  coin_cost: number;
  created_at: string;
  gift_emoji: string;
  gift_id: string;
  gift_name: string;
  gift_slug: string;
  sender_display_name: string | null;
  sender_handle: string | null;
  sender_id: string;
};

export type SendGiftResult = {
  balance: number;
  coin_cost: number;
  gift_id: string;
};

export type GiftContextKind = 'club_room' | 'direct_message' | 'profile' | 'quick_chat';

function client() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

export async function loadCoinWallet() {
  const { data, error } = await client().rpc('get_coin_wallet');
  if (error) throw error;
  const wallet = data[0];
  if (!wallet) throw new Error('Your coin wallet is unavailable.');
  return wallet as CoinWallet;
}

export async function loadGiftCatalog() {
  const { data, error } = await client().rpc('list_gift_catalog');
  if (error) throw error;
  return data as GiftCatalogItem[];
}

export async function loadProfileGifts(profileId: string) {
  const { data, error } = await client().rpc('list_profile_gifts', {
    target_user_id: profileId,
    gift_limit: 12,
  });
  if (error) throw error;
  return data as ProfileGift[];
}

export async function sendVirtualGift({
  contextId,
  contextKind,
  giftSlug,
  recipientId,
}: {
  contextId?: string;
  contextKind: GiftContextKind;
  giftSlug: string;
  recipientId: string;
}) {
  const { data, error } = await client().rpc('send_virtual_gift', {
    target_user_id: recipientId,
    target_gift_slug: giftSlug,
    gift_context_kind: contextKind,
    ...(contextId ? { gift_context_id: contextId } : {}),
  });
  if (error) throw error;
  const result = data[0];
  if (!result) throw new Error('The gift could not be sent.');
  return result as SendGiftResult;
}

export function sendProfileGift(profileId: string, giftSlug: string) {
  return sendVirtualGift({ contextKind: 'profile', giftSlug, recipientId: profileId });
}
