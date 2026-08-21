import { supabase } from '@/lib/supabase';

function getCallbackParams(url: string) {
  const parsed = new URL(url);
  const query = parsed.searchParams;
  const fragment = new URLSearchParams(parsed.hash.startsWith('#') ? parsed.hash.slice(1) : parsed.hash);

  return {
    accessToken: query.get('access_token') ?? fragment.get('access_token'),
    code: query.get('code') ?? fragment.get('code'),
    errorDescription: query.get('error_description') ?? fragment.get('error_description'),
    refreshToken: query.get('refresh_token') ?? fragment.get('refresh_token'),
    type: query.get('type') ?? fragment.get('type'),
  };
}

export async function handleAuthCallbackUrl(url: string) {
  if (!supabase || !url.includes('/auth/callback')) return null;

  const { accessToken, code, errorDescription, refreshToken, type } = getCallbackParams(url);
  if (errorDescription) throw new Error(errorDescription);

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return type;
  }

  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) throw error;
  }

  return type;
}
