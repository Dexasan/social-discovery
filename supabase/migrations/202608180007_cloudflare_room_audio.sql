create table public.room_audio_sessions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.club_rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null default 'cloudflare' check (provider = 'cloudflare'),
  provider_session_id text not null unique,
  session_kind text not null check (session_kind in ('publisher', 'subscriber')),
  published_track_name text,
  status text not null default 'active' check (status in ('active', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index room_audio_sessions_one_active_kind
  on public.room_audio_sessions (room_id, user_id, session_kind)
  where status = 'active';

create index room_audio_sessions_active_publishers
  on public.room_audio_sessions (room_id, session_kind, status)
  where published_track_name is not null;

alter table public.room_audio_sessions enable row level security;
alter table public.room_audio_sessions replica identity full;

create policy "joined room participants can read audio sessions"
  on public.room_audio_sessions
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.room_participants viewer
      where viewer.room_id = room_audio_sessions.room_id
        and viewer.user_id = auth.uid()
        and viewer.state = 'joined'
        and viewer.left_at is null
    )
  );

grant select on public.room_audio_sessions to authenticated;

create or replace function public.touch_room_audio_session()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger touch_room_audio_session_before_update
before update on public.room_audio_sessions
for each row execute function public.touch_room_audio_session();

create or replace function public.close_invalid_participant_audio_sessions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.state <> 'joined' or new.left_at is not null then
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

create trigger close_invalid_participant_audio_sessions_after_update
after update of role, state, left_at on public.room_participants
for each row execute function public.close_invalid_participant_audio_sessions();

create or replace function public.close_ended_room_audio_sessions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'live' and new.status <> 'live' then
    update public.room_audio_sessions
    set status = 'closed'
    where room_id = new.id
      and status = 'active';
  end if;
  return new;
end;
$$;

create trigger close_ended_room_audio_sessions_after_update
after update of status on public.club_rooms
for each row execute function public.close_ended_room_audio_sessions();

alter publication supabase_realtime add table public.room_audio_sessions;
