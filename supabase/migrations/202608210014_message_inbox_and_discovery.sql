begin;

drop function public.list_direct_conversations();

create function public.list_direct_conversations()
returns table (
  conversation_id uuid,
  partner_id uuid,
  partner_display_name text,
  partner_handle text,
  partner_country_code text,
  last_message_body text,
  last_message_at timestamptz,
  unread_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select direct.conversation_id,
         partner.id,
         partner.display_name,
         partner.handle,
         partner.country_code,
         latest.body,
         coalesce(latest.created_at, direct.created_at),
         (
           select count(*)
           from public.messages unread
           where unread.conversation_id = direct.conversation_id
             and unread.sender_id <> auth.uid()
             and unread.deleted_at is null
             and unread.created_at > coalesce(own_membership.last_read_at, own_membership.joined_at)
         )
  from public.direct_conversations direct
  join public.conversation_members own_membership
    on own_membership.conversation_id = direct.conversation_id
   and own_membership.user_id = auth.uid()
  join public.profiles partner
    on partner.id = case
      when direct.user_low_id = auth.uid() then direct.user_high_id
      else direct.user_low_id
    end
  left join lateral (
    select message.body, message.created_at
    from public.messages message
    where message.conversation_id = direct.conversation_id
      and message.deleted_at is null
    order by message.created_at desc
    limit 1
  ) latest on true
  where auth.uid() in (direct.user_low_id, direct.user_high_id)
    and not public.is_blocked_between(auth.uid(), partner.id)
  order by coalesce(latest.created_at, direct.created_at) desc;
$$;

create or replace function public.mark_conversation_read(target_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  update public.conversation_members
  set last_read_at = now()
  where conversation_id = target_conversation_id
    and user_id = auth.uid();

  if not found then
    raise exception 'Conversation access required' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.search_message_profiles(
  profile_query text default null,
  profile_limit integer default 30
)
returns table (
  user_id uuid,
  display_name text,
  handle text,
  country_code text,
  languages text[],
  bio text,
  is_following boolean,
  follows_me boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select profile.id,
         profile.display_name,
         profile.handle,
         profile.country_code,
         profile.languages,
         profile.bio,
         exists (
           select 1 from public.follows own_follow
           where own_follow.follower_id = auth.uid() and own_follow.followed_id = profile.id
         ),
         exists (
           select 1 from public.follows their_follow
           where their_follow.follower_id = profile.id and their_follow.followed_id = auth.uid()
         )
  from public.profiles profile
  join public.user_settings settings on settings.id = profile.id and settings.onboarding_completed_at is not null
  where auth.uid() is not null
    and profile.id <> auth.uid()
    and not public.is_blocked_between(auth.uid(), profile.id)
    and (
      nullif(trim(profile_query), '') is null
      or profile.display_name ilike '%' || trim(profile_query) || '%'
      or profile.handle ilike '%' || trim(profile_query) || '%'
    )
  order by
    exists (
      select 1 from public.follows own_follow
      where own_follow.follower_id = auth.uid() and own_follow.followed_id = profile.id
    ) desc,
    exists (
      select 1 from public.follows their_follow
      where their_follow.follower_id = profile.id and their_follow.followed_id = auth.uid()
    ) desc,
    profile.updated_at desc
  limit least(greatest(profile_limit, 1), 50);
$$;

revoke all on function public.list_direct_conversations() from public, anon;
revoke all on function public.mark_conversation_read(uuid) from public, anon;
revoke all on function public.search_message_profiles(text, integer) from public, anon;

grant execute on function public.list_direct_conversations() to authenticated;
grant execute on function public.mark_conversation_read(uuid) to authenticated;
grant execute on function public.search_message_profiles(text, integer) to authenticated;

commit;
