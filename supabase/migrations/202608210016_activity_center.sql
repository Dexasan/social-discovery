begin;

create table public.activity_events (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users (id) on delete cascade,
  actor_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  source_id uuid not null,
  post_id uuid references public.posts (id) on delete cascade,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint activity_events_not_self check (recipient_id <> actor_id),
  constraint activity_events_kind check (kind in ('follow', 'post_like', 'post_reply', 'gift')),
  unique (recipient_id, actor_id, kind, source_id)
);

create index activity_events_recipient_created_idx
  on public.activity_events (recipient_id, created_at desc);
create index activity_events_recipient_unread_idx
  on public.activity_events (recipient_id, created_at desc)
  where read_at is null;

create or replace function public.notify_follow_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.activity_events (recipient_id, actor_id, kind, source_id, created_at)
  values (new.followed_id, new.follower_id, 'follow', new.follower_id, new.created_at)
  on conflict (recipient_id, actor_id, kind, source_id) do update
    set created_at = excluded.created_at, read_at = null;
  return new;
end;
$$;

create trigger follows_create_activity
after insert on public.follows
for each row execute function public.notify_follow_activity();

create or replace function public.notify_post_like_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  post_author_id uuid;
  post_preview text;
begin
  select post.author_id, left(post.body, 120)
  into post_author_id, post_preview
  from public.posts post
  where post.id = new.post_id and post.deleted_at is null;

  if post_author_id is not null and post_author_id <> new.user_id then
    insert into public.activity_events (recipient_id, actor_id, kind, source_id, post_id, metadata, created_at)
    values (post_author_id, new.user_id, 'post_like', new.post_id, new.post_id, jsonb_build_object('post_preview', post_preview), new.created_at)
    on conflict (recipient_id, actor_id, kind, source_id) do update
      set created_at = excluded.created_at, read_at = null, metadata = excluded.metadata;
  end if;
  return new;
end;
$$;

create trigger post_likes_create_activity
after insert on public.post_likes
for each row execute function public.notify_post_like_activity();

create or replace function public.notify_post_reply_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  post_author_id uuid;
  post_preview text;
begin
  select post.author_id, left(post.body, 120)
  into post_author_id, post_preview
  from public.posts post
  where post.id = new.post_id and post.deleted_at is null;

  if post_author_id is not null and post_author_id <> new.author_id then
    insert into public.activity_events (recipient_id, actor_id, kind, source_id, post_id, metadata, created_at)
    values (
      post_author_id,
      new.author_id,
      'post_reply',
      new.id,
      new.post_id,
      jsonb_build_object('post_preview', post_preview, 'reply_preview', left(new.body, 120)),
      new.created_at
    );
  end if;
  return new;
end;
$$;

create trigger replies_create_activity
after insert on public.replies
for each row execute function public.notify_post_reply_activity();

create or replace function public.notify_gift_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  catalog_name text;
  catalog_emoji text;
begin
  select catalog.name, catalog.emoji
  into catalog_name, catalog_emoji
  from public.gift_catalog catalog
  where catalog.slug = new.gift_slug;

  insert into public.activity_events (recipient_id, actor_id, kind, source_id, metadata, created_at)
  values (
    new.recipient_id,
    new.sender_id,
    'gift',
    new.id,
    jsonb_build_object(
      'gift_name', catalog_name,
      'gift_emoji', catalog_emoji,
      'context_kind', new.context_kind,
      'context_id', new.context_id
    ),
    new.created_at
  );
  return new;
end;
$$;

create trigger gifts_create_activity
after insert on public.gifts
for each row execute function public.notify_gift_activity();

create or replace function public.list_activity_events(
  activity_limit integer default 50,
  before_created_at timestamptz default null
)
returns table (
  activity_id uuid,
  actor_id uuid,
  actor_display_name text,
  actor_handle text,
  actor_country_code text,
  kind text,
  source_id uuid,
  post_id uuid,
  post_body text,
  post_author_id uuid,
  post_author_name text,
  metadata jsonb,
  read_at timestamptz,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select activity.id,
         activity.actor_id,
         actor.display_name,
         actor.handle,
         actor.country_code,
         activity.kind,
         activity.source_id,
         activity.post_id,
         post.body,
         post.author_id,
         post_author.display_name,
         activity.metadata,
         activity.read_at,
         activity.created_at
  from public.activity_events activity
  join public.profiles actor on actor.id = activity.actor_id
  left join public.posts post on post.id = activity.post_id and post.deleted_at is null
  left join public.profiles post_author on post_author.id = post.author_id
  where activity.recipient_id = auth.uid()
    and (before_created_at is null or activity.created_at < before_created_at)
    and not public.is_blocked_between(auth.uid(), activity.actor_id)
  order by activity.created_at desc
  limit least(greatest(activity_limit, 1), 100);
$$;

create or replace function public.get_activity_unread_count()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)
  from public.activity_events activity
  where activity.recipient_id = auth.uid() and activity.read_at is null;
$$;

create or replace function public.mark_activity_read(target_activity_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_count integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  update public.activity_events
  set read_at = coalesce(read_at, now())
  where recipient_id = auth.uid()
    and read_at is null
    and (target_activity_id is null or id = target_activity_id);
  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

alter table public.activity_events enable row level security;
revoke all on public.activity_events from anon, authenticated;
grant select on public.activity_events to authenticated;

create policy activity_events_select_own
on public.activity_events for select
to authenticated
using (recipient_id = (select auth.uid()));

revoke all on function public.notify_follow_activity() from public, anon, authenticated;
revoke all on function public.notify_post_like_activity() from public, anon, authenticated;
revoke all on function public.notify_post_reply_activity() from public, anon, authenticated;
revoke all on function public.notify_gift_activity() from public, anon, authenticated;
revoke all on function public.list_activity_events(integer, timestamptz) from public, anon;
revoke all on function public.get_activity_unread_count() from public, anon;
revoke all on function public.mark_activity_read(uuid) from public, anon;

grant execute on function public.list_activity_events(integer, timestamptz) to authenticated;
grant execute on function public.get_activity_unread_count() to authenticated;
grant execute on function public.mark_activity_read(uuid) to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.activity_events;
exception when duplicate_object then null;
end;
$$;

commit;
