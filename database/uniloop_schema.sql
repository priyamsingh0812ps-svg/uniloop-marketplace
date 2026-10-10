-- UniLoop schema v2. Run the whole file once in Supabase → SQL Editor.
-- WARNING: re-running resets all UniLoop tables (drops and recreates them).

-- ---------- cleanup of v1 / previous runs ----------
drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists on_auth_user_confirmed on auth.users;
drop table if exists public.reviews, public.messages, public.conversations, public.requests,
  public.wishlist, public.listings, public.profiles cascade;
drop function if exists public.handle_new_user() cascade;
drop function if exists public.handle_user_confirmed() cascade;
drop function if exists public.is_college_email(text) cascade;
drop type if exists public.listing_mode cascade;
drop type if exists public.listing_category cascade;


create or replace function public.is_college_email(e text) returns boolean
language sql immutable as $$ select coalesce(e,'') ~* '\.(edu|ac\.in|edu\.in|ac\.[a-z]{2})$' $$;

-- ---------- profiles ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  college text not null default '',
  avatar_url text,
  verified boolean not null default false,
  verification_status text not null default 'none' check (verification_status in ('none','pending','verified')),
  id_card_url text,
  created_at timestamptz not null default now()
);
grant select on public.profiles to anon, authenticated;
grant update (full_name, college, avatar_url, id_card_url) on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "profiles readable" on public.profiles for select using (true);
create policy "own profile update" on public.profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

create or replace function public.profile_id_card_pending() returns trigger
language plpgsql as $$
begin
  if new.id_card_url is distinct from old.id_card_url and new.id_card_url is not null and not old.verified then
    new.verification_status := 'pending';
  end if;
  return new;
end $$;
create trigger profiles_id_card before update on public.profiles
  for each row execute function public.profile_id_card_pending();

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare ok boolean := new.email_confirmed_at is not null and public.is_college_email(new.email);
begin
  insert into public.profiles (id, full_name, college, verified, verification_status)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''),
          coalesce(new.raw_user_meta_data->>'college',''), ok, case when ok then 'verified' else 'none' end);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.handle_user_confirmed() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.email_confirmed_at is not null and old.email_confirmed_at is null and public.is_college_email(new.email) then
    update public.profiles set verified = true, verification_status = 'verified' where id = new.id;
  end if;
  return new;
end $$;
create trigger on_auth_user_confirmed after update on auth.users
  for each row execute function public.handle_user_confirmed();

-- ---------- listings ----------
create table public.listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 100),
  description text not null default '' check (char_length(description) <= 2000),
  category text not null check (category in ('study','hostel','sports','vehicles','gadgets','food','accommodation')),
  subcategory text check (char_length(subcategory) <= 60),
  mode text not null check (mode in ('buy','rent','exchange','meal')),
  price numeric(10,2) not null default 0 check (price >= 0),
  rent_period text check (rent_period in ('day','week','month','semester')),
  check ((category = 'food') = (mode = 'meal')),
  check (category <> 'accommodation' or mode = 'rent'),
  condition text not null default 'Good',
  campus text not null check (char_length(campus) between 2 and 120),
  images text[] not null default '{}',
  image_url text,
  status text not null default 'available' check (status in ('available','reserved','sold','unavailable')),
  created_at timestamptz not null default now()
);
create index listings_seller_idx on public.listings(seller_id);
create index listings_status_idx on public.listings(status, created_at desc);
grant select on public.listings to anon, authenticated;
grant insert, update, delete on public.listings to authenticated;
grant all on public.listings to service_role;
alter table public.listings enable row level security;
create policy "listings visible" on public.listings for select using (status <> 'unavailable' or auth.uid() = seller_id);
create policy "seller insert" on public.listings for insert to authenticated with check (auth.uid() = seller_id);
create policy "seller update" on public.listings for update to authenticated using (auth.uid() = seller_id) with check (auth.uid() = seller_id);
create policy "seller delete" on public.listings for delete to authenticated using (auth.uid() = seller_id);

