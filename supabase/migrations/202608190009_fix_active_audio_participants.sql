begin;

alter policy "joined room participants can read relevant audio sessions"
  on public.room_audio_sessions
  using (
    (session_kind = 'publisher' or user_id = auth.uid())
    and exists (
      select 1
      from public.room_participants viewer
      where viewer.room_id = room_audio_sessions.room_id
        and viewer.user_id = auth.uid()
        and viewer.state = 'active'
        and viewer.left_at is null
    )
  );

create or replace function public.close_invalid_participant_audio_sessions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.state <> 'active' or new.left_at is not null then
    update public.room_audio_sessions
    set status = 'closed'
    where room_id = new.room_id
      and user_id = new.user_id
      and status = 'active';
  elsif new.role not in ('host', 'speaker') then
    update public.room_audio_sessions
    set status = 'closed'
    where room_id = new.room_id
      and user_id = new.user_id
      and session_kind = 'publisher'
      and status = 'active';
  end if;
  return new;
end;
$$;

commit;
