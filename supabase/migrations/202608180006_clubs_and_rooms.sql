begin;

create table public.clubs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null,
  topic text not null,
  created_by uuid references public.profiles (id) on delete set null,
  allow_member_rooms boolean not null default true,
  created_at timestamptz not null default now(),
  constraint clubs_slug_format check (slug ~ '^[a-z0-9-]{3,40}$'),
  constraint clubs_name_length check (char_length(name) between 3 and 60),
  constraint clubs_description_length check (char_length(description) between 10 and 300),
  constraint clubs_topic_length check (char_length(topic) between 2 and 32)
);

create table public.club_memberships (
  club_id uuid not null references public.clubs (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member',
  status text not null default 'active',
  joined_at timestamptz not null default now(),
  primary key (club_id, user_id),
  constraint club_memberships_role check (role in ('member', 'moderator', 'owner')),
  constraint club_memberships_status check (status in ('active', 'banned'))
);

create table public.club_rooms (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  host_id uuid not null references public.profiles (id) on delete restrict,
  title text not null,
  status text not null default 'live',
  audio_provider_room text unique,
  scheduled_for timestamptz,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  constraint club_rooms_title_length check (char_length(title) between 3 and 120),
  constraint club_rooms_status check (status in ('scheduled', 'live', 'ended'))
);

create table public.room_participants (
  room_id uuid not null references public.club_rooms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'listener',
  state text not null default 'active',
  hand_raised_at timestamptz,
  muted_by_moderator boolean not null default false,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  primary key (room_id, user_id),
  constraint room_participants_role check (role in ('listener', 'speaker', 'host')),
  constraint room_participants_state check (state in ('active', 'left', 'removed'))
);

create unique index club_rooms_one_live_per_club on public.club_rooms (club_id) where status = 'live';
create index club_memberships_user_idx on public.club_memberships (user_id, joined_at desc) where status = 'active';
create index club_rooms_status_started_idx on public.club_rooms (status, started_at desc);
create index room_participants_active_idx on public.room_participants (room_id, role, joined_at) where state = 'active';

create or replace function public.join_club(target_club_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.user_settings
    where id = current_user_id and onboarding_completed_at is not null
  ) then
    raise exception 'Complete onboarding before joining a club' using errcode = '42501';
  end if;

  insert into public.club_memberships (club_id, user_id)
  values (target_club_id, current_user_id)
  on conflict (club_id, user_id) do update
    set status = case when public.club_memberships.status = 'banned' then 'banned' else 'active' end,
        joined_at = case when public.club_memberships.status = 'banned' then public.club_memberships.joined_at else now() end;

  if exists (
    select 1 from public.club_memberships
    where club_id = target_club_id and user_id = current_user_id and status = 'banned'
  ) then
    raise exception 'You cannot join this club' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.leave_club(target_club_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.club_memberships
    where club_id = target_club_id and user_id = auth.uid() and role = 'owner'
  ) then
    raise exception 'Transfer club ownership before leaving' using errcode = '42501';
  end if;

  delete from public.club_memberships
  where club_id = target_club_id and user_id = auth.uid() and role <> 'owner';
end;
$$;

create or replace function public.start_club_room(target_club_id uuid, room_title text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  created_room_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if char_length(trim(room_title)) not between 3 and 120 then
    raise exception 'Room title must contain 3-120 characters' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.club_memberships membership
    join public.clubs club on club.id = membership.club_id
    where membership.club_id = target_club_id
      and membership.user_id = current_user_id
      and membership.status = 'active'
      and (club.allow_member_rooms or membership.role in ('moderator', 'owner'))
  ) then
    raise exception 'Join this club before starting a room' using errcode = '42501';
  end if;

  insert into public.club_rooms (club_id, host_id, title, status, started_at)
  values (target_club_id, current_user_id, trim(room_title), 'live', now())
  returning id into created_room_id;

  update public.club_rooms
  set audio_provider_room = 'club_' || replace(created_room_id::text, '-', '')
  where id = created_room_id;

  insert into public.room_participants (room_id, user_id, role)
  values (created_room_id, current_user_id, 'host');

  return created_room_id;
end;
$$;

create or replace function public.join_club_room(target_room_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  target_club_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select room.club_id into target_club_id
  from public.club_rooms room
  where room.id = target_room_id and room.status = 'live';

  if target_club_id is null then
    raise exception 'This room is no longer live' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.club_rooms room
    where room.id = target_room_id
      and public.is_blocked_between(current_user_id, room.host_id)
  ) then
    raise exception 'You cannot join this room' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.room_participants
    where room_id = target_room_id and user_id = current_user_id and state = 'removed'
  ) then
    raise exception 'You were removed from this room' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.club_memberships
    where club_id = target_club_id and user_id = current_user_id and status = 'banned'
  ) then
    raise exception 'You cannot join this room' using errcode = '42501';
  end if;

  insert into public.club_memberships (club_id, user_id)
  values (target_club_id, current_user_id)
  on conflict (club_id, user_id) do nothing;

  insert into public.room_participants (room_id, user_id, role, state, joined_at, left_at)
  values (target_room_id, current_user_id, 'listener', 'active', now(), null)
  on conflict (room_id, user_id) do update
    set role = case when public.room_participants.role = 'host' then 'host' else 'listener' end,
        state = 'active',
        hand_raised_at = null,
        joined_at = now(),
        left_at = null;