-- ---------- requests ----------
create table public.requests (
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
create index requests_buyer_idx on public.requests(buyer_id);
create index requests_seller_idx on public.requests(seller_id);
grant select, insert, update on public.requests to authenticated;
grant all on public.requests to service_role;
alter table public.requests enable row level security;
create policy "participants read requests" on public.requests for select to authenticated using (auth.uid() in (buyer_id, seller_id));
create policy "buyer creates request" on public.requests for insert to authenticated with check (
  auth.uid() = buyer_id and status = 'pending' and exists (
    select 1 from public.listings l where l.id = item_id and l.seller_id = requests.seller_id and l.status = 'available'));
create policy "participants update requests" on public.requests for update to authenticated using (auth.uid() in (buyer_id, seller_id));

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
  return new;
end $$;
create trigger requests_guard before update on public.requests for each row execute function public.requests_guard();

create or replace function public.requests_after() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'accepted' and old.status <> 'accepted' then
    update public.listings set status = case when new.type = 'buy' then 'sold' else 'reserved' end where id = new.item_id;
  end if;
  return new;
end $$;
create trigger requests_after after update on public.requests for each row execute function public.requests_after();

-- ---------- reviews ----------
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  reviewee_id uuid not null references public.profiles(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text check (char_length(comment) <= 500),
  created_at timestamptz not null default now(),
  unique (request_id, reviewer_id)
);
create index reviews_reviewee_idx on public.reviews(reviewee_id);
grant select on public.reviews to anon, authenticated;
grant insert on public.reviews to authenticated;
grant all on public.reviews to service_role;
alter table public.reviews enable row level security;
create policy "reviews public" on public.reviews for select using (true);
create policy "review completed deal" on public.reviews for insert to authenticated with check (
  reviewer_id = auth.uid() and exists (
    select 1 from public.requests r where r.id = request_id and r.status = 'completed'
      and ((r.buyer_id = auth.uid() and r.seller_id = reviewee_id) or (r.seller_id = auth.uid() and r.buyer_id = reviewee_id))));

-- ---------- chat ----------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.listings(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (item_id, buyer_id),
  check (buyer_id <> seller_id)
);
create index conversations_buyer_idx on public.conversations(buyer_id);
create index conversations_seller_idx on public.conversations(seller_id);
grant select, insert on public.conversations to authenticated;
grant all on public.conversations to service_role;
alter table public.conversations enable row level security;
create policy "participants read convos" on public.conversations for select to authenticated using (auth.uid() in (buyer_id, seller_id));
create policy "buyer starts convo" on public.conversations for insert to authenticated with check (
  auth.uid() = buyer_id and exists (select 1 from public.listings l where l.id = item_id and l.seller_id = conversations.seller_id));

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 2000),
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index messages_conv_idx on public.messages(conversation_id, created_at);
grant select, insert on public.messages to authenticated;
grant update (read) on public.messages to authenticated;
grant all on public.messages to service_role;
alter table public.messages enable row level security;
create policy "participants read msgs" on public.messages for select to authenticated using (
  exists (select 1 from public.conversations c where c.id = conversation_id and auth.uid() in (c.buyer_id, c.seller_id)));
create policy "participants send" on public.messages for insert to authenticated with check (
  sender_id = auth.uid() and read = false and exists (
    select 1 from public.conversations c where c.id = conversation_id and auth.uid() in (c.buyer_id, c.seller_id)));
create policy "recipient marks read" on public.messages for update to authenticated using (
  sender_id <> auth.uid() and exists (
    select 1 from public.conversations c where c.id = conversation_id and auth.uid() in (c.buyer_id, c.seller_id)));

-- realtime
do $$ begin
  begin alter publication supabase_realtime add table public.messages; exception when others then null; end;
  begin alter publication supabase_realtime add table public.requests; exception when others then null; end;
end $$;

-- ---------- storage ----------
insert into storage.buckets (id, name, public) values ('listing-images','listing-images', true) on conflict (id) do update set public = true;
insert into storage.buckets (id, name, public) values ('id-cards','id-cards', false) on conflict (id) do nothing;
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
