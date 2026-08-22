begin;

alter table public.clubs add column avatar_path text;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values (
  'club-avatars',
  'club-avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy club_avatar_images_public_read
on storage.objects for select
to public
using (bucket_id = 'club-avatars');

create policy club_staff_insert_avatar
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'club-avatars'
  and exists (
    select 1 from public.club_memberships membership
    where membership.club_id::text = (storage.foldername(name))[1]
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
      and membership.role in ('owner', 'moderator')
  )
);

create policy club_staff_update_avatar
on storage.objects for update
to authenticated
using (
  bucket_id = 'club-avatars'
  and exists (
    select 1 from public.club_memberships membership
    where membership.club_id::text = (storage.foldername(name))[1]
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
      and membership.role in ('owner', 'moderator')
  )
)
with check (
  bucket_id = 'club-avatars'
  and exists (
    select 1 from public.club_memberships membership
    where membership.club_id::text = (storage.foldername(name))[1]
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
      and membership.role in ('owner', 'moderator')
  )
);

create policy club_staff_delete_avatar
on storage.objects for delete
to authenticated
using (
  bucket_id = 'club-avatars'
  and exists (
    select 1 from public.club_memberships membership
    where membership.club_id::text = (storage.foldername(name))[1]
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
      and membership.role in ('owner', 'moderator')
  )
);

create or replace function public.set_club_avatar(target_club_id uuid, target_avatar_path text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_path text := nullif(trim(target_avatar_path), '');
begin
  if not exists (
    select 1 from public.club_memberships membership
    where membership.club_id = target_club_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
      and membership.role in ('owner', 'moderator')
  ) then
    raise exception 'Only Club owners and moderators can change this picture.';
  end if;
  if normalized_path is not null and normalized_path not like (target_club_id::text || '/%') then
    raise exception 'Invalid Club picture path.';
  end if;
  update public.clubs set avatar_path = normalized_path where id = target_club_id;
  return normalized_path;
end;
$$;

revoke all on function public.set_club_avatar(uuid, text) from public, anon;
grant execute on function public.set_club_avatar(uuid, text) to authenticated;

commit;
