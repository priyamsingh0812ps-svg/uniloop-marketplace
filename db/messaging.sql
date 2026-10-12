-- UniLoop messaging hardening. Safe to re-run; never drops tables or data.
-- Run in Supabase → SQL Editor after db/schema.sql (or the earlier schema).

-- One conversation per buyer + seller + product.
create unique index if not exists conversations_item_buyer_seller_uidx
  on public.conversations(item_id, buyer_id, seller_id);
create index if not exists messages_unread_idx on public.messages(conversation_id) where not read;

-- Grants (column-limited update: only "read" can change).
grant select, insert on public.conversations to authenticated;
grant select, insert on public.messages to authenticated;
revoke update on public.messages from authenticated;
grant update (read) on public.messages to authenticated;
revoke all on public.conversations, public.messages from anon;

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

-- Conversations: participants only; buyer starts it for a real listing they don't own.
drop policy if exists "participants read convos" on public.conversations;
drop policy if exists "buyer starts convo" on public.conversations;
create policy "participants read convos" on public.conversations for select to authenticated
  using (auth.uid() in (buyer_id, seller_id));
create policy "buyer starts convo" on public.conversations for insert to authenticated with check (
  auth.uid() = buyer_id and buyer_id <> seller_id and exists (
    select 1 from public.listings l where l.id = item_id and l.seller_id = conversations.seller_id));

-- Messages: participants read and send; only the recipient can mark as read.
drop policy if exists "participants read msgs" on public.messages;
drop policy if exists "participants send" on public.messages;
drop policy if exists "recipient marks read" on public.messages;
create policy "participants read msgs" on public.messages for select to authenticated using (
  exists (select 1 from public.conversations c where c.id = conversation_id and auth.uid() in (c.buyer_id, c.seller_id)));
create policy "participants send" on public.messages for insert to authenticated with check (
  sender_id = auth.uid() and read = false and exists (
    select 1 from public.conversations c where c.id = conversation_id and auth.uid() in (c.buyer_id, c.seller_id)));
create policy "recipient marks read" on public.messages for update to authenticated
  using (sender_id <> auth.uid() and exists (
    select 1 from public.conversations c where c.id = conversation_id and auth.uid() in (c.buyer_id, c.seller_id)))
  with check (sender_id <> auth.uid());

-- Realtime: deliver inserts and read-receipt updates (RLS still applies).
alter table public.messages replica identity full;
do $$ begin
  begin alter publication supabase_realtime add table public.messages; exception when others then null; end;
end $$;
