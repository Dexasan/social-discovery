import { createClient } from 'npm:@supabase/supabase-js@2.112.3';

type SessionDescription = { sdp: string; type: 'offer' | 'answer' };

type RequestBody = {
  action?: 'create_session' | 'publish' | 'pull' | 'renegotiate' | 'close_session' | 'revoke_publisher' | 'close_room';
  media_session_id?: string;
  room_id?: string;
  session_description?: SessionDescription;
  session_kind?: 'publisher' | 'subscriber';
  target_user_id?: string;
};

const headers = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
};

function response(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { headers, status });
}

function isSessionDescription(value: unknown): value is SessionDescription {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<SessionDescription>;
  return typeof candidate.sdp === 'string' && (candidate.type === 'offer' || candidate.type === 'answer');
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  if (request.method !== 'POST') return response({ error: 'Method not allowed.' }, 405);

  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization) return response({ error: 'Authentication required.' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const publishableKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const realtimeAppId = Deno.env.get('CLOUDFLARE_REALTIME_APP_ID');
    const realtimeAppSecret = Deno.env.get('CLOUDFLARE_REALTIME_APP_SECRET');
    if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
      return response({ error: 'Supabase runtime configuration is missing.' }, 500);
    }
    if (!realtimeAppId || !realtimeAppSecret) {
      return response({ error: 'Live audio is not configured yet.' }, 503);
    }

    const userClient = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return response({ error: 'Invalid or expired session.' }, 401);

    const body = await request.json().catch(() => null) as RequestBody | null;
    if (!body?.action) return response({ error: 'action is required.' }, 400);

    const cloudflareBase = `https://rtc.live.cloudflare.com/v1/apps/${realtimeAppId}`;
    const cloudflareRequest = async (path: string, method: 'POST' | 'PUT', payload?: Record<string, unknown>) => {
      const providerResponse = await fetch(`${cloudflareBase}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${realtimeAppSecret}`,
          'Content-Type': 'application/json',
        },
        ...(payload ? { body: JSON.stringify(payload) } : {}),
      });
      const text = await providerResponse.text();
      let data: Record<string, unknown> = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { errorDescription: text || 'Cloudflare returned an unreadable response.' };
      }
      if (!providerResponse.ok) {
        const description = typeof data.errorDescription === 'string' ? data.errorDescription : 'Cloudflare request failed.';
        throw new Error(description);
      }
      return data;
    };

    const loadJoinedParticipant = async (roomId: string) => {
      const [{ data: room }, { data: participant }] = await Promise.all([
        admin.from('club_rooms').select('id, status').eq('id', roomId).maybeSingle(),
        admin
          .from('room_participants')
          .select('role, state, left_at')
          .eq('room_id', roomId)
          .eq('user_id', userData.user.id)
          .maybeSingle(),
      ]);
      if (!room || room.status !== 'live') throw new Error('This room is not live.');
      if (!participant || participant.state !== 'active' || participant.left_at) {
        throw new Error('Join the Club room before connecting audio.');
      }
      return participant;
    };

    const loadOwnedSession = async (mediaSessionId: string) => {
      const { data } = await admin
        .from('room_audio_sessions')
        .select('*')
        .eq('id', mediaSessionId)
        .eq('user_id', userData.user.id)
        .eq('status', 'active')
        .maybeSingle();
      if (!data) throw new Error('The audio session is not active.');
      await loadJoinedParticipant(data.room_id);
      return data;
    };

    const forceCloseProviderTrack = async (session: { provider_session_id: string; provider_track_mid: string | null }) => {
      if (!session.provider_track_mid) return;
      await cloudflareRequest(`/sessions/${session.provider_session_id}/tracks/close`, 'PUT', {
        force: true,
        tracks: [{ mid: session.provider_track_mid }],
      });
    };

    if (body.action === 'create_session') {
      if (!body.room_id || !body.session_kind) return response({ error: 'room_id and session_kind are required.' }, 400);
      const participant = await loadJoinedParticipant(body.room_id);
      if (body.session_kind === 'publisher' && !['host', 'speaker'].includes(participant.role)) {
        return response({ error: 'Only users on stage can publish audio.' }, 403);
      }

      await admin
        .from('room_audio_sessions')
        .update({ status: 'closed' })
        .eq('room_id', body.room_id)
        .eq('user_id', userData.user.id)
        .eq('session_kind', body.session_kind)
        .eq('status', 'active');

      const provider = await cloudflareRequest('/sessions/new', 'POST');
      if (typeof provider.sessionId !== 'string') throw new Error('Cloudflare did not return a session ID.');
      const { data: mediaSession, error: insertError } = await admin
        .from('room_audio_sessions')
        .insert({
          room_id: body.room_id,
          user_id: userData.user.id,
          provider_session_id: provider.sessionId,
          session_kind: body.session_kind,
        })
        .select('id')
        .single();
      if (insertError) throw insertError;
      return response({ mediaSessionId: mediaSession.id });
    }

    const mediaSession = body.media_session_id && body.action !== 'close_session'
      ? await loadOwnedSession(body.media_session_id)
      : null;

    if (body.action === 'publish') {
      if (!mediaSession) return response({ error: 'media_session_id is required.' }, 400);
      if (mediaSession.session_kind !== 'publisher') return response({ error: 'A publisher session is required.' }, 400);
      if (!isSessionDescription(body.session_description)) return response({ error: 'A valid offer is required.' }, 400);
      const participant = await loadJoinedParticipant(mediaSession.room_id);
      if (!['host', 'speaker'].includes(participant.role)) return response({ error: 'Publishing permission was revoked.' }, 403);

      const provider = await cloudflareRequest(`/sessions/${mediaSession.provider_session_id}/tracks/new`, 'POST', {
        autoDiscover: true,
        sessionDescription: body.session_description,
      });
      const tracks = Array.isArray(provider.tracks) ? provider.tracks as Array<Record<string, unknown>> : [];
      const audioTrack = tracks.find((track) => track.kind === 'audio') ?? tracks[0];
      if (!audioTrack || typeof audioTrack.trackName !== 'string') throw new Error('Cloudflare did not create an audio track.');
      await admin
        .from('room_audio_sessions')
        .update({
          provider_track_mid: typeof audioTrack.mid === 'string' ? audioTrack.mid : null,
          published_track_name: audioTrack.trackName,
        })
        .eq('id', mediaSession.id);
      return response({ provider });
    }

    if (body.action === 'revoke_publisher') {
      if (!body.room_id || !body.target_user_id) return response({ error: 'room_id and target_user_id are required.' }, 400);
      const requester = await loadJoinedParticipant(body.room_id);
      if (requester.role !== 'host') return response({ error: 'Only the room host can revoke a publisher.' }, 403);
      const { data: targetSession } = await admin
        .from('room_audio_sessions')
        .select('id, provider_session_id, provider_track_mid')
        .eq('room_id', body.room_id)
        .eq('user_id', body.target_user_id)
        .eq('session_kind', 'publisher')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (targetSession) {
        await forceCloseProviderTrack(targetSession);
        await admin.from('room_audio_sessions').update({ status: 'closed' }).eq('id', targetSession.id);
      }
      return response({ closed: Boolean(targetSession) });
    }

    if (body.action === 'close_room') {
      if (!body.room_id) return response({ error: 'room_id is required.' }, 400);
      const { data: room } = await admin.from('club_rooms').select('host_id').eq('id', body.room_id).maybeSingle();
      if (!room || room.host_id !== userData.user.id) return response({ error: 'Only the room host can close room audio.' }, 403);
      const { data: publisherSessions } = await admin
        .from('room_audio_sessions')
        .select('id, provider_session_id, provider_track_mid')
        .eq('room_id', body.room_id)
        .eq('session_kind', 'publisher')
        .not('provider_track_mid', 'is', null);
      const results = await Promise.allSettled((publisherSessions ?? []).map((session) => forceCloseProviderTrack(session)));
      const failed = results.filter((result) => result.status === 'rejected').length;
      await admin.from('room_audio_sessions').update({ status: 'closed' }).eq('room_id', body.room_id);
      if (failed) throw new Error(`Could not close ${failed} Cloudflare audio track(s).`);
      return response({ closed: true });
    }

    if (body.action === 'close_session') {
      if (!body.media_session_id) return response({ error: 'media_session_id is required.' }, 400);
      const { data: ownedSession } = await admin
        .from('room_audio_sessions')
        .select('id, provider_session_id, provider_track_mid, session_kind')
        .eq('id', body.media_session_id)
        .eq('user_id', userData.user.id)
        .maybeSingle();
      if (!ownedSession) return response({ closed: true });
      if (ownedSession.session_kind === 'publisher') await forceCloseProviderTrack(ownedSession);
      await admin.from('room_audio_sessions').update({ status: 'closed' }).eq('id', ownedSession.id);
      return response({ closed: true });
    }

    if (!mediaSession) return response({ error: 'media_session_id is required.' }, 400);

    if (body.action === 'pull') {
      if (mediaSession.session_kind !== 'subscriber') return response({ error: 'A subscriber session is required.' }, 400);
      const { data: publishers } = await admin
        .from('room_audio_sessions')
        .select('provider_session_id, published_track_name, user_id')
        .eq('room_id', mediaSession.room_id)
        .eq('session_kind', 'publisher')
        .eq('status', 'active')
        .not('published_track_name', 'is', null);
      const publisherIds = [...new Set((publishers ?? []).map((publisher) => publisher.user_id))];
      const { data: currentSpeakers } = publisherIds.length
        ? await admin
            .from('room_participants')
            .select('user_id')
            .eq('room_id', mediaSession.room_id)
            .eq('state', 'active')
            .is('left_at', null)
            .in('role', ['host', 'speaker'])
            .in('user_id', publisherIds)
        : { data: [] as Array<{ user_id: string }> };
      const speakerIds = new Set((currentSpeakers ?? []).map((speaker) => speaker.user_id));
      const tracks = (publishers ?? [])
        .filter((publisher) => speakerIds.has(publisher.user_id) && publisher.published_track_name)
        .map((publisher) => ({
          location: 'remote',
          sessionId: publisher.provider_session_id,
          trackName: publisher.published_track_name,
        }));
      if (tracks.length === 0) return response({ provider: null, trackCount: 0 });
      const provider = await cloudflareRequest(`/sessions/${mediaSession.provider_session_id}/tracks/new`, 'POST', { tracks });
      return response({ provider, trackCount: tracks.length });
    }

    if (body.action === 'renegotiate') {
      if (!isSessionDescription(body.session_description)) return response({ error: 'A valid answer is required.' }, 400);
      const provider = await cloudflareRequest(`/sessions/${mediaSession.provider_session_id}/renegotiate`, 'PUT', {
        sessionDescription: body.session_description,
      });
      return response({ provider });
    }

    return response({ error: 'Unsupported action.' }, 400);
  } catch (error) {
    return response({ error: error instanceof Error ? error.message : 'Unexpected audio gateway error.' }, 500);
  }
});
