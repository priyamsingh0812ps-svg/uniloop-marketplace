-- UniLoop schema: run once in your Supabase project's SQL Editor.
create type public.listing_mode as enum ('buy','rent','exchange');
create type public.listing_category as enum ('books','calculators','cycles','furniture','gadgets','other');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  avatar_url text,
  campus text not null default '',
  college_email text,
  is_verified boolean not null default false,
  bio text,
  created_at timestamptz not null default now()
);
grant select on public.profiles to anon, authenticated;
grant insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "profiles readable" on public.profiles for select using (true);
create policy "own profile insert" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "own profile update" on public.profiles for update to authenticated using (auth.uid() = id);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, college_email, campus, is_verified)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''), new.email,
          coalesce(new.raw_user_meta_data->>'campus',''),
          new.email ~* '\.(edu|ac\.in|edu\.in)$');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid references public.profiles(id) on delete cascade,
  title text not null,
  description text not null default '',
  category public.listing_category not null,
  mode public.listing_mode not null,
  price numeric(10,2) not null default 0,
  rent_period text,
  condition text not null default 'Good',
  campus text not null,
  image_url text,
  seller_name text,
  seller_rating numeric(2,1),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index listings_campus_idx on public.listings(campus);
create index listings_category_idx on public.listings(category);
create index listings_mode_idx on public.listings(mode);
create index listings_created_idx on public.listings(created_at desc);
grant select on public.listings to anon, authenticated;
grant insert, update, delete on public.listings to authenticated;
grant all on public.listings to service_role;
alter table public.listings enable row level security;
create policy "active listings public" on public.listings for select using (is_active or auth.uid() = seller_id);
create policy "seller insert" on public.listings for insert to authenticated with check (auth.uid() = seller_id);
create policy "seller update" on public.listings for update to authenticated using (auth.uid() = seller_id);
create policy "seller delete" on public.listings for delete to authenticated using (auth.uid() = seller_id);

create table public.wishlist (
  user_id uuid references public.profiles(id) on delete cascade,
  listing_id uuid references public.listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);
grant select, insert, delete on public.wishlist to authenticated;
grant all on public.wishlist to service_role;
alter table public.wishlist enable row level security;
create policy "own wishlist" on public.wishlist for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references public.listings(id) on delete cascade,
  buyer_id uuid references public.profiles(id) on delete cascade,
  seller_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (listing_id, buyer_id)
);
create index conversations_buyer_idx on public.conversations(buyer_id);
create index conversations_seller_idx on public.conversations(seller_id);
grant select, insert on public.conversations to authenticated;
grant all on public.conversations to service_role;
alter table public.conversations enable row level security;
create policy "participants read" on public.conversations for select to authenticated using (auth.uid() in (buyer_id, seller_id));
create policy "buyer starts" on public.conversations for insert to authenticated with check (auth.uid() = buyer_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversations(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
create index messages_conv_idx on public.messages(conversation_id, created_at);
grant select, insert on public.messages to authenticated;
grant all on public.messages to service_role;
alter table public.messages enable row level security;
create policy "participants read msgs" on public.messages for select to authenticated using (
  exists (select 1 from public.conversations c where c.id = conversation_id and auth.uid() in (c.buyer_id, c.seller_id)));
create policy "participants send" on public.messages for insert to authenticated with check (
  sender_id = auth.uid() and exists (select 1 from public.conversations c where c.id = conversation_id and auth.uid() in (c.buyer_id, c.seller_id)));

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  reviewer_id uuid references public.profiles(id) on delete cascade,
  reviewee_id uuid references public.profiles(id) on delete cascade,
  listing_id uuid references public.listings(id) on delete set null,
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (reviewer_id, listing_id)
);
create index reviews_reviewee_idx on public.reviews(reviewee_id);
grant select on public.reviews to anon, authenticated;
grant insert on public.reviews to authenticated;
grant all on public.reviews to service_role;
alter table public.reviews enable row level security;
create policy "reviews public" on public.reviews for select using (true);
create policy "write own review" on public.reviews for insert to authenticated with check (auth.uid() = reviewer_id and reviewer_id <> reviewee_id);

insert into storage.buckets (id, name, public) values ('listing-images','listing-images', true) on conflict do nothing;
create policy "listing images public" on storage.objects for select using (bucket_id = 'listing-images');
create policy "upload own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'listing-images' and (storage.foldername(name))[1] = auth.uid()::text);

insert into public.listings (title, description, category, mode, price, rent_period, condition, campus, image_url, seller_name, seller_rating) values
('HC Verma Concepts of Physics (Vol 1 & 2)','Both volumes, light pencil marks, no torn pages. Perfect for first-years.','books','buy',450,null,'Good','IIT Delhi','https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=800','Aarav Mehta',4.8),
('Casio fx-991EX Classwiz','Barely used scientific calculator, with cover. Exam-approved.','calculators','buy',900,null,'Like new','BITS Pilani','https://images.unsplash.com/photo-1564939558297-fc396f18e5c7?w=800','Sneha Iyer',4.9),
('Hero Sprint 21-speed cycle','Serviced last month, new brakes. Great for campus rides.','cycles','rent',300,'month','Good','IIT Delhi','https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=800','Rohan Gupta',4.6),
('Foldable study table','Wooden top, steel legs. Fits any hostel room.','furniture','buy',1200,null,'Good','VIT Vellore','https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=800','Priya Nair',4.7),
('JBL Tune 510BT headphones','Swap for a mechanical keyboard or similar gadget.','gadgets','exchange',0,null,'Like new','BITS Pilani','https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800','Kabir Singh',4.5),
('Engineering drawing kit + drafter','Complete Omega drafter set with mini-drafter and sheet holder.','other','rent',150,'semester','Fair','NIT Trichy','https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=800','Ananya Rao',4.4),
('Cormen – Introduction to Algorithms','3rd edition, hardcover. Some highlights in chapters 1-10.','books','exchange',0,null,'Good','NIT Trichy','https://images.unsplash.com/photo-1532012197267-da84d127e765?w=800','Vikram Joshi',4.9),
('Mini fridge 50L','Works perfectly. Pickup from Hostel 4.','furniture','rent',500,'month','Good','VIT Vellore','https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?w=800','Meera Pillai',4.3),
('iPad 9th Gen 64GB + Pencil','For notes and reading. Battery health 92%.','gadgets','buy',18500,null,'Like new','IIT Delhi','https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=800','Ishaan Kapoor',5.0);
