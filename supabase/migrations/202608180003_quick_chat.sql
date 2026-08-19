begin;

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint conversations_kind check (kind in ('quick_chat', 'direct'))
);

create table public.conversation_members (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  last_read_at timestamptz,
  primary key (conversation_id, user_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete restrict,
  body text not null,
  client_nonce uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint messages_body_length check (char_length(trim(body)) between 1 and 2000),
  unique (sender_id, client_nonce)
);

create table public.quick_chat_queue (
  user_id uuid primary key references auth.users (id) on delete cascade,
  languages text[] not null,
  topic text,
  queued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  constraint quick_chat_queue_languages check (cardinality(languages) between 1 and 8),
  constraint quick_chat_queue_topic_length check (topic is null or char_length(topic) between 2 and 40)
);

create table public.quick_chat_sessions (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null unique references public.conversations (id) on delete cascade,
  user_a_id uuid not null references auth.users (id) on delete restrict,
  user_b_id uuid not null references auth.users (id) on delete restrict,
  status text not null default 'active',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  ended_by uuid references auth.users (id) on delete set null,
  end_reason text,
  constraint quick_chat_sessions_distinct_users check (user_a_id <> user_b_id),
  constraint quick_chat_sessions_status check (status in ('active', 'ended')),
  constraint quick_chat_sessions_end_reason check (end_reason is null or end_reason in ('left', 'skip', 'blocked', 'reported', 'timeout'))
);

create index conversation_members_user_idx on public.conversation_members (user_id, joined_at desc);
create index messages_conversation_created_idx on public.messages (conversation_id, created_at);
create index quick_chat_queue_expiry_idx on public.quick_chat_queue (expires_at, queued_at);
create index quick_chat_sessions_user_a_idx on public.quick_chat_sessions (user_a_id, started_at desc);
create index quick_chat_sessions_user_b_idx on public.quick_chat_sessions (user_b_id, started_at desc);

create or replace function public.is_conversation_member(target_conversation_id uuid, target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.conversation_members
    where conversation_id = target_conversation_id
      and user_id = target_user_id
  );
$$;

create or replace function public.can_send_message(target_conversation_id uuid, target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.conversation_members own_membership
    join public.conversations conversation on conversation.id = own_membership.conversation_id
    where own_membership.conversation_id = target_conversation_id
      and own_membership.user_id = target_user_id
      and own_membership.left_at is null
      and not exists (
        select 1
        from public.conversation_members other_membership
        where other_membership.conversation_id = target_conversation_id
          and other_membership.user_id <> target_user_id
          and public.is_blocked_between(target_user_id, other_membership.user_id)
      )
      and (
        conversation.kind = 'direct'
        or exists (
          select 1
          from public.quick_chat_sessions quick_session
          where quick_session.conversation_id = target_conversation_id
            and quick_session.status = 'active'
        )
      )
  );
$$;

create or replace function public.join_quick_chat(match_languages text[], match_topic text default null)
returns table (
  match_status text,
  session_id uuid,
  conversation_id uuid,
  matched_profile_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  candidate_user_id uuid;
  existing_session_id uuid;
  existing_conversation_id uuid;
  existing_partner_id uuid;
  created_conversation_id uuid;
  created_session_id uuid;
  normalized_topic text := nullif(lower(trim(match_topic)), '');
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if match_languages is null or cardinality(match_languages) not between 1 and 8 then
    raise exception 'Choose between one and eight languages' using errcode = '22023';
  end if;

  if normalized_topic is not null and char_length(normalized_topic) not between 2 and 40 then
    raise exception 'Topic must contain 2-40 characters' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.user_settings
    where id = current_user_id
      and onboarding_completed_at is not null
      and age_verified_at is not null
  ) then
    raise exception 'Complete age-verified onboarding before matching' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(current_user_id::text, 0));

  select quick_session.id,
         quick_session.conversation_id,
         case
           when quick_session.user_a_id = current_user_id then quick_session.user_b_id
           else quick_session.user_a_id
         end
  into existing_session_id, existing_conversation_id, existing_partner_id
  from public.quick_chat_sessions quick_session
  where quick_session.status = 'active'
    and current_user_id in (quick_session.user_a_id, quick_session.user_b_id)
  order by quick_session.started_at desc
  limit 1;

  if existing_session_id is not null then
    return query select 'matched'::text, existing_session_id, existing_conversation_id, existing_partner_id;
    return;
  end if;

  delete from public.quick_chat_queue where expires_at <= now();

  select queued.user_id
  into candidate_user_id
  from public.quick_chat_queue queued
  where queued.user_id <> current_user_id
    and queued.expires_at > now()
    and queued.languages && match_languages
    and (normalized_topic is null or queued.topic is null or queued.topic = normalized_topic)
    and not public.is_blocked_between(current_user_id, queued.user_id)
    and not exists (
      select 1
      from public.quick_chat_sessions recent_session
      where recent_session.started_at > now() - interval '5 minutes'
        and (
          (recent_session.user_a_id = current_user_id and recent_session.user_b_id = queued.user_id)
          or (recent_session.user_b_id = current_user_id and recent_session.user_a_id = queued.user_id)
        )
    )
  order by queued.queued_at
  for update skip locked
  limit 1;

  if candidate_user_id is null then
    insert into public.quick_chat_queue (user_id, languages, topic, queued_at, expires_at)
    values (current_user_id, match_languages, normalized_topic, now(), now() + interval '90 seconds')
    on conflict (user_id) do update
      set languages = excluded.languages,
          topic = excluded.topic,
          queued_at = excluded.queued_at,
          expires_at = excluded.expires_at;

    return query select 'queued'::text, null::uuid, null::uuid, null::uuid;
    return;
  end if;

  delete from public.quick_chat_queue where user_id in (current_user_id, candidate_user_id);

  insert into public.conversations (kind, created_by)
  values ('quick_chat', current_user_id)
  returning id into created_conversation_id;

  insert into public.conversation_members (conversation_id, user_id)
  values
    (created_conversation_id, current_user_id),
    (created_conversation_id, candidate_user_id);

  insert into public.quick_chat_sessions (conversation_id, user_a_id, user_b_id)
  values (created_conversation_id, candidate_user_id, current_user_id)
  returning id into created_session_id;

  return query select 'matched'::text, created_session_id, created_conversation_id, candidate_user_id;
