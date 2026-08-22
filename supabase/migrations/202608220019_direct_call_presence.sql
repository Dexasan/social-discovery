begin;

alter table public.direct_calls
  add column caller_last_seen_at timestamptz,
  add column callee_last_seen_at timestamptz;

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

  update public.direct_calls
  set status = 'ended', ended_at = now(), end_reason = 'Connection lost'
  where status = 'accepted'
    and (
      (caller_id = current_user_id and coalesce(caller_last_seen_at, accepted_at, created_at) < now() - interval '30 seconds')
      or
      (callee_id = current_user_id and coalesce(callee_last_seen_at, accepted_at, created_at) < now() - interval '30 seconds')
    );

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
    set status = 'accepted', accepted_at = now(), caller_last_seen_at = now(), callee_last_seen_at = now()
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

create or replace function public.heartbeat_direct_call(target_call_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  target_call public.direct_calls%rowtype;
  partner_last_seen timestamptz;
begin
  select * into target_call from public.direct_calls where id = target_call_id for update;
  if target_call.id is null or current_user_id not in (target_call.caller_id, target_call.callee_id) then
    raise exception 'Call not found.';
  end if;
  if target_call.status <> 'accepted' then
    return false;
  end if;

  partner_last_seen := case
    when current_user_id = target_call.caller_id then target_call.callee_last_seen_at
    else target_call.caller_last_seen_at
  end;
  if coalesce(partner_last_seen, target_call.accepted_at, target_call.created_at) < now() - interval '30 seconds' then
    update public.direct_calls
    set status = 'ended', ended_at = now(), ended_by = current_user_id, end_reason = 'Connection lost'
    where id = target_call_id;
    return false;
  end if;

  if current_user_id = target_call.caller_id then
    update public.direct_calls set caller_last_seen_at = now() where id = target_call_id;
  else
    update public.direct_calls set callee_last_seen_at = now() where id = target_call_id;
  end if;
  return true;
end;
$$;

revoke all on function public.heartbeat_direct_call(uuid) from public, anon;
grant execute on function public.heartbeat_direct_call(uuid) to authenticated;

commit;
