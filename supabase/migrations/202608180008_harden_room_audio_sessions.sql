alter table public.room_audio_sessions
  add column provider_track_mid text;

drop policy "joined room participants can read audio sessions"
  on public.room_audio_sessions;

create policy "joined room participants can read relevant audio sessions"
  on public.room_audio_sessions
  for select
  to authenticated
  using (
    (session_kind = 'publisher' or user_id = auth.uid())
    and exists (
      select 1
      from public.room_participants viewer
      where viewer.room_id = room_audio_sessions.room_id
        and viewer.user_id = auth.uid()
        and viewer.state = 'joined'
        and viewer.left_at is null
    )
  );
