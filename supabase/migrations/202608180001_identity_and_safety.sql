begin;

create table public.user_settings (
  id uuid primary key references auth.users (id) on delete cascade,
  date_of_birth date,
  age_verified_at timestamptz,
  terms_accepted_at timestamptz,
  community_guidelines_accepted_at timestamptz,
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  handle text,
  display_name text,
  country_code text,
  languages text[] not null default array[]::text[],
  bio text not null default '',
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_handle_format check (handle is null or handle ~ '^[a-z0-9_]{3,24}$'),
  constraint profiles_display_name_length check (display_name is null or char_length(display_name) between 2 and 50),
  constraint profiles_country_code_format check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  constraint profiles_languages_limit check (cardinality(languages) <= 8),
  constraint profiles_bio_length check (char_length(bio) <= 240)
);

create unique index profiles_handle_unique on public.profiles (lower(handle)) where handle is not null;

create table public.blocks (
  blocker_id uuid not null references auth.users (id) on delete cascade,
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint blocks_not_self check (blocker_id <> blocked_id)
);

create table public.follows (
  follower_id uuid not null references auth.users (id) on delete cascade,
  followed_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followed_id),
  constraint follows_not_self check (follower_id <> followed_id)
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users (id) on delete cascade,
  target_kind text not null,
  target_user_id uuid references auth.users (id) on delete set null,
  target_id uuid,
  category text not null,
  details text not null default '',
  status text not null default 'open',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint reports_target_kind check (target_kind in ('user', 'post', 'reply', 'message', 'room')),
  constraint reports_category check (category in ('spam', 'harassment', 'hate', 'sexual', 'violence', 'minor_safety', 'impersonation', 'other')),
  constraint reports_status check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  constraint reports_details_length check (char_length(details) <= 2000)
);

create index follows_followed_id_idx on public.follows (followed_id, created_at desc);
create index blocks_blocked_id_idx on public.blocks (blocked_id);
create index reports_status_created_at_idx on public.reports (status, created_at);
create index reports_target_user_id_idx on public.reports (target_user_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.is_blocked_between(first_user uuid, second_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.blocks
    where (blocker_id = first_user and blocked_id = second_user)
       or (blocker_id = second_user and blocked_id = first_user)
  );
$$;

create or replace function public.remove_relationship_on_block()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.follows
  where (follower_id = new.blocker_id and followed_id = new.blocked_id)
     or (follower_id = new.blocked_id and followed_id = new.blocker_id);
  return new;
end;
$$;

create or replace function public.create_user_records()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_settings (id) values (new.id);
  insert into public.profiles (id, display_name)
  values (new.id, nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''));
  return new;
end;
$$;

create trigger user_settings_set_updated_at
before update on public.user_settings
for each row execute function public.set_updated_at();

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger blocks_remove_relationship
after insert on public.blocks
for each row execute function public.remove_relationship_on_block();

create trigger auth_user_created
after insert on auth.users
for each row execute function public.create_user_records();

alter table public.user_settings enable row level security;
alter table public.profiles enable row level security;
alter table public.blocks enable row level security;
alter table public.follows enable row level security;
alter table public.reports enable row level security;

revoke all on public.user_settings from anon, authenticated;
revoke all on public.profiles from anon, authenticated;
revoke all on public.blocks from anon, authenticated;
revoke all on public.follows from anon, authenticated;
revoke all on public.reports from anon, authenticated;

grant select on public.user_settings to authenticated;
grant update (date_of_birth, terms_accepted_at, community_guidelines_accepted_at, onboarding_completed_at) on public.user_settings to authenticated;

grant select on public.profiles to authenticated;
grant update (handle, display_name, country_code, languages, bio, avatar_path) on public.profiles to authenticated;
grant select, insert, delete on public.blocks to authenticated;
grant select, insert, delete on public.follows to authenticated;
grant select, insert on public.reports to authenticated;

revoke all on function public.set_updated_at() from public;
revoke all on function public.is_blocked_between(uuid, uuid) from public;
revoke all on function public.remove_relationship_on_block() from public;
revoke all on function public.create_user_records() from public;
grant execute on function public.is_blocked_between(uuid, uuid) to authenticated;

create policy user_settings_select_self
on public.user_settings for select
to authenticated
using ((select auth.uid()) = id);

create policy user_settings_update_self
on public.user_settings for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy profiles_select_authenticated_unblocked
on public.profiles for select
to authenticated
using (
  (select auth.uid()) = id
  or not public.is_blocked_between((select auth.uid()), id)
);

create policy profiles_update_self
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy blocks_select_own
on public.blocks for select
to authenticated
using ((select auth.uid()) = blocker_id);

create policy blocks_insert_own
on public.blocks for insert
to authenticated
with check ((select auth.uid()) = blocker_id);

create policy blocks_delete_own
on public.blocks for delete
to authenticated
using ((select auth.uid()) = blocker_id);

create policy follows_select_authenticated_unblocked
on public.follows for select
to authenticated
using (
  not public.is_blocked_between((select auth.uid()), follower_id)
  and not public.is_blocked_between((select auth.uid()), followed_id)
);

create policy follows_insert_own_unblocked
on public.follows for insert
to authenticated
with check (
  (select auth.uid()) = follower_id
  and not public.is_blocked_between(follower_id, followed_id)
);

create policy follows_delete_own
on public.follows for delete
to authenticated
using ((select auth.uid()) = follower_id);

create policy reports_select_own
on public.reports for select
to authenticated
using ((select auth.uid()) = reporter_id);

create policy reports_insert_own
on public.reports for insert
to authenticated
with check ((select auth.uid()) = reporter_id);

commit;
