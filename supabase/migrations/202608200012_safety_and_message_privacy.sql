begin;

alter table public.user_settings
add column message_permission text not null default 'everyone'
check (message_permission in ('everyone', 'followers', 'following'));

create or replace function public.can_message_user(sender_user_id uuid, recipient_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select sender_user_id is not null
    and recipient_user_id is not null
    and sender_user_id <> recipient_user_id
    and not public.is_blocked_between(sender_user_id, recipient_user_id)
    and exists (
      select 1
      from public.user_settings recipient_settings
      where recipient_settings.id = recipient_user_id
        and recipient_settings.onboarding_completed_at is not null
        and (
          recipient_settings.message_permission = 'everyone'
          or (
            recipient_settings.message_permission = 'followers'
            and exists (
              select 1 from public.follows
              where follower_id = sender_user_id and followed_id = recipient_user_id
            )
          )
          or (
            recipient_settings.message_permission = 'following'
            and exists (
              select 1 from public.follows
              where follower_id = recipient_user_id and followed_id = sender_user_id
            )
          )
        )
    );
$$;

create or replace function public.get_or_create_direct_conversation(other_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  low_user_id uuid;
  high_user_id uuid;
  existing_conversation_id uuid;
  created_conversation_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if other_user_id is null or other_user_id = current_user_id then
    raise exception 'Choose another user' using errcode = '22023';
  end if;
  if not public.can_message_user(current_user_id, other_user_id) then
    raise exception 'This account limits who can message them' using errcode = '42501';
  end if;
  if (
    select count(*)
    from public.user_settings
    where id in (current_user_id, other_user_id)
      and onboarding_completed_at is not null
  ) <> 2 then
    raise exception 'Both users must complete onboarding' using errcode = '42501';
  end if;

  low_user_id := least(current_user_id, other_user_id);
  high_user_id := greatest(current_user_id, other_user_id);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(low_user_id::text || high_user_id::text, 0));

  select direct.conversation_id
  into existing_conversation_id
  from public.direct_conversations direct
  where direct.user_low_id = low_user_id and direct.user_high_id = high_user_id;

  if existing_conversation_id is not null then
    return existing_conversation_id;
  end if;

  insert into public.conversations (kind, created_by)
  values ('direct', current_user_id)
  returning id into created_conversation_id;

  insert into public.conversation_members (conversation_id, user_id)
  values
    (created_conversation_id, current_user_id),
    (created_conversation_id, other_user_id);

  insert into public.direct_conversations (conversation_id, user_low_id, user_high_id)
  values (created_conversation_id, low_user_id, high_user_id);

  return created_conversation_id;
end;
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
        (
          conversation.kind = 'direct'
          and exists (
            select 1
            from public.conversation_members recipient_membership
            where recipient_membership.conversation_id = target_conversation_id
              and recipient_membership.user_id <> target_user_id
              and recipient_membership.left_at is null
              and public.can_message_user(target_user_id, recipient_membership.user_id)
          )
        )
        or exists (
          select 1
          from public.quick_chat_sessions quick_session
          where quick_session.conversation_id = target_conversation_id
            and quick_session.status = 'active'
        )
      )
  );
$$;

create or replace function public.get_privacy_settings()
returns table (message_permission text)
language sql
stable
security definer
set search_path = ''
as $$
  select settings.message_permission
  from public.user_settings settings
  where settings.id = auth.uid();
$$;

create or replace function public.set_message_permission(new_permission text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;
  if new_permission not in ('everyone', 'followers', 'following') then
    raise exception 'Unsupported message permission.';
  end if;

  update public.user_settings
  set message_permission = new_permission
  where id = auth.uid();
  return new_permission;
end;
$$;

create or replace function public.list_blocked_profiles()
returns table (
  user_id uuid,
  display_name text,
  handle text,
  country_code text,
  blocked_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select profile.id, profile.display_name, profile.handle, profile.country_code, blocked.created_at
  from public.blocks blocked
  join public.profiles profile on profile.id = blocked.blocked_id
  where blocked.blocker_id = auth.uid()
  order by blocked.created_at desc;
$$;

create or replace function public.unblock_profile(target_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed_count integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;
  delete from public.blocks
  where blocker_id = auth.uid() and blocked_id = target_user_id;
  get diagnostics removed_count = row_count;
  return removed_count > 0;
end;
$$;

revoke all on function public.can_message_user(uuid, uuid) from public, anon, authenticated;
revoke all on function public.get_privacy_settings() from public, anon;
revoke all on function public.set_message_permission(text) from public, anon;
revoke all on function public.list_blocked_profiles() from public, anon;
revoke all on function public.unblock_profile(uuid) from public, anon;

grant execute on function public.get_privacy_settings() to authenticated;
grant execute on function public.set_message_permission(text) to authenticated;
grant execute on function public.list_blocked_profiles() to authenticated;
grant execute on function public.unblock_profile(uuid) to authenticated;

commit;
