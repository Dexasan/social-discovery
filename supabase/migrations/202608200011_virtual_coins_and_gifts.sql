begin;

create table public.coin_wallets (
  user_id uuid primary key references auth.users (id) on delete cascade,
  balance integer not null default 100,
  lifetime_earned integer not null default 100,
  lifetime_spent integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint coin_wallets_balance_nonnegative check (balance >= 0),
  constraint coin_wallets_earned_nonnegative check (lifetime_earned >= 0),
  constraint coin_wallets_spent_nonnegative check (lifetime_spent >= 0)
);

create table public.gift_catalog (
  slug text primary key,
  name text not null,
  emoji text not null,
  coin_cost integer not null,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint gift_catalog_slug_format check (slug ~ '^[a-z0-9_]{2,32}$'),
  constraint gift_catalog_name_length check (char_length(name) between 2 and 40),
  constraint gift_catalog_emoji_length check (char_length(emoji) between 1 and 16),
  constraint gift_catalog_coin_cost_positive check (coin_cost > 0)
);

create table public.gifts (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users (id) on delete cascade,
  recipient_id uuid not null references auth.users (id) on delete cascade,
  gift_slug text not null references public.gift_catalog (slug),
  coin_cost integer not null,
  context_kind text not null default 'profile',
  context_id uuid,
  created_at timestamptz not null default now(),
  constraint gifts_not_self check (sender_id <> recipient_id),
  constraint gifts_coin_cost_positive check (coin_cost > 0),
  constraint gifts_context_kind check (context_kind in ('profile', 'quick_chat', 'direct_message', 'club_room')),
  constraint gifts_profile_context check (context_kind <> 'profile' or context_id is null),
  constraint gifts_conversation_context check (context_kind = 'profile' or context_id is not null)
);

create table public.coin_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  amount integer not null,
  balance_after integer not null,
  kind text not null,
  reference_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint coin_ledger_amount_nonzero check (amount <> 0),
  constraint coin_ledger_balance_nonnegative check (balance_after >= 0),
  constraint coin_ledger_kind check (kind in ('welcome_bonus', 'rewarded_ad', 'purchase', 'gift_sent', 'admin_adjustment'))
);

create index gifts_recipient_created_idx on public.gifts (recipient_id, created_at desc);
create index gifts_sender_created_idx on public.gifts (sender_id, created_at desc);
create index gifts_context_idx on public.gifts (context_kind, context_id, created_at desc) where context_id is not null;
create index coin_ledger_user_created_idx on public.coin_ledger (user_id, created_at desc);

create trigger coin_wallets_set_updated_at
before update on public.coin_wallets
for each row execute function public.set_updated_at();

insert into public.gift_catalog (slug, name, emoji, coin_cost, sort_order)
values
  ('rose', 'Rose', '🌹', 15, 10),
  ('coffee', 'Coffee', '☕', 30, 20),
  ('heart', 'Heart', '💗', 75, 30),
  ('fire', 'Fire', '🔥', 100, 40),
  ('crown', 'Crown', '👑', 250, 50);

insert into public.coin_wallets (user_id)
select id from auth.users
on conflict (user_id) do nothing;

insert into public.coin_ledger (user_id, amount, balance_after, kind, metadata)
select wallet.user_id, 100, 100, 'welcome_bonus', '{"source":"mvp_launch"}'::jsonb
from public.coin_wallets wallet
where not exists (
  select 1 from public.coin_ledger entry
  where entry.user_id = wallet.user_id and entry.kind = 'welcome_bonus'
);

create or replace function public.create_coin_wallet()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.coin_wallets (user_id) values (new.id);
  insert into public.coin_ledger (user_id, amount, balance_after, kind, metadata)
  values (new.id, 100, 100, 'welcome_bonus', '{"source":"signup"}'::jsonb);
  return new;
end;
$$;

create trigger auth_user_coin_wallet_created
after insert on auth.users
for each row execute function public.create_coin_wallet();

