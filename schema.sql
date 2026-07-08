-- SCS BBQ Night 2026 — Supabase schema
-- Run this in the Supabase SQL editor (Project → SQL Editor → New query)
-- Safe to re-run any time — every statement is idempotent (tables/indexes use
-- IF NOT EXISTS, and policies are dropped-then-recreated since Postgres has
-- no CREATE POLICY IF NOT EXISTS).

create extension if not exists "pgcrypto";

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  ticket_number text unique not null,
  id_no text not null,
  name text not null,
  mobile text not null default '',
  email text not null default '',
  department text not null default '',
  section text not null,
  items jsonb not null,
  total numeric(10,2) not null default 0,
  screenshot_url text,
  validated boolean not null default false,
  claimed boolean not null default false,
  created_at timestamptz not null default now()
);

-- Safe to run even if the table already existed before "department" was added.
alter table public.orders add column if not exists department text not null default '';
alter table public.orders add column if not exists mobile text not null default '';
alter table public.orders add column if not exists email text not null default '';
-- Records when an order was dispatched/claimed at the pickup counter (Admin → Dispatch).
alter table public.orders add column if not exists claimed_at timestamptz;
-- Refund tracking (Admin → Refund). refund_proof_url points at the same
-- payment-screenshots bucket, under a refunds/ prefix.
alter table public.orders add column if not exists refunded boolean not null default false;
alter table public.orders add column if not exists refund_proof_url text;
alter table public.orders add column if not exists refunded_at timestamptz;

create index if not exists orders_ticket_idx on public.orders (ticket_number);
create index if not exists orders_section_idx on public.orders (section);
create index if not exists orders_department_idx on public.orders (department);
create index if not exists orders_validated_idx on public.orders (validated);

-- Row Level Security
alter table public.orders enable row level security;

-- Anyone (the public order form) can create an order
drop policy if exists "Public can insert orders" on public.orders;
create policy "Public can insert orders"
  on public.orders for insert
  to anon
  with check (true);

-- Anyone can read orders (needed for the admin dashboard, which uses the
-- anon key with a simple client-side login screen rather than Supabase Auth).
-- For a stronger setup, move admin reads/updates behind Supabase Auth +
-- a policy that checks auth.uid() against an `admins` table instead.
drop policy if exists "Public can read orders" on public.orders;
create policy "Public can read orders"
  on public.orders for select
  to anon
  using (true);

drop policy if exists "Public can update orders" on public.orders;
create policy "Public can update orders"
  on public.orders for update
  to anon
  using (true)
  with check (true);

-- Needed for the admin dashboard's "Delete Order" button. Same caveat as
-- above: this is gated only by the client-side admin login, not real auth.
drop policy if exists "Public can delete orders" on public.orders;
create policy "Public can delete orders"
  on public.orders for delete
  to anon
  using (true);

-- Storage bucket for payment screenshots
insert into storage.buckets (id, name, public)
values ('payment-screenshots', 'payment-screenshots', true)
on conflict (id) do nothing;

drop policy if exists "Public can upload payment screenshots" on storage.objects;
create policy "Public can upload payment screenshots"
  on storage.objects for insert
  to anon
  with check (bucket_id = 'payment-screenshots');

drop policy if exists "Public can view payment screenshots" on storage.objects;
create policy "Public can view payment screenshots"
  on storage.objects for select
  to anon
  using (bucket_id = 'payment-screenshots');

drop policy if exists "Public can delete payment screenshots" on storage.objects;
create policy "Public can delete payment screenshots"
  on storage.objects for delete
  to anon
  using (bucket_id = 'payment-screenshots');

-- Simple key/value settings store. Currently holds one row:
-- key = 'ordering_open', value = true/false (jsonb boolean) — toggled from
-- Admin → "Close/Open Ordering" to lock the public order form.
create table if not exists public.settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.settings (key, value)
values ('ordering_open', 'true'::jsonb)
on conflict (key) do nothing;

alter table public.settings enable row level security;

drop policy if exists "Public can read settings" on public.settings;
create policy "Public can read settings"
  on public.settings for select
  to anon
  using (true);

-- Same caveat as the orders table above: gated only by the client-side
-- admin login, not real Supabase Auth.
drop policy if exists "Public can upsert settings" on public.settings;
create policy "Public can upsert settings"
  on public.settings for insert
  to anon
  with check (true);

drop policy if exists "Public can update settings" on public.settings;
create policy "Public can update settings"
  on public.settings for update
  to anon
  using (true)
  with check (true);

-- Lets the order form see "Ordering closed" the instant an admin toggles it,
-- without needing a page refresh. Safe to re-run; Postgres just errors
-- quietly if the table's already in the publication, which we ignore.
do $$
begin
  alter publication supabase_realtime add table public.settings;
exception
  when duplicate_object then null;
end $$;
