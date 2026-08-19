begin;

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
    and post.deleted_at is null
    and (before_created_at is null or post.created_at < before_created_at)
    and not public.is_blocked_between(auth.uid(), post.author_id)
  order by post.created_at desc
  limit least(greatest(feed_limit, 1), 50);
$$;

create or replace function public.get_post_replies(target_post_id uuid)
returns table (
  reply_id uuid,
  author_id uuid,
  author_display_name text,
  author_handle text,
  body text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select reply.id,
         reply.author_id,
         author.display_name,
         author.handle,
         reply.body,
         reply.created_at
  from public.replies reply
  join public.posts post on post.id = reply.post_id
  join public.profiles author on author.id = reply.author_id
  where auth.uid() is not null
    and reply.post_id = target_post_id
    and reply.deleted_at is null
    and post.deleted_at is null
    and not public.is_blocked_between(auth.uid(), post.author_id)
    and not public.is_blocked_between(auth.uid(), reply.author_id)
  order by reply.created_at;
$$;

revoke all on function public.get_feed(integer, timestamptz) from public, anon;
revoke all on function public.get_post_replies(uuid) from public, anon;
grant execute on function public.get_feed(integer, timestamptz) to authenticated;
grant execute on function public.get_post_replies(uuid) to authenticated;

commit;
