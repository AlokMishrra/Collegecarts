-- ============================================================
-- CollegeCart — Complete Fix Migration
-- Run this in Supabase SQL Editor to fix ALL issues at once
-- ============================================================

-- 1. Fix is_admin() helper (prevents RLS infinite recursion)
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and role = 'admin'
  );
$$;

-- 2. Fix users table — add missing columns, make email optional
alter table public.users add column if not exists phone text;
alter table public.users add column if not exists loyalty_points integer default 0;
alter table public.users add column if not exists profile_photo text;
alter table public.users add column if not exists saved_addresses jsonb default '[]';
alter table public.users alter column email drop not null;

-- Add unique constraint on phone if not exists
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'users_phone_key'
  ) then
    alter table public.users add constraint users_phone_key unique (phone);
  end if;
end $$;

-- 3. Fix RLS policies — drop recursive ones, replace with is_admin()
drop policy if exists "Admins can read all users" on public.users;
create policy "Admins can read all users" on public.users
  for select using (public.is_admin());

drop policy if exists "Admins can manage categories" on public.categories;
create policy "Admins can manage categories" on public.categories
  for all using (public.is_admin());

drop policy if exists "Admins can manage products" on public.products;
create policy "Admins can manage products" on public.products
  for all using (public.is_admin());

drop policy if exists "Admins can manage combos" on public.combos;
create policy "Admins can manage combos" on public.combos
  for all using (public.is_admin());

drop policy if exists "Admins can manage all orders" on public.orders;
create policy "Admins can manage all orders" on public.orders
  for all using (public.is_admin());

drop policy if exists "Admins can manage delivery persons" on public.delivery_persons;
create policy "Admins can manage delivery persons" on public.delivery_persons
  for all using (public.is_admin());

drop policy if exists "Admins can manage campaigns" on public.campaigns;
create policy "Admins can manage campaigns" on public.campaigns
  for all using (public.is_admin());

drop policy if exists "Admins can manage subscriptions" on public.subscriptions;
create policy "Admins can manage subscriptions" on public.subscriptions
  for all using (public.is_admin());

drop policy if exists "Admins can manage refunds" on public.refunds;
create policy "Admins can manage refunds" on public.refunds
  for all using (public.is_admin());

drop policy if exists "Admins can manage roles" on public.roles;
create policy "Admins can manage roles" on public.roles
  for all using (public.is_admin());

drop policy if exists "Admins can manage banners" on public.banners;
create policy "Admins can manage banners" on public.banners
  for all using (public.is_admin());

drop policy if exists "Admins can manage reviews" on public.reviews;
create policy "Admins can manage reviews" on public.reviews
  for all using (public.is_admin());

drop policy if exists "Admins can manage settings" on public.settings;
create policy "Admins can manage settings" on public.settings
  for all using (public.is_admin());

drop policy if exists "Admins can manage articles" on public.knowledge_articles;
create policy "Admins can manage articles" on public.knowledge_articles
  for all using (public.is_admin());

drop policy if exists "Admins can read activity log" on public.admin_activity_log;
create policy "Admins can read activity log" on public.admin_activity_log
  for select using (public.is_admin());

drop policy if exists "Admins can manage shifts" on public.shifts;
create policy "Admins can manage shifts" on public.shifts
  for all using (public.is_admin());

-- 4. Create withdrawal_requests table
create table if not exists public.withdrawal_requests (
  id uuid primary key default uuid_generate_v4(),
  delivery_person_id uuid references public.delivery_persons(id) on delete cascade,
  delivery_person_name text,
  amount numeric not null,
  upi_id text,
  transaction_id text,
  type text default 'withdrawal',
  status text default 'pending',
  notes text,
  admin_notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.withdrawal_requests enable row level security;
drop policy if exists "Anyone can read withdrawal requests" on public.withdrawal_requests;
create policy "Anyone can read withdrawal requests" on public.withdrawal_requests for select using (true);
drop policy if exists "Anyone can create withdrawal requests" on public.withdrawal_requests;
create policy "Anyone can create withdrawal requests" on public.withdrawal_requests for insert with check (true);
drop policy if exists "Admins can manage withdrawal requests" on public.withdrawal_requests;
create policy "Admins can manage withdrawal requests" on public.withdrawal_requests for all using (public.is_admin());
drop policy if exists "Anyone can update withdrawal requests" on public.withdrawal_requests;
create policy "Anyone can update withdrawal requests" on public.withdrawal_requests for update using (true);

-- 5. Create hostels table
create table if not exists public.hostels (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  code text,
  block text,
  address text,
  contact_person text,
  contact_phone text,
  total_rooms integer default 0,
  assigned_delivery_persons text[] default '{}',
  delivery_radius_km numeric default 2,
  coordinates jsonb default '{"latitude": 0, "longitude": 0}',
  is_active boolean default true,
  display_order integer default 0,
  created_at timestamptz default now()
);
alter table public.hostels enable row level security;
drop policy if exists "Anyone can read hostels" on public.hostels;
create policy "Anyone can read hostels" on public.hostels for select using (true);
drop policy if exists "Admins can manage hostels" on public.hostels;
create policy "Admins can manage hostels" on public.hostels for all using (public.is_admin());

-- 6. Create delivery_queries table
create table if not exists public.delivery_queries (
  id uuid primary key default uuid_generate_v4(),
  delivery_person_id uuid references public.delivery_persons(id) on delete cascade,
  delivery_person_name text,
  subject text not null,
  message text not null,
  status text default 'open',
  admin_reply text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.delivery_queries enable row level security;
drop policy if exists "Anyone can read delivery queries" on public.delivery_queries;
create policy "Anyone can read delivery queries" on public.delivery_queries for select using (true);
drop policy if exists "Anyone can create delivery queries" on public.delivery_queries;
create policy "Anyone can create delivery queries" on public.delivery_queries for insert with check (true);
drop policy if exists "Admins can manage delivery queries" on public.delivery_queries;
create policy "Admins can manage delivery queries" on public.delivery_queries for all using (public.is_admin());
drop policy if exists "Anyone can update delivery queries" on public.delivery_queries;
create policy "Anyone can update delivery queries" on public.delivery_queries for update using (true);

-- 7. Create wishlists table
create table if not exists public.wishlists (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.users(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade,
  created_at timestamptz default now(),
  unique(user_id, product_id)
);
alter table public.wishlists enable row level security;
drop policy if exists "Users can manage own wishlist" on public.wishlists;
create policy "Users can manage own wishlist" on public.wishlists for all using (auth.uid() = user_id);

-- 8. Enable realtime for new tables
do $$
begin
  begin
    alter publication supabase_realtime add table public.withdrawal_requests;
  exception when others then null;
  end;
end $$;

-- 9. Insert default settings if not exists
insert into public.settings (shipping_charge, free_delivery_above, first_order_threshold, store_name, is_online)
values (30, 500, 100, 'CollegeCart', true)
on conflict do nothing;
