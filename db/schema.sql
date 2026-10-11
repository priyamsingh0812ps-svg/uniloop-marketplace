-- =====================================================================
-- UniLoop — complete database schema (Supabase / PostgreSQL)
-- Safe to run repeatedly: never drops tables or data. Run the whole file
-- in Supabase → SQL Editor. Works on a fresh project and on projects that
-- already ran database/uniloop_schema.sql.
--
-- Concept map (names the app already uses are kept):
--   users / buyers / sellers -> public.profiles (+ views buyers, sellers)
--   categories               -> public.categories
--   listings                 -> public.listings
--   orders                   -> public.requests (+ view orders)
--   saved items              -> public.saved_items
--   chat                     -> public.conversations, public.messages
--   ratings                  -> public.reviews
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- shared helpers ----------
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at := now(); return new; end $$;

create or replace function public.is_college_email(e text) returns boolean
language sql immutable as $$ select coalesce(e,'') ~* '\.(edu|ac\.in|edu\.in|ac\.[a-z]{2})$' $$;

-- =====================================================================
-- PROFILES (every user can both buy and sell)
-- =====================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  college text not null default '',
  avatar_url text,
  verified boolean not null default false,
  verification_status text not null default 'none',
  id_card_url text,
  created_at timestamptz not null default now()
);
alter table public.profiles add column if not exists updated_at timestamptz not null default now();
do $$ begin
  alter table public.profiles add constraint profiles_verification_status_check
    check (verification_status in ('none','pending','verified'));
exception when duplicate_object then null; end $$;

grant select on public.profiles to anon, authenticated;
revoke update on public.profiles from authenticated;
grant update (full_name, college, avatar_url, id_card_url) on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
drop policy if exists "profiles readable" on public.profiles;
drop policy if exists "own profile update" on public.profiles;
create policy "profiles readable" on public.profiles for select using (true);
create policy "own profile update" on public.profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

-- An ID card upload puts unverified users into "pending review".
create or replace function public.profile_id_card_pending() returns trigger
language plpgsql as $$
begin
  if new.id_card_url is distinct from old.id_card_url and new.id_card_url is not null and not old.verified then
    new.verification_status := 'pending';
  end if;
  return new;
end $$;
drop trigger if exists profiles_id_card on public.profiles;
create trigger profiles_id_card before update on public.profiles
  for each row execute function public.profile_id_card_pending();
drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create a profile for each new auth user.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare ok boolean := new.email_confirmed_at is not null and public.is_college_email(new.email);
begin
  insert into public.profiles (id, full_name, college, verified, verification_status)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''),
          coalesce(new.raw_user_meta_data->>'college',''), ok, case when ok then 'verified' else 'none' end)
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Confirming a college email grants the Verified Student badge.
create or replace function public.handle_user_confirmed() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.email_confirmed_at is not null and old.email_confirmed_at is null and public.is_college_email(new.email) then
    update public.profiles set verified = true, verification_status = 'verified' where id = new.id;
  end if;
  return new;
end $$;
drop trigger if exists on_auth_user_confirmed on auth.users;
create trigger on_auth_user_confirmed after update on auth.users
  for each row execute function public.handle_user_confirmed();

-- Backfill profiles for users created before the trigger existed.
insert into public.profiles (id, full_name, college)
select u.id, coalesce(u.raw_user_meta_data->>'full_name',''), coalesce(u.raw_user_meta_data->>'college','')
from auth.users u on conflict (id) do nothing;