create or replace function public.get_coin_wallet()
returns table (
  balance integer,
  lifetime_earned integer,
  lifetime_spent integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select wallet.balance, wallet.lifetime_earned, wallet.lifetime_spent
  from public.coin_wallets wallet
  where wallet.user_id = auth.uid();
$$;

create or replace function public.list_gift_catalog()
returns table (
  slug text,
  name text,
  emoji text,
  coin_cost integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select gift.slug, gift.name, gift.emoji, gift.coin_cost
  from public.gift_catalog gift
  where auth.uid() is not null and gift.active
  order by gift.sort_order, gift.coin_cost, gift.slug;
$$;

create or replace function public.list_profile_gifts(target_user_id uuid, gift_limit integer default 12)
returns table (
  gift_id uuid,
  sender_id uuid,
  sender_display_name text,
  sender_handle text,
  gift_slug text,
  gift_name text,
  gift_emoji text,
  coin_cost integer,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select sent_gift.id,
         sent_gift.sender_id,
         sender.display_name,
         sender.handle,
         catalog.slug,
         catalog.name,
         catalog.emoji,
         sent_gift.coin_cost,
         sent_gift.created_at
  from public.gifts sent_gift
  join public.profiles sender on sender.id = sent_gift.sender_id
  join public.gift_catalog catalog on catalog.slug = sent_gift.gift_slug
  where auth.uid() is not null
    and sent_gift.recipient_id = target_user_id
    and not public.is_blocked_between(auth.uid(), sent_gift.recipient_id)
    and not public.is_blocked_between(auth.uid(), sent_gift.sender_id)
  order by sent_gift.created_at desc
  limit least(greatest(gift_limit, 1), 30);
$$;

create or replace function public.send_virtual_gift(
  target_user_id uuid,
  target_gift_slug text,
  gift_context_kind text default 'profile',
  gift_context_id uuid default null
)
returns table (
  gift_id uuid,
  coin_cost integer,
  balance integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  sender_user_id uuid := auth.uid();
  selected_gift public.gift_catalog%rowtype;
  current_balance integer;
  next_balance integer;
  created_gift_id uuid;
begin
  if sender_user_id is null then
    raise exception 'Authentication required.';
  end if;
  if target_user_id is null or target_user_id = sender_user_id then
    raise exception 'Choose another person to receive this gift.';
  end if;
  if not exists (select 1 from public.profiles where id = target_user_id) then
    raise exception 'This profile is unavailable.';
  end if;
  if public.is_blocked_between(sender_user_id, target_user_id) then
    raise exception 'This gift cannot be sent.';
  end if;

  select * into selected_gift
  from public.gift_catalog
  where slug = target_gift_slug and active;
  if not found then
    raise exception 'This gift is unavailable.';
  end if;

  if gift_context_kind = 'profile' then
    if gift_context_id is not null then
      raise exception 'Profile gifts cannot include a context ID.';
    end if;
  elsif gift_context_kind = 'quick_chat' then
    if gift_context_id is null or not exists (
      select 1 from public.quick_chat_sessions session
      where session.id = gift_context_id
        and ((session.user_a_id = sender_user_id and session.user_b_id = target_user_id)
          or (session.user_b_id = sender_user_id and session.user_a_id = target_user_id))
    ) then
      raise exception 'This Quick Chat is unavailable.';
    end if;
  elsif gift_context_kind = 'direct_message' then
    if gift_context_id is null
      or not public.is_conversation_member(gift_context_id, sender_user_id)
      or not public.is_conversation_member(gift_context_id, target_user_id) then
      raise exception 'This conversation is unavailable.';
    end if;
  elsif gift_context_kind = 'club_room' then
    if gift_context_id is null or not exists (
      select 1
      from public.room_participants sender_participant
      join public.room_participants recipient_participant
        on recipient_participant.room_id = sender_participant.room_id
      where sender_participant.room_id = gift_context_id
        and sender_participant.user_id = sender_user_id
        and recipient_participant.user_id = target_user_id
        and sender_participant.state = 'active'
        and recipient_participant.state = 'active'
    ) then
      raise exception 'This live room is unavailable.';
    end if;
  else
    raise exception 'Unsupported gift context.';
  end if;

  insert into public.coin_wallets (user_id)
  values (sender_user_id)
  on conflict (user_id) do nothing;

  select wallet.balance into current_balance
  from public.coin_wallets wallet
  where wallet.user_id = sender_user_id
  for update;

  if current_balance < selected_gift.coin_cost then
    raise exception 'Not enough coins.';
  end if;

  update public.coin_wallets wallet
  set balance = wallet.balance - selected_gift.coin_cost,
      lifetime_spent = wallet.lifetime_spent + selected_gift.coin_cost
  where wallet.user_id = sender_user_id
  returning wallet.balance into next_balance;

  insert into public.gifts (sender_id, recipient_id, gift_slug, coin_cost, context_kind, context_id)
  values (sender_user_id, target_user_id, selected_gift.slug, selected_gift.coin_cost, gift_context_kind, gift_context_id)
  returning id into created_gift_id;

  insert into public.coin_ledger (user_id, amount, balance_after, kind, reference_id, metadata)
  values (
    sender_user_id,
    -selected_gift.coin_cost,
    next_balance,
    'gift_sent',
    created_gift_id,
    jsonb_build_object('recipient_id', target_user_id, 'gift_slug', selected_gift.slug, 'context_kind', gift_context_kind)
  );

  return query select created_gift_id, selected_gift.coin_cost, next_balance;
end;
$$;

alter table public.coin_wallets enable row level security;
alter table public.coin_ledger enable row level security;
alter table public.gift_catalog enable row level security;
alter table public.gifts enable row level security;

revoke all on public.coin_wallets from anon, authenticated;
revoke all on public.coin_ledger from anon, authenticated;
revoke all on public.gift_catalog from anon, authenticated;
revoke all on public.gifts from anon, authenticated;

grant select on public.coin_wallets to authenticated;
grant select on public.coin_ledger to authenticated;
grant select on public.gift_catalog to authenticated;
grant select on public.gifts to authenticated;

create policy coin_wallets_select_own on public.coin_wallets for select to authenticated
using (user_id = (select auth.uid()));

create policy coin_ledger_select_own on public.coin_ledger for select to authenticated
using (user_id = (select auth.uid()));

create policy gift_catalog_select_active on public.gift_catalog for select to authenticated
using (active);

create policy gifts_select_authenticated_unblocked on public.gifts for select to authenticated
using (
  sender_id = (select auth.uid())
  or recipient_id = (select auth.uid())
  or (
    not public.is_blocked_between((select auth.uid()), sender_id)
    and not public.is_blocked_between((select auth.uid()), recipient_id)
  )
);

revoke all on function public.create_coin_wallet() from public, anon, authenticated;
revoke all on function public.get_coin_wallet() from public, anon;
revoke all on function public.list_gift_catalog() from public, anon;
revoke all on function public.list_profile_gifts(uuid, integer) from public, anon;
revoke all on function public.send_virtual_gift(uuid, text, text, uuid) from public, anon;

grant execute on function public.get_coin_wallet() to authenticated;
grant execute on function public.list_gift_catalog() to authenticated;
grant execute on function public.list_profile_gifts(uuid, integer) to authenticated;
grant execute on function public.send_virtual_gift(uuid, text, text, uuid) to authenticated;

commit;
