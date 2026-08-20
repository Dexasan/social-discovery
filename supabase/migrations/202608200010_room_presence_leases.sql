begin;

alter table public.room_participants
  add column last_seen_at timestamptz not null default now();

create index room_participants_presence_idx
  on public.room_participants (last_seen_at)
  where state = 'active';

create or replace function public.refresh_room_participant_presence()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT'
    or (new.state = 'active' and (old.state is distinct from 'active' or new.joined_at is distinct from old.joined_at))
  then
    new.last_seen_at := now();
  end if;
  return new;
end;
$$;

create trigger refresh_room_participant_presence
before insert or update of state, joined_at on public.room_participants
for each row execute function public.refresh_room_participant_presence();

create or replace function public.heartbeat_club_room(target_room_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  update public.room_participants participant
  set last_seen_at = now()
  from public.club_rooms room
  where participant.room_id = target_room_id
    and participant.room_id = room.id
    and participant.user_id = auth.uid()
    and participant.state = 'active'
    and participant.left_at is null
    and room.status = 'live';

  if not found then
    raise exception 'Join this live room first' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.expire_stale_club_room_participants(
  stale_after interval default interval '75 seconds'
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  expired_count integer := 0;
begin
  if stale_after < interval '30 seconds' then
    raise exception 'stale_after must be at least 30 seconds' using errcode = '22023';
  end if;

  with expired as (
    update public.room_participants
    set state = 'left', left_at = now(), hand_raised_at = null
    where state = 'active'
      and last_seen_at < now() - stale_after
    returning 1
  )
  select count(*) into expired_count from expired;

  with ended_rooms as (
    update public.club_rooms room
    set status = 'ended', ended_at = now()
    where room.status = 'live'
      and not exists (
        select 1
        from public.room_participants host
        where host.room_id = room.id
          and host.user_id = room.host_id
          and host.role = 'host'
          and host.state = 'active'
          and host.left_at is null
      )
    returning room.id
  )
  update public.room_participants participant
  set state = 'left', left_at = now(), hand_raised_at = null
  from ended_rooms
  where participant.room_id = ended_rooms.id
    and participant.state = 'active';

  return expired_count;
end;
$$;

revoke all on function public.refresh_room_participant_presence() from public, anon, authenticated;
revoke all on function public.heartbeat_club_room(uuid) from public, anon;
revoke all on function public.expire_stale_club_room_participants(interval) from public, anon, authenticated;
grant execute on function public.heartbeat_club_room(uuid) to authenticated;

create extension if not exists pg_cron;

do $$
begin
  if not exists (
    select 1 from cron.job where jobname = 'expire-stale-club-room-participants'
  ) then
    perform cron.schedule(
      'expire-stale-club-room-participants',
      '* * * * *',
      'select public.expire_stale_club_room_participants();'
    );
  end if;
end;
$$;

commit;
