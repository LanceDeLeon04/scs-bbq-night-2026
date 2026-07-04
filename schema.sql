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
