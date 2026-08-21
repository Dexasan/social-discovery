begin;

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  -- Owned clubs cannot be left without an owner. Their dependent rooms, posts,
  -- memberships, and audio-session records are removed by existing cascades.
  delete from public.clubs
  where created_by = current_user_id;

  -- Rooms hosted inside clubs owned by someone else also hold a restrictive
  -- reference to the host profile.
  delete from public.club_rooms
  where host_id = current_user_id;

  -- Conversation records intentionally use restrictive sender/session keys.
  -- Remove every conversation involving this account before deleting auth data.
  delete from public.conversations conversation
  where conversation.created_by = current_user_id
     or exists (
       select 1
       from public.conversation_members membership
       where membership.conversation_id = conversation.id
         and membership.user_id = current_user_id
     );

  -- These defensive deletes cover malformed historical rows that may not have
  -- a matching membership, while normal rows are already removed by cascades.
  delete from public.messages where sender_id = current_user_id;
  delete from public.quick_chat_sessions
  where user_a_id = current_user_id or user_b_id = current_user_id;

  delete from auth.users where id = current_user_id;
  if not found then
    raise exception 'Account not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

commit;
