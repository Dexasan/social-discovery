begin;

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  topic text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint posts_body_length check (char_length(trim(body)) between 1 and 500),
  constraint posts_topic_length check (topic is null or char_length(topic) between 2 and 32)
);

create table public.replies (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint replies_body_length check (char_length(trim(body)) between 1 and 500)
);

create table public.post_likes (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table public.direct_conversations (
  conversation_id uuid primary key references public.conversations (id) on delete cascade,
  user_low_id uuid not null references public.profiles (id) on delete cascade,
  user_high_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_low_id, user_high_id),
  constraint direct_conversations_ordered_users check (user_low_id < user_high_id)
);

create index posts_created_at_idx on public.posts (created_at desc) where deleted_at is null;
create index posts_author_created_idx on public.posts (author_id, created_at desc) where deleted_at is null;
create index replies_post_created_idx on public.replies (post_id, created_at) where deleted_at is null;
create index post_likes_user_idx on public.post_likes (user_id, created_at desc);

create trigger posts_set_updated_at
before update on public.posts
for each row execute function public.set_updated_at();

create trigger replies_set_updated_at
before update on public.replies
for each row execute function public.set_updated_at();

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

  if public.is_blocked_between(current_user_id, other_user_id) then
    raise exception 'Messaging is unavailable for this account' using errcode = '42501';
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

create or replace function public.list_direct_conversations()
returns table (
  conversation_id uuid,
  partner_id uuid,
  partner_display_name text,
  partner_handle text,
  partner_country_code text,
  last_message_body text,
  last_message_at timestamptz
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
         coalesce(latest.created_at, direct.created_at)
  from public.direct_conversations direct
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

alter table public.posts enable row level security;
alter table public.replies enable row level security;
alter table public.post_likes enable row level security;
alter table public.direct_conversations enable row level security;

revoke all on public.posts from anon, authenticated;
revoke all on public.replies from anon, authenticated;
revoke all on public.post_likes from anon, authenticated;
revoke all on public.direct_conversations from anon, authenticated;

grant select, insert on public.posts to authenticated;
grant update (body, topic, deleted_at) on public.posts to authenticated;
grant select, insert on public.replies to authenticated;
grant update (body, deleted_at) on public.replies to authenticated;
grant select, insert, delete on public.post_likes to authenticated;

revoke all on function public.get_or_create_direct_conversation(uuid) from public, anon;
revoke all on function public.list_direct_conversations() from public, anon;
grant execute on function public.get_or_create_direct_conversation(uuid) to authenticated;
grant execute on function public.list_direct_conversations() to authenticated;

create policy posts_select_unblocked
on public.posts for select
to authenticated
using (
  deleted_at is null
  and not public.is_blocked_between((select auth.uid()), author_id)
);

create policy posts_insert_own
on public.posts for insert
to authenticated
with check (author_id = (select auth.uid()));

create policy posts_update_own
on public.posts for update
to authenticated
using (author_id = (select auth.uid()))
with check (author_id = (select auth.uid()));

create policy replies_select_unblocked
on public.replies for select
to authenticated
using (
  deleted_at is null
  and not public.is_blocked_between((select auth.uid()), author_id)
  and exists (
    select 1 from public.posts parent_post
    where parent_post.id = post_id and parent_post.deleted_at is null
  )
);

create policy replies_insert_own
on public.replies for insert
to authenticated
with check (
  author_id = (select auth.uid())
  and exists (
    select 1 from public.posts parent_post
    where parent_post.id = post_id
      and parent_post.deleted_at is null
      and not public.is_blocked_between((select auth.uid()), parent_post.author_id)
  )
);

create policy replies_update_own
on public.replies for update
to authenticated
using (author_id = (select auth.uid()))
with check (author_id = (select auth.uid()));

create policy post_likes_select_unblocked
on public.post_likes for select
to authenticated
using (
  exists (
    select 1 from public.posts liked_post
    where liked_post.id = post_id
      and liked_post.deleted_at is null
      and not public.is_blocked_between((select auth.uid()), liked_post.author_id)
  )
);

create policy post_likes_insert_own
on public.post_likes for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.posts liked_post
    where liked_post.id = post_id
      and liked_post.deleted_at is null
      and not public.is_blocked_between((select auth.uid()), liked_post.author_id)
  )
);

create policy post_likes_delete_own
on public.post_likes for delete
to authenticated
using (user_id = (select auth.uid()));

do $$
begin
  alter publication supabase_realtime add table public.posts;
exception when duplicate_object then null;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.replies;
exception when duplicate_object then null;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.post_likes;
exception when duplicate_object then null;
end;
$$;

commit;
