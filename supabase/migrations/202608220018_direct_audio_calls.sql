begin;

create table public.call_availability (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.direct_calls (
  id uuid primary key default gen_random_uuid(),
  caller_id uuid not null references public.profiles(id) on delete cascade,
  callee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'requested'
    check (status in ('requested', 'accepted', 'declined', 'cancelled', 'missed', 'ended')),
  accepted_at timestamptz,
  ended_at timestamptz,
  ended_by uuid references public.profiles(id) on delete set null,
  end_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint direct_calls_not_self check (caller_id <> callee_id),
  constraint direct_calls_end_reason_length check (end_reason is null or char_length(end_reason) <= 80)
);

create index call_availability_recent_idx on public.call_availability(last_seen_at desc);
create index direct_calls_caller_recent_idx on public.direct_calls(caller_id, created_at desc);
create index direct_calls_callee_recent_idx on public.direct_calls(callee_id, created_at desc);
create index direct_calls_open_idx on public.direct_calls(status, created_at desc)
  where status in ('requested', 'accepted');

create trigger touch_call_availability_before_update
before update on public.call_availability
for each row execute function public.set_updated_at();

create trigger touch_direct_calls_before_update
before update on public.direct_calls
for each row execute function public.set_updated_at();

alter table public.call_availability enable row level security;
alter table public.direct_calls enable row level security;
alter table public.direct_calls replica identity full;

create policy call_availability_select_own on public.call_availability
for select to authenticated using (user_id = (select auth.uid()));

create policy direct_calls_select_participant on public.direct_calls
for select to authenticated
using ((select auth.uid()) in (caller_id, callee_id));

revoke all on public.call_availability from anon, authenticated;
revoke all on public.direct_calls from anon, authenticated;
grant select on public.call_availability to authenticated;
grant select on public.direct_calls to authenticated;

create or replace function public.set_call_availability(target_available boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Authentication is required.';
  end if;

  update public.direct_calls
  set status = 'missed', ended_at = now(), end_reason = 'No answer'
  where status = 'requested'
    and created_at < now() - interval '35 seconds'
    and (caller_id = current_user_id or callee_id = current_user_id);

  if not target_available then
    delete from public.call_availability where user_id = current_user_id;
    return false;
  end if;

  if exists (
    select 1 from public.direct_calls
    where status in ('requested', 'accepted')
      and (caller_id = current_user_id or callee_id = current_user_id)
  ) then
    delete from public.call_availability where user_id = current_user_id;
    return false;
  end if;

  insert into public.call_availability(user_id, last_seen_at)
  values (current_user_id, now())
  on conflict (user_id) do update set last_seen_at = now();
  return true;
end;
$$;

create or replace function public.list_available_call_profiles()
returns table (
  user_id uuid,
  display_name text,
  handle text,
  country_code text,
  languages text[],
  avatar_path text,
  last_seen_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    profile.id,
    profile.display_name,
    profile.handle,
    profile.country_code,
    profile.languages,
    profile.avatar_path,
    available.last_seen_at
  from public.call_availability available
  join public.profiles profile on profile.id = available.user_id
  where auth.uid() is not null
    and available.user_id <> auth.uid()
    and available.last_seen_at > now() - interval '35 seconds'
    and profile.display_name is not null
    and not public.is_blocked_between(auth.uid(), available.user_id)
    and not exists (
      select 1 from public.direct_calls busy
      where busy.status in ('requested', 'accepted')
        and (busy.caller_id = available.user_id or busy.callee_id = available.user_id)
    )
  order by available.last_seen_at desc
  limit 30;
$$;

create or replace function public.request_direct_call(target_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  created_call_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication is required.';
  end if;
  if target_user_id is null or target_user_id = current_user_id then
    raise exception 'Choose another person to call.';
  end if;

  perform pg_advisory_xact_lock(hashtext(least(current_user_id::text, target_user_id::text)));
  perform pg_advisory_xact_lock(hashtext(greatest(current_user_id::text, target_user_id::text)));

  update public.direct_calls
  set status = 'missed', ended_at = now(), end_reason = 'No answer'
  where status = 'requested' and created_at < now() - interval '35 seconds'
    and (caller_id in (current_user_id, target_user_id) or callee_id in (current_user_id, target_user_id));

  if public.is_blocked_between(current_user_id, target_user_id) then
    raise exception 'This person is not available.';
  end if;
  if not exists (
    select 1 from public.call_availability
    where user_id = target_user_id and last_seen_at > now() - interval '35 seconds'
  ) then
    raise exception 'This person is no longer available.';
  end if;
  if exists (
    select 1 from public.direct_calls
    where status in ('requested', 'accepted')
      and (caller_id in (current_user_id, target_user_id) or callee_id in (current_user_id, target_user_id))
  ) then
    raise exception 'One of you is already handling another call.';
  end if;

  insert into public.direct_calls(caller_id, callee_id)
  values (current_user_id, target_user_id)
  returning id into created_call_id;

  delete from public.call_availability where user_id in (current_user_id, target_user_id);
  return created_call_id;
end;
$$;

create or replace function public.respond_direct_call(target_call_id uuid, accept_call boolean)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  target_call public.direct_calls%rowtype;
begin
  select * into target_call from public.direct_calls where id = target_call_id for update;
  if target_call.id is null or target_call.callee_id <> current_user_id then
    raise exception 'Call request not found.';
  end if;
  if target_call.status <> 'requested' then
    return target_call.status;
  end if;
  if target_call.created_at < now() - interval '35 seconds' then
    update public.direct_calls set status = 'missed', ended_at = now(), end_reason = 'No answer'
    where id = target_call_id;
    return 'missed';
  end if;
  if public.is_blocked_between(target_call.caller_id, target_call.callee_id) then
    accept_call := false;
  end if;

  if accept_call then
    update public.direct_calls
    set status = 'accepted', accepted_at = now()
    where id = target_call_id;
  else
    update public.direct_calls
    set status = 'declined', ended_at = now(), ended_by = current_user_id, end_reason = 'Declined'
    where id = target_call_id;
  end if;
  delete from public.call_availability where user_id in (target_call.caller_id, target_call.callee_id);
  return case when accept_call then 'accepted' else 'declined' end;
end;
$$;

create or replace function public.end_direct_call(target_call_id uuid, reason text default 'Ended')
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  target_call public.direct_calls%rowtype;
  next_status text;
begin
  select * into target_call from public.direct_calls where id = target_call_id for update;
  if target_call.id is null or current_user_id not in (target_call.caller_id, target_call.callee_id) then
    raise exception 'Call not found.';
  end if;
  if target_call.status not in ('requested', 'accepted') then
    return target_call.status;
  end if;

  next_status := case
    when target_call.status = 'accepted' then 'ended'
    when current_user_id = target_call.caller_id then 'cancelled'
    else 'declined'
  end;
  update public.direct_calls
  set status = next_status,
      ended_at = now(),
      ended_by = current_user_id,
      end_reason = left(coalesce(nullif(trim(reason), ''), 'Ended'), 80)
  where id = target_call_id;
  return next_status;
end;
$$;

revoke all on function public.set_call_availability(boolean) from public, anon;
revoke all on function public.list_available_call_profiles() from public, anon;
revoke all on function public.request_direct_call(uuid) from public, anon;
revoke all on function public.respond_direct_call(uuid, boolean) from public, anon;
revoke all on function public.end_direct_call(uuid, text) from public, anon;
grant execute on function public.set_call_availability(boolean) to authenticated;
grant execute on function public.list_available_call_profiles() to authenticated;
grant execute on function public.request_direct_call(uuid) to authenticated;
grant execute on function public.respond_direct_call(uuid, boolean) to authenticated;
grant execute on function public.end_direct_call(uuid, text) to authenticated;

alter table public.room_audio_sessions alter column room_id drop not null;
alter table public.room_audio_sessions
  add column call_id uuid references public.direct_calls(id) on delete cascade;
alter table public.room_audio_sessions
  add constraint room_audio_sessions_one_scope check ((room_id is null) <> (call_id is null));

create unique index room_audio_sessions_one_active_call_kind
  on public.room_audio_sessions(call_id, user_id, session_kind)
  where status = 'active' and call_id is not null;
create index room_audio_sessions_active_call_publishers
  on public.room_audio_sessions(call_id, session_kind, status)
  where published_track_name is not null and call_id is not null;

create policy direct_call_participants_can_read_audio_sessions
  on public.room_audio_sessions for select to authenticated
  using (
    call_id is not null and exists (
      select 1 from public.direct_calls direct_call
      where direct_call.id = room_audio_sessions.call_id
        and direct_call.status = 'accepted'
        and (select auth.uid()) in (direct_call.caller_id, direct_call.callee_id)
    )
  );

create or replace function public.close_ended_call_audio_sessions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'accepted' and new.status <> 'accepted' then
    update public.room_audio_sessions
    set status = 'closed'
    where call_id = new.id and status = 'active';
  end if;
  return new;
end;
$$;

create trigger close_ended_call_audio_sessions_after_update
after update of status on public.direct_calls
for each row execute function public.close_ended_call_audio_sessions();

alter publication supabase_realtime add table public.direct_calls;

commit;
