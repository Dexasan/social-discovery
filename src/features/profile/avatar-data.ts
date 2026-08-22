import { supabase } from '@/lib/supabase';

export async function loadAvatarPathMap(userIds: Array<string | null | undefined>) {
  const uniqueIds = [...new Set(userIds.filter((id): id is string => Boolean(id)))];
  if (!supabase || uniqueIds.length === 0) return new Map<string, string | null>();
  const { data, error } = await supabase.from('profiles').select('id, avatar_path').in('id', uniqueIds);
  if (error) throw error;
  return new Map(data.map((profile) => [profile.id, profile.avatar_path]));
}