end;
$$;

create or replace function public.cancel_quick_chat_search()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.quick_chat_queue where user_id = auth.uid();
$$;

create or replace function public.leave_quick_chat(target_session_id uuid, leave_reason text default 'left')
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  target_conversation_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if leave_reason not in ('left', 'skip', 'blocked', 'reported') then
    raise exception 'Invalid leave reason' using errcode = '22023';
  end if;

  update public.quick_chat_sessions
  set status = 'ended',
      ended_at = now(),
      ended_by = current_user_id,
      end_reason = leave_reason
  where id = target_session_id
    and status = 'active'
    and current_user_id in (user_a_id, user_b_id)
  returning conversation_id into target_conversation_id;

  if target_conversation_id is null then
    return false;
  end if;

  update public.conversation_members
  set left_at = now()
  where conversation_id = target_conversation_id
    and user_id = current_user_id;

  return true;
end;
$$;

alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.quick_chat_queue enable row level security;
alter table public.quick_chat_sessions enable row level security;

revoke all on public.conversations from anon, authenticated;
revoke all on public.conversation_members from anon, authenticated;
revoke all on public.messages from anon, authenticated;
revoke all on public.quick_chat_queue from anon, authenticated;
revoke all on public.quick_chat_sessions from anon, authenticated;

grant select on public.conversations to authenticated;
grant select on public.conversation_members to authenticated;
grant select, insert on public.messages to authenticated;
grant select on public.quick_chat_sessions to authenticated;

revoke all on function public.is_conversation_member(uuid, uuid) from public, anon;
revoke all on function public.can_send_message(uuid, uuid) from public, anon;
revoke all on function public.join_quick_chat(text[], text) from public, anon;
revoke all on function public.cancel_quick_chat_search() from public, anon;
revoke all on function public.leave_quick_chat(uuid, text) from public, anon;

grant execute on function public.is_conversation_member(uuid, uuid) to authenticated;
grant execute on function public.can_send_message(uuid, uuid) to authenticated;
grant execute on function public.join_quick_chat(text[], text) to authenticated;
grant execute on function public.cancel_quick_chat_search() to authenticated;
grant execute on function public.leave_quick_chat(uuid, text) to authenticated;

create policy conversations_select_members
on public.conversations for select
to authenticated
using (public.is_conversation_member(id, (select auth.uid())));

create policy conversation_members_select_members
on public.conversation_members for select
to authenticated
using (public.is_conversation_member(conversation_id, (select auth.uid())));

create policy messages_select_members
on public.messages for select
to authenticated
using (public.is_conversation_member(conversation_id, (select auth.uid())));

create policy messages_insert_sender
on public.messages for insert
to authenticated
with check (
  sender_id = (select auth.uid())
  and public.can_send_message(conversation_id, (select auth.uid()))
);

create policy quick_chat_sessions_select_participants
on public.quick_chat_sessions for select
to authenticated
using ((select auth.uid()) in (user_a_id, user_b_id));

do $$
begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.quick_chat_sessions;
exception when duplicate_object then null;
end;
$$;

commit;
