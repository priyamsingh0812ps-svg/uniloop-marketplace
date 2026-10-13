-- UniLoop orders ("Buy Now"). Safe to re-run; never drops tables or data.
-- Reuses public.requests as the orders table (type = 'buy').
-- Run in Supabase → SQL Editor after db/schema.sql / db/messaging.sql.
--
-- Order status:   pending (Requested) -> accepted -> completed
--                 pending -> declined (seller) | cancelled (buyer)
--                 accepted -> cancelled (seller backs out)
-- Listing status: available -> reserved (on order) -> sold (on completed)
--                 reserved -> available only when no other active order/request remains.

-- Price snapshot taken from the listing at order time (never from the client).
alter table public.requests add column if not exists price numeric(10,2) check (price is null or price >= 0);

-- Hard guarantee: at most one active Buy order per listing, even under races.
create unique index if not exists requests_one_active_buy_idx on public.requests(item_id)
  where type = 'buy' and status in ('pending','accepted');

-- Before insert: lock the listing row, validate, snapshot price, reserve it.
create or replace function public.requests_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare l public.listings%rowtype;
begin
  select * into l from public.listings where id = new.item_id for update;
  if not found then raise exception 'Listing not found'; end if;
  if l.seller_id <> new.seller_id then raise exception 'Seller mismatch'; end if;
  if l.seller_id = new.buyer_id then raise exception 'You cannot order your own listing'; end if;
  new.status := 'pending';
  if new.type = 'buy' then
    if l.mode <> 'buy' then raise exception 'This listing is not for sale'; end if;
    if l.status <> 'available' then raise exception 'Sorry, this item was just reserved by someone else'; end if;
    new.price := l.price;
    update public.listings set status = 'reserved' where id = l.id;
  end if;
  return new;
end $$;
drop trigger if exists requests_before_insert on public.requests;
create trigger requests_before_insert before insert on public.requests
  for each row execute function public.requests_before_insert();

-- Status transitions (only status may change).
create or replace function public.requests_guard() returns trigger
language plpgsql as $$
begin
  if new.item_id <> old.item_id or new.buyer_id <> old.buyer_id or new.seller_id <> old.seller_id
     or new.type <> old.type or new.price is distinct from old.price then
    raise exception 'Only the status can change';
  end if;
  if new.status = old.status then return new; end if;
  if auth.uid() = old.seller_id then
    if not ((old.status = 'pending' and new.status in ('accepted','declined'))
         or (old.status = 'accepted' and new.status in ('completed','cancelled'))) then
      raise exception 'Invalid status change';
    end if;
  elsif auth.uid() = old.buyer_id then
    if not (old.status = 'pending' and new.status = 'cancelled') then raise exception 'Invalid status change'; end if;
  elsif auth.uid() is not null then
    raise exception 'Not allowed';
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists requests_guard on public.requests;
create trigger requests_guard before update on public.requests for each row execute function public.requests_guard();

-- After status change: keep the listing status in sync.
create or replace function public.requests_after() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = old.status then return new; end if;
  if new.status = 'accepted' then
    update public.listings set status = 'reserved' where id = new.item_id and status = 'available';
  elsif new.status = 'completed' and new.type = 'buy' then
    update public.listings set status = 'sold' where id = new.item_id;
  elsif new.status in ('declined','cancelled') then
    -- Release only if nothing else still holds the item.
    update public.listings l set status = 'available'
    where l.id = new.item_id and l.status = 'reserved'
      and not exists (select 1 from public.requests r
                      where r.item_id = new.item_id and r.id <> new.id and r.status in ('pending','accepted')
                        and (r.type = 'buy' or r.status = 'accepted'));
  end if;
  return new;
end $$;
drop trigger if exists requests_after on public.requests;
create trigger requests_after after update on public.requests for each row execute function public.requests_after();

-- RLS (participants only; inserts only for yourself on available listings).
alter table public.requests enable row level security;
grant select, insert on public.requests to authenticated;
revoke update on public.requests from authenticated;
grant update (status) on public.requests to authenticated;
revoke all on public.requests from anon;
drop policy if exists "participants read requests" on public.requests;
drop policy if exists "buyer creates request" on public.requests;
drop policy if exists "participants update requests" on public.requests;
create policy "participants read requests" on public.requests for select to authenticated
  using (auth.uid() in (buyer_id, seller_id));
create policy "buyer creates request" on public.requests for insert to authenticated with check (
  auth.uid() = buyer_id and buyer_id <> seller_id and exists (
    select 1 from public.listings l where l.id = item_id and l.seller_id = requests.seller_id and l.status = 'available'));
create policy "participants update requests" on public.requests for update to authenticated
  using (auth.uid() in (buyer_id, seller_id)) with check (auth.uid() in (buyer_id, seller_id));

-- One-call Buy Now: creates the order, reserves the listing, notifies the seller in chat.
create or replace function public.place_order(p_listing_id uuid)
returns table (order_id uuid, conversation_id uuid)
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); l public.listings%rowtype; oid uuid; cid uuid;
begin
  if uid is null then raise exception 'Please log in to buy'; end if;
  select * into l from public.listings where id = p_listing_id;
  if not found then raise exception 'Listing not found'; end if;

  insert into public.requests (item_id, buyer_id, seller_id, type, message)
  values (l.id, uid, l.seller_id, 'buy', 'Buy Now order — pay in person on campus')
  returning id into oid;   -- trigger locks, validates and reserves

  insert into public.conversations (item_id, buyer_id, seller_id) values (l.id, uid, l.seller_id)
  on conflict (item_id, buyer_id) do nothing;
  select c.id into cid from public.conversations c where c.item_id = l.id and c.buyer_id = uid;

  insert into public.messages (conversation_id, sender_id, content)
  values (cid, uid, format('🛒 I''d like to buy "%s" for ₹%s. I''ll pay in person when we meet on campus. Please accept the order in My Orders.',
                           l.title, to_char(l.price, 'FM99999990.##')));
  return query select oid, cid;
exception when unique_violation then
  raise exception 'Sorry, this item was just reserved by someone else';
end $$;
revoke all on function public.place_order(uuid) from public, anon;
grant execute on function public.place_order(uuid) to authenticated;

do $$ begin
  begin alter publication supabase_realtime add table public.requests; exception when others then null; end;
end $$;