end;
$$;

create or replace function public.leave_club_room(target_room_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.room_participants
  set state = 'left', left_at = now(), hand_raised_at = null
  where room_id = target_room_id and user_id = auth.uid();
$$;

create or replace function public.set_room_hand_raised(target_room_id uuid, raised boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.room_participants participant
  set hand_raised_at = case when raised then now() else null end
  from public.club_rooms room
  where participant.room_id = target_room_id
    and participant.room_id = room.id
    and participant.user_id = auth.uid()
    and participant.state = 'active'
    and participant.role = 'listener'
    and room.status = 'live';

  if not found then
    raise exception 'Join this live room as a listener first' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.moderate_room_participant(target_room_id uuid, target_user_id uuid, moderation_action text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if moderation_action not in ('invite_speaker', 'move_listener', 'remove') then
    raise exception 'Invalid moderation action' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.club_rooms room
    left join public.club_memberships membership
      on membership.club_id = room.club_id and membership.user_id = auth.uid()
    where room.id = target_room_id
      and room.status = 'live'
      and (room.host_id = auth.uid() or (membership.status = 'active' and membership.role in ('moderator', 'owner')))
  ) then
    raise exception 'Host or moderator permission required' using errcode = '42501';
  end if;

  if moderation_action = 'invite_speaker' then
    update public.room_participants
    set role = 'speaker', hand_raised_at = null, muted_by_moderator = false
    where room_id = target_room_id and user_id = target_user_id and state = 'active';
  elsif moderation_action = 'move_listener' then
    update public.room_participants
    set role = 'listener', hand_raised_at = null, muted_by_moderator = true
    where room_id = target_room_id and user_id = target_user_id and state = 'active' and role <> 'host';
  else
    update public.room_participants
    set state = 'removed', left_at = now(), hand_raised_at = null
    where room_id = target_room_id and user_id = target_user_id and role <> 'host';
  end if;
end;
$$;

create or replace function public.end_club_room(target_room_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.club_rooms room
    left join public.club_memberships membership
      on membership.club_id = room.club_id and membership.user_id = auth.uid()
    where room.id = target_room_id
      and (room.host_id = auth.uid() or (membership.status = 'active' and membership.role in ('moderator', 'owner')))
  ) then
    raise exception 'Host or moderator permission required' using errcode = '42501';
  end if;

  update public.club_rooms set status = 'ended', ended_at = now()
  where id = target_room_id and status = 'live';

  update public.room_participants set state = 'left', left_at = now(), hand_raised_at = null
  where room_id = target_room_id and state = 'active';
end;
$$;

create or replace function public.list_clubs()
returns table (
  club_id uuid,
  slug text,
  name text,
  description text,
  topic text,
  member_count bigint,
  is_member boolean,
  live_room_id uuid,
  live_room_title text,
  live_listener_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select club.id,
         club.slug,
         club.name,
         club.description,
         club.topic,
         (select count(*) from public.club_memberships membership where membership.club_id = club.id and membership.status = 'active'),
         exists (
           select 1 from public.club_memberships own_membership
           where own_membership.club_id = club.id and own_membership.user_id = auth.uid() and own_membership.status = 'active'
         ),
         live_room.id,
         live_room.title,
         coalesce((
           select count(*) from public.room_participants participant
           where participant.room_id = live_room.id and participant.state = 'active'
         ), 0)
  from public.clubs club
  left join public.club_rooms live_room on live_room.club_id = club.id and live_room.status = 'live'
  where auth.uid() is not null
  order by (live_room.id is not null) desc, 6 desc, club.name;
$$;

create or replace function public.list_room_participants(target_room_id uuid)
returns table (
  user_id uuid,
  display_name text,
  handle text,
  role text,
  hand_raised_at timestamptz,
  is_host boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select participant.user_id,
         profile.display_name,
         profile.handle,
         participant.role,
         participant.hand_raised_at,
         room.host_id = participant.user_id
  from public.room_participants participant
  join public.club_rooms room on room.id = participant.room_id
  join public.profiles profile on profile.id = participant.user_id
  where auth.uid() is not null
    and participant.room_id = target_room_id
    and participant.state = 'active'
    and not public.is_blocked_between(auth.uid(), participant.user_id)
  order by case participant.role when 'host' then 1 when 'speaker' then 2 else 3 end,
           participant.hand_raised_at nulls last,
           participant.joined_at;
$$;

alter table public.clubs enable row level security;
alter table public.club_memberships enable row level security;
alter table public.club_rooms enable row level security;
alter table public.room_participants enable row level security;

revoke all on public.clubs from anon, authenticated;
revoke all on public.club_memberships from anon, authenticated;
revoke all on public.club_rooms from anon, authenticated;
revoke all on public.room_participants from anon, authenticated;

grant select on public.clubs to authenticated;
grant select on public.club_memberships to authenticated;
grant select on public.club_rooms to authenticated;
grant select on public.room_participants to authenticated;

create policy clubs_select_authenticated on public.clubs for select to authenticated using (true);
create policy club_memberships_select_unblocked on public.club_memberships for select to authenticated
using (user_id = (select auth.uid()) or not public.is_blocked_between((select auth.uid()), user_id));
create policy club_rooms_select_authenticated on public.club_rooms for select to authenticated using (true);
create policy room_participants_select_unblocked on public.room_participants for select to authenticated
using (user_id = (select auth.uid()) or not public.is_blocked_between((select auth.uid()), user_id));

revoke all on function public.join_club(uuid) from public, anon;
revoke all on function public.leave_club(uuid) from public, anon;
revoke all on function public.start_club_room(uuid, text) from public, anon;
revoke all on function public.join_club_room(uuid) from public, anon;
revoke all on function public.leave_club_room(uuid) from public, anon;
revoke all on function public.set_room_hand_raised(uuid, boolean) from public, anon;
revoke all on function public.moderate_room_participant(uuid, uuid, text) from public, anon;
revoke all on function public.end_club_room(uuid) from public, anon;
revoke all on function public.list_clubs() from public, anon;
revoke all on function public.list_room_participants(uuid) from public, anon;

grant execute on function public.join_club(uuid) to authenticated;
grant execute on function public.leave_club(uuid) to authenticated;
grant execute on function public.start_club_room(uuid, text) to authenticated;
grant execute on function public.join_club_room(uuid) to authenticated;
grant execute on function public.leave_club_room(uuid) to authenticated;
grant execute on function public.set_room_hand_raised(uuid, boolean) to authenticated;
grant execute on function public.moderate_room_participant(uuid, uuid, text) to authenticated;
grant execute on function public.end_club_room(uuid) to authenticated;
grant execute on function public.list_clubs() to authenticated;
grant execute on function public.list_room_participants(uuid) to authenticated;

insert into public.clubs (slug, name, description, topic)
values
  ('late-night-talks', 'Late Night Talks', 'Unfiltered conversations for people who are still awake.', 'Late Night'),
  ('language-exchange', 'Language Exchange', 'Practice languages through welcoming conversations with people worldwide.', 'Languages'),
  ('music-lovers', 'Music Lovers', 'Share discoveries, debate favorites, and listen together.', 'Music'),
  ('around-the-world', 'Around the World', 'Everyday stories and perspectives from different places and cultures.', 'Travel'),
  ('students', 'Students', 'Study motivation, campus stories, and honest student life.', 'Study')
on conflict (slug) do nothing;

do $$
begin
  alter publication supabase_realtime add table public.club_rooms;
exception when duplicate_object then null;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.room_participants;
exception when duplicate_object then null;
end;
$$;

commit;
