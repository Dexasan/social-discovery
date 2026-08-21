begin;

alter table public.posts
  add column club_id uuid references public.clubs (id) on delete cascade;

create index posts_club_created_idx
  on public.posts (club_id, created_at desc)
  where deleted_at is null and club_id is not null;

drop policy posts_insert_own on public.posts;
create policy posts_insert_own
on public.posts for insert
to authenticated
with check (
  author_id = (select auth.uid())
  and (
    club_id is null
    or exists (
      select 1
      from public.club_memberships membership
      where membership.club_id = posts.club_id
        and membership.user_id = (select auth.uid())
        and membership.status = 'active'
    )
  )
);

create or replace function public.get_feed(feed_limit integer default 30, before_created_at timestamptz default null)
returns table (
  post_id uuid,
  author_id uuid,
  author_display_name text,
  author_handle text,
  author_country_code text,
  body text,
  topic text,
  created_at timestamptz,
  like_count bigint,
  reply_count bigint,
  liked_by_me boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select post.id,
         post.author_id,
         author.display_name,
         author.handle,
         author.country_code,
         post.body,
         post.topic,
         post.created_at,
         (select count(*) from public.post_likes post_like where post_like.post_id = post.id),
         (select count(*) from public.replies reply where reply.post_id = post.id and reply.deleted_at is null),
         exists (
           select 1 from public.post_likes own_like
           where own_like.post_id = post.id and own_like.user_id = auth.uid()
         )
  from public.posts post
  join public.profiles author on author.id = post.author_id
  where auth.uid() is not null
    and post.club_id is null
    and post.deleted_at is null
    and (before_created_at is null or post.created_at < before_created_at)
    and not public.is_blocked_between(auth.uid(), post.author_id)
  order by post.created_at desc
  limit least(greatest(feed_limit, 1), 50);
$$;

create or replace function public.create_club(
  club_name text,
  club_description text,
  club_topic text,
  member_rooms boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  created_club_id uuid := gen_random_uuid();
  slug_base text;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.user_settings
    where id = current_user_id and onboarding_completed_at is not null
  ) then
    raise exception 'Complete onboarding before creating a club' using errcode = '42501';
  end if;

  if char_length(trim(club_name)) not between 3 and 60 then
    raise exception 'Club name must contain 3-60 characters' using errcode = '22023';
  end if;
  if char_length(trim(club_description)) not between 10 and 300 then
    raise exception 'Description must contain 10-300 characters' using errcode = '22023';
  end if;
  if char_length(trim(club_topic)) not between 2 and 32 then
    raise exception 'Topic must contain 2-32 characters' using errcode = '22023';
  end if;
  if (select count(*) from public.clubs where created_by = current_user_id) >= 5 then
    raise exception 'You can own up to five clubs' using errcode = '22023';
  end if;

  slug_base := trim(both '-' from regexp_replace(lower(trim(club_name)), '[^a-z0-9]+', '-', 'g'));
  if char_length(slug_base) < 3 then
    slug_base := 'club';
  end if;

  insert into public.clubs (id, slug, name, description, topic, created_by, allow_member_rooms)
  values (
    created_club_id,
    left(slug_base, 33) || '-' || left(created_club_id::text, 6),
    trim(club_name),
    trim(club_description),
    trim(club_topic),
    current_user_id,
    member_rooms
  );

  insert into public.club_memberships (club_id, user_id, role, status)
  values (created_club_id, current_user_id, 'owner', 'active');

  return created_club_id;
end;
$$;

create or replace function public.get_club_detail(target_club_id uuid)
returns table (
  club_id uuid,
  slug text,
  name text,
  description text,
  topic text,
  allow_member_rooms boolean,
  created_at timestamptz,
  owner_id uuid,
  owner_display_name text,
  owner_handle text,
  member_count bigint,
  is_member boolean,
  member_role text,
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
         club.allow_member_rooms,
         club.created_at,
         owner.id,
         owner.display_name,
         owner.handle,
         (select count(*) from public.club_memberships member_count where member_count.club_id = club.id and member_count.status = 'active'),
         own_membership.user_id is not null,
         own_membership.role,
         live_room.id,
         live_room.title,
         coalesce((
           select count(*) from public.room_participants participant
           where participant.room_id = live_room.id and participant.state = 'active'
         ), 0)
  from public.clubs club
  left join public.profiles owner on owner.id = club.created_by
  left join public.club_memberships own_membership
    on own_membership.club_id = club.id
   and own_membership.user_id = auth.uid()
   and own_membership.status = 'active'
  left join public.club_rooms live_room
    on live_room.club_id = club.id and live_room.status = 'live'
  where auth.uid() is not null and club.id = target_club_id;
$$;

create or replace function public.list_club_members(target_club_id uuid, member_limit integer default 40)
returns table (
  user_id uuid,
  display_name text,
  handle text,
  country_code text,
  role text,
  joined_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select membership.user_id,
         profile.display_name,
         profile.handle,
         profile.country_code,
         membership.role,
         membership.joined_at
  from public.club_memberships membership
  join public.profiles profile on profile.id = membership.user_id
  where auth.uid() is not null
    and membership.club_id = target_club_id
    and membership.status = 'active'
    and not public.is_blocked_between(auth.uid(), membership.user_id)
  order by case membership.role when 'owner' then 1 when 'moderator' then 2 else 3 end,
           membership.joined_at
  limit least(greatest(member_limit, 1), 100);
$$;

create or replace function public.get_club_posts(
  target_club_id uuid,
  post_limit integer default 30,
  before_created_at timestamptz default null
)
returns table (
  post_id uuid,
  author_id uuid,
  author_display_name text,
  author_handle text,
  author_country_code text,
  body text,
  topic text,
  created_at timestamptz,
  like_count bigint,
  reply_count bigint,
  liked_by_me boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select post.id,
         post.author_id,
         author.display_name,
         author.handle,
         author.country_code,
         post.body,
         post.topic,
         post.created_at,
         (select count(*) from public.post_likes post_like where post_like.post_id = post.id),
         (select count(*) from public.replies reply where reply.post_id = post.id and reply.deleted_at is null),
         exists (
           select 1 from public.post_likes own_like
           where own_like.post_id = post.id and own_like.user_id = auth.uid()
         )
  from public.posts post
  join public.profiles author on author.id = post.author_id
  where auth.uid() is not null
    and post.club_id = target_club_id
    and post.deleted_at is null
    and (before_created_at is null or post.created_at < before_created_at)
    and not public.is_blocked_between(auth.uid(), post.author_id)
  order by post.created_at desc
  limit least(greatest(post_limit, 1), 50);
$$;

create or replace function public.create_club_post(target_club_id uuid, post_body text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_post_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if char_length(trim(post_body)) not between 1 and 500 then
    raise exception 'Post must contain 1-500 characters' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.club_memberships membership
    where membership.club_id = target_club_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
  ) then
    raise exception 'Join this club before posting' using errcode = '42501';
  end if;

  insert into public.posts (author_id, body, club_id)
  values (auth.uid(), trim(post_body), target_club_id)
  returning id into created_post_id;
  return created_post_id;
end;
$$;

create or replace function public.manage_club_member(
  target_club_id uuid,
  target_user_id uuid,
  management_action text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if management_action not in ('promote', 'demote', 'remove', 'ban') then
    raise exception 'Invalid membership action' using errcode = '22023';
  end if;
  if target_user_id = auth.uid() then
    raise exception 'Club owners cannot manage themselves here' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.club_memberships membership
    where membership.club_id = target_club_id
      and membership.user_id = auth.uid()
      and membership.role = 'owner'
      and membership.status = 'active'
  ) then
    raise exception 'Club owner permission required' using errcode = '42501';
  end if;

  if management_action = 'promote' then
    update public.club_memberships set role = 'moderator'
    where club_id = target_club_id and user_id = target_user_id and status = 'active' and role = 'member';
  elsif management_action = 'demote' then
    update public.club_memberships set role = 'member'
    where club_id = target_club_id and user_id = target_user_id and status = 'active' and role = 'moderator';
  elsif management_action = 'remove' then
    delete from public.club_memberships
    where club_id = target_club_id and user_id = target_user_id and role <> 'owner';
  else
    update public.club_memberships
    set status = 'banned', role = 'member'
    where club_id = target_club_id and user_id = target_user_id and role <> 'owner';
  end if;
end;
$$;

revoke all on function public.create_club(text, text, text, boolean) from public, anon;
revoke all on function public.get_club_detail(uuid) from public, anon;
revoke all on function public.list_club_members(uuid, integer) from public, anon;
revoke all on function public.get_club_posts(uuid, integer, timestamptz) from public, anon;
revoke all on function public.create_club_post(uuid, text) from public, anon;
revoke all on function public.manage_club_member(uuid, uuid, text) from public, anon;

grant execute on function public.create_club(text, text, text, boolean) to authenticated;
grant execute on function public.get_club_detail(uuid) to authenticated;
grant execute on function public.list_club_members(uuid, integer) to authenticated;
grant execute on function public.get_club_posts(uuid, integer, timestamptz) to authenticated;
grant execute on function public.create_club_post(uuid, text) to authenticated;
grant execute on function public.manage_club_member(uuid, uuid, text) to authenticated;

commit;
