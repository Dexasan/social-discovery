const { execFileSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const path = require('node:path');

const { createClient } = require('@supabase/supabase-js');

const projectRef = 'fzpehebwhsfrrgdugxpr';
const supabaseUrl = `https://${projectRef}.supabase.co`;
const supabaseCli = path.resolve(
  'node_modules/.pnpm/supabase@2.114.0/node_modules/supabase/dist/supabase.js',
);

function loadProjectKeys() {
  const output = execFileSync(
    process.execPath,
    [supabaseCli, 'projects', 'api-keys', '--project-ref', projectRef],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
  const payload = JSON.parse(output);
  const serviceRole = payload.keys?.find((key) => key.name === 'service_role')?.api_key;
  const anonymous = payload.keys?.find((key) => key.name === 'anon')?.api_key;
  if (!serviceRole || !anonymous) throw new Error('Could not load the project API keys.');
  return { anonymous, serviceRole };
}

async function main() {
  const { anonymous, serviceRole } = loadProjectKeys();
  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const suffix = randomUUID();
  const email = `cloudflare-smoke-${suffix}@example.com`;
  const password = `Cloudflare-${suffix}!9`;
  let userId;
  let clubId;
  let roomId;

  try {
    const { data: createdUser, error: createUserError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: 'Audio Smoke Test' },
    });
    if (createUserError) throw createUserError;
    userId = createdUser.user.id;

    const userClient = createClient(supabaseUrl, anonymous, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: signedIn, error: signInError } = await userClient.auth.signInWithPassword({ email, password });
    if (signInError || !signedIn.session) throw signInError ?? new Error('The smoke-test user could not sign in.');

    const { data: club, error: clubError } = await admin
      .from('clubs')
      .insert({
        slug: `audio-smoke-${suffix.slice(0, 12)}`,
        name: 'Audio Smoke Test',
        description: 'Temporary club for the Cloudflare audio integration smoke test.',
        topic: 'Testing',
        created_by: userId,
      })
      .select('id')
      .single();
    if (clubError) throw clubError;
    clubId = club.id;

    const { data: room, error: roomError } = await admin
      .from('club_rooms')
      .insert({ club_id: clubId, host_id: userId, title: 'Cloudflare audio smoke test', status: 'live', started_at: new Date().toISOString() })
      .select('id')
      .single();
    if (roomError) throw roomError;
    roomId = room.id;

    const { error: participantError } = await admin
      .from('room_participants')
      .insert({ room_id: roomId, user_id: userId, role: 'host', state: 'active' });
    if (participantError) throw participantError;

    const gateway = async (body) => {
      const response = await fetch(`${supabaseUrl}/functions/v1/cloudflare-room-audio`, {
        method: 'POST',
        headers: {
          apikey: anonymous,
          Authorization: `Bearer ${signedIn.session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(`Audio gateway returned ${response.status}: ${data.error ?? 'Unknown error'}`);
      return data;
    };

    const opened = await gateway({ action: 'create_session', room_id: roomId, session_kind: 'subscriber' });
    if (!opened.mediaSessionId) throw new Error('The gateway did not return a media session ID.');
    const closed = await gateway({ action: 'close_session', media_session_id: opened.mediaSessionId });
    if (!closed.closed) throw new Error('The gateway did not close the media session.');

    const { data: storedSession, error: sessionError } = await admin
      .from('room_audio_sessions')
      .select('status')
      .eq('id', opened.mediaSessionId)
      .single();
    if (sessionError || storedSession.status !== 'closed') {
      throw sessionError ?? new Error('The stored media session was not closed.');
    }

    console.log('Cloudflare audio gateway smoke test passed.');
  } finally {
    if (roomId) await admin.from('club_rooms').delete().eq('id', roomId);
    if (clubId) await admin.from('clubs').delete().eq('id', clubId);
    if (userId) await admin.auth.admin.deleteUser(userId);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
