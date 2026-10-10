-- Run this ONLY if you already ran uniloop_schema.sql before (keeps your data).
-- Switches to the 7 new categories, adds subcategories, meal plans and free-text colleges.
alter table public.listings alter column category type text using category::text;
alter table public.listings alter column mode type text using mode::text;
alter table public.requests alter column type type text using type::text;
drop type if exists public.listing_category;
drop type if exists public.listing_mode;
alter table public.listings add column if not exists subcategory text check (char_length(subcategory) <= 60);
update public.listings set subcategory = initcap(category), category = 'study' where category in ('books','calculators');
update public.listings set category = 'hostel', subcategory = 'Furniture' where category = 'furniture';
update public.listings set category = 'vehicles', subcategory = 'Other Vehicles' where category = 'cycles';
update public.listings set category = 'gadgets' where category = 'gadgets';
update public.listings set category = 'study', subcategory = 'Engineering Tools' where category = 'other';
alter table public.listings add constraint listings_category_chk check (category in ('study','hostel','sports','vehicles','gadgets','food','accommodation'));
alter table public.listings add constraint listings_mode_chk check (mode in ('buy','rent','exchange','meal'));
alter table public.listings add constraint listings_food_chk check ((category = 'food') = (mode = 'meal'));
alter table public.listings add constraint listings_accom_chk check (category <> 'accommodation' or mode = 'rent');
alter table public.requests add constraint requests_type_chk check (type in ('buy','rent','exchange','meal'));