-- =====================================================================
-- CATEGORIES
-- =====================================================================
create table if not exists public.categories (
  slug text primary key,
  label text not null,
  subcategories text[] not null default '{}',
  modes text[] not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
grant select on public.categories to anon, authenticated;
grant all on public.categories to service_role;
alter table public.categories enable row level security;
drop policy if exists "categories public" on public.categories;
create policy "categories public" on public.categories for select using (true);

insert into public.categories (slug, label, subcategories, modes, sort_order) values
  ('study','Study Materials','{Books,Calculators,"Engineering Tools"}','{buy,rent,exchange}',1),
  ('hostel','Furniture & Hostel Essentials','{Furniture,"Study Lamps","Storage Boxes","Extension Boards","Other Hostel Essentials"}','{buy,rent,exchange}',2),
  ('sports','Sports & Fitness','{Cricket,Badminton,Football,Basketball,"Fitness Equipment"}','{buy,rent,exchange}',3),
  ('vehicles','Vehicles','{Scooters,Motorbikes,"Other Vehicles"}','{buy,rent,exchange}',4),
  ('gadgets','Gadgets & Electronics','{Headphones,Earphones,Laptops,Keyboards,Mice,Speakers,Monitors,"Other Accessories"}','{buy,rent,exchange}',5),
  ('food','Food & Meal Plans','{"Daily Lunch",Dinner,Breakfast,"Tiffin Services","Monthly Meal Packages","Mess Services","Home-Cooked Food"}','{meal}',6),
  ('accommodation','Accommodation','{Flats,"Shared Flats",PG,Hostels,"Rooms for Rent","Student Housing"}','{rent}',7)
on conflict (slug) do update set label = excluded.label, subcategories = excluded.subcategories,
  modes = excluded.modes, sort_order = excluded.sort_order;

-- =====================================================================
-- LISTINGS
-- =====================================================================
create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 100),
  description text not null default '' check (char_length(description) <= 2000),
  category text not null,
  subcategory text check (char_length(subcategory) <= 60),
  mode text not null check (mode in ('buy','rent','exchange','meal')),
  price numeric(10,2) not null default 0 check (price >= 0),
  rent_period text check (rent_period in ('day','week','month','semester')),
  condition text not null default 'Good',
  campus text not null check (char_length(campus) between 2 and 120),
  images text[] not null default '{}',
  image_url text,
  status text not null default 'available' check (status in ('available','reserved','sold','unavailable')),
  created_at timestamptz not null default now()
);
alter table public.listings add column if not exists updated_at timestamptz not null default now();
do $$ begin
  alter table public.listings add constraint listings_category_fkey
    foreign key (category) references public.categories(slug) on update cascade;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.listings add constraint listings_food_meal_check check ((category = 'food') = (mode = 'meal'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.listings add constraint listings_accommodation_rent_check check (category <> 'accommodation' or mode = 'rent');
exception when duplicate_object then null; end $$;

create index if not exists listings_seller_idx on public.listings(seller_id);
create index if not exists listings_status_idx on public.listings(status, created_at desc);
create index if not exists listings_category_idx on public.listings(category, created_at desc);

grant select on public.listings to anon, authenticated;
grant insert, update, delete on public.listings to authenticated;
grant all on public.listings to service_role;
alter table public.listings enable row level security;
drop policy if exists "listings visible" on public.listings;
drop policy if exists "seller insert" on public.listings;
drop policy if exists "seller update" on public.listings;
drop policy if exists "seller delete" on public.listings;
create policy "listings visible" on public.listings for select using (status <> 'unavailable' or auth.uid() = seller_id);
create policy "seller insert" on public.listings for insert to authenticated with check (auth.uid() = seller_id);
create policy "seller update" on public.listings for update to authenticated using (auth.uid() = seller_id) with check (auth.uid() = seller_id);
create policy "seller delete" on public.listings for delete to authenticated using (auth.uid() = seller_id);
drop trigger if exists listings_updated_at on public.listings;
create trigger listings_updated_at before update on public.listings
  for each row execute function public.set_updated_at();

-- =====================================================================
-- ORDERS (buy / rent / exchange / meal requests)
-- =====================================================================
create table if not exists public.requests (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.listings(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('buy','rent','exchange','meal')),
  start_date date,
  end_date date,
  message text check (char_length(message) <= 500),
  status text not null default 'pending' check (status in ('pending','accepted','declined','completed','cancelled')),
  created_at timestamptz not null default now(),
  check (buyer_id <> seller_id),
  check (end_date is null or start_date is null or end_date >= start_date)
);
alter table public.requests add column if not exists updated_at timestamptz not null default now();
create index if not exists requests_buyer_idx on public.requests(buyer_id);
create index if not exists requests_seller_idx on public.requests(seller_id);
create index if not exists requests_item_idx on public.requests(item_id);
-- One open request per buyer per item.
create unique index if not exists requests_one_open_idx on public.requests(item_id, buyer_id)
  where status in ('pending','accepted');

grant select, insert, update on public.requests to authenticated;
grant all on public.requests to service_role;
alter table public.requests enable row level security;
drop policy if exists "participants read requests" on public.requests;
drop policy if exists "buyer creates request" on public.requests;
drop policy if exists "participants update requests" on public.requests;
create policy "participants read requests" on public.requests for select to authenticated using (auth.uid() in (buyer_id, seller_id));
create policy "buyer creates request" on public.requests for insert to authenticated with check (
  auth.uid() = buyer_id and status = 'pending' and exists (
    select 1 from public.listings l where l.id = item_id and l.seller_id = requests.seller_id and l.status = 'available'));
create policy "participants update requests" on public.requests for update to authenticated
  using (auth.uid() in (buyer_id, seller_id)) with check (auth.uid() in (buyer_id, seller_id));

-- Only status may change, and only along allowed transitions.
create or replace function public.requests_guard() returns trigger
language plpgsql as $$
begin
  if new.item_id <> old.item_id or new.buyer_id <> old.buyer_id or new.seller_id <> old.seller_id or new.type <> old.type then
    raise exception 'Only the status can change';
  end if;
  if auth.uid() = old.seller_id then
    if not ((old.status = 'pending' and new.status in ('accepted','declined')) or (old.status = 'accepted' and new.status = 'completed')) then
      raise exception 'Invalid status change';
    end if;
  elsif auth.uid() = old.buyer_id then
    if not (old.status = 'pending' and new.status = 'cancelled') then raise exception 'Invalid status change'; end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists requests_guard on public.requests;
create trigger requests_guard before update on public.requests for each row execute function public.requests_guard();

-- Accepting marks the item sold (buy) or reserved (rent/exchange/meal).
create or replace function public.requests_after() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'accepted' and old.status <> 'accepted' then
    update public.listings set status = case when new.type = 'buy' then 'sold' else 'reserved' end where id = new.item_id;
  end if;
  return new;
end $$;
drop trigger if exists requests_after on public.requests;
create trigger requests_after after update on public.requests for each row execute function public.requests_after();

-- =====================================================================
-- SAVED ITEMS (wishlist)
-- =====================================================================
create table if not exists public.saved_items (
  user_id uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);
create index if not exists saved_items_listing_idx on public.saved_items(listing_id);
grant select, insert, delete on public.saved_items to authenticated;
grant all on public.saved_items to service_role;
alter table public.saved_items enable row level security;
drop policy if exists "own saved read" on public.saved_items;
drop policy if exists "own saved insert" on public.saved_items;
drop policy if exists "own saved delete" on public.saved_items;
create policy "own saved read" on public.saved_items for select to authenticated using (auth.uid() = user_id);
create policy "own saved insert" on public.saved_items for insert to authenticated with check (auth.uid() = user_id);
create policy "own saved delete" on public.saved_items for delete to authenticated using (auth.uid() = user_id);

-- =====================================================================
-- REVIEWS (after a completed deal)
-- =====================================================================
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  reviewee_id uuid not null references public.profiles(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text check (char_length(comment) <= 500),
  created_at timestamptz not null default now(),
  unique (request_id, reviewer_id)
);
create index if not exists reviews_reviewee_idx on public.reviews(reviewee_id);
grant select on public.reviews to anon, authenticated;
grant insert on public.reviews to authenticated;
grant all on public.reviews to service_role;
alter table public.reviews enable row level security;
drop policy if exists "reviews public" on public.reviews;
drop policy if exists "review completed deal" on public.reviews;
create policy "reviews public" on public.reviews for select using (true);
create policy "review completed deal" on public.reviews for insert to authenticated with check (
  reviewer_id = auth.uid() and exists (
    select 1 from public.requests r where r.id = request_id and r.status = 'completed'
      and ((r.buyer_id = auth.uid() and r.seller_id = reviewee_id) or (r.seller_id = auth.uid() and r.buyer_id = reviewee_id))));

-- =====================================================================
-- CHAT
-- =====================================================================
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.listings(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (item_id, buyer_id),
  check (buyer_id <> seller_id)
);
create index if not exists conversations_buyer_idx on public.conversations(buyer_id);
create index if not exists conversations_seller_idx on public.conversations(seller_id);
grant select, insert on public.conversations to authenticated;
grant all on public.conversations to service_role;
alter table public.conversations enable row level security;
drop policy if exists "participants read convos" on public.conversations;
drop policy if exists "buyer starts convo" on public.conversations;
create policy "participants read convos" on public.conversations for select to authenticated using (auth.uid() in (buyer_id, seller_id));
create policy "buyer starts convo" on public.conversations for insert to authenticated with check (
  auth.uid() = buyer_id and exists (select 1 from public.listings l where l.id = item_id and l.seller_id = conversations.seller_id));

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 2000),
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists messages_conv_idx on public.messages(conversation_id, created_at);
create index if not exists messages_unread_idx on public.messages(conversation_id) where not read;
grant select, insert on public.messages to authenticated;
revoke update on public.messages from authenticated;
grant update (read) on public.messages to authenticated;
grant all on public.messages to service_role;
alter table public.messages enable row level security;
drop policy if exists "participants read msgs" on public.messages;
drop policy if exists "participants send" on public.messages;
drop policy if exists "recipient marks read" on public.messages;
create policy "participants read msgs" on public.messages for select to authenticated using (
  exists (select 1 from public.conversations c where c.id = conversation_id and auth.uid() in (c.buyer_id, c.seller_id)));
create policy "participants send" on public.messages for insert to authenticated with check (
  sender_id = auth.uid() and read = false and exists (
    select 1 from public.conversations c where c.id = conversation_id and auth.uid() in (c.buyer_id, c.seller_id)));
create policy "recipient marks read" on public.messages for update to authenticated using (
  sender_id <> auth.uid() and exists (
    select 1 from public.conversations c where c.id = conversation_id and auth.uid() in (c.buyer_id, c.seller_id)));

-- =====================================================================
-- CONVENIENCE VIEWS (respect the caller's RLS)
-- =====================================================================
create or replace view public.sellers with (security_invoker = true) as
  select p.* from public.profiles p where exists (select 1 from public.listings l where l.seller_id = p.id);
create or replace view public.buyers with (security_invoker = true) as
  select p.* from public.profiles p where exists (select 1 from public.requests r where r.buyer_id = p.id);
create or replace view public.orders with (security_invoker = true) as
  select * from public.requests;
grant select on public.sellers to anon, authenticated;
grant select on public.buyers, public.orders to authenticated;

-- =====================================================================
-- REALTIME
-- =====================================================================
do $$ begin
  begin alter publication supabase_realtime add table public.messages; exception when others then null; end;
  begin alter publication supabase_realtime add table public.requests; exception when others then null; end;
end $$;

-- =====================================================================
-- STORAGE
-- =====================================================================
insert into storage.buckets (id, name, public) values ('listing-images','listing-images', true)
  on conflict (id) do update set public = true;
insert into storage.buckets (id, name, public) values ('id-cards','id-cards', false)
  on conflict (id) do nothing;
drop policy if exists "listing images public" on storage.objects;
drop policy if exists "upload own folder" on storage.objects;
drop policy if exists "delete own listing images" on storage.objects;
drop policy if exists "upload own id card" on storage.objects;
drop policy if exists "read own id card" on storage.objects;
create policy "listing images public" on storage.objects for select using (bucket_id = 'listing-images');
create policy "upload own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'listing-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "delete own listing images" on storage.objects for delete to authenticated
  using (bucket_id = 'listing-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "upload own id card" on storage.objects for insert to authenticated
  with check (bucket_id = 'id-cards' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "read own id card" on storage.objects for select to authenticated
  using (bucket_id = 'id-cards' and (storage.foldername(name))[1] = auth.uid()::text);
