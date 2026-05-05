-- ============================================================
-- Fix: Infinite recursion in RLS policies
-- Run this in Supabase SQL Editor
-- ============================================================

-- Step 1: Create a security-definer function to check admin role
-- This bypasses RLS when checking the role, breaking the recursion
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

-- Step 2: Drop the recursive policy on users
drop policy if exists "Admins can read all users" on public.users;

-- Step 3: Re-create it using the helper function (no recursion)
create policy "Admins can read all users" on public.users
  for select using (public.is_admin());

-- Step 4: Fix all other tables that have the same recursive pattern
-- (they query public.users inside a policy on another table — that's fine,
--  but let's replace them with the helper for consistency and performance)

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
