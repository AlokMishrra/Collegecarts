-- Fix RLS: ensure products and categories are publicly readable
-- The anon key must be able to read these for the shop to work

-- ── Products ─────────────────────────────────────────────────────────────────
drop policy if exists "Anyone can read available products" on public.products;
create policy "Anyone can read available products"
  on public.products for select
  using (true);   -- all rows readable; app-level filtering handles is_available

-- ── Categories ───────────────────────────────────────────────────────────────
drop policy if exists "Anyone can read categories" on public.categories;
create policy "Anyone can read categories"
  on public.categories for select
  using (true);

-- ── Combos ───────────────────────────────────────────────────────────────────
drop policy if exists "Anyone can read combos" on public.combos;
create policy "Anyone can read combos"
  on public.combos for select
  using (true);

-- ── Banners ──────────────────────────────────────────────────────────────────
drop policy if exists "Anyone can read banners" on public.banners;
create policy "Anyone can read banners"
  on public.banners for select
  using (true);

-- ── Settings ─────────────────────────────────────────────────────────────────
drop policy if exists "Anyone can read settings" on public.settings;
create policy "Anyone can read settings"
  on public.settings for select
  using (true);

-- ── Hostels ──────────────────────────────────────────────────────────────────
drop policy if exists "Anyone can read hostels" on public.hostels;
create policy "Anyone can read hostels"
  on public.hostels for select
  using (true);

-- ── Reviews (approved) ───────────────────────────────────────────────────────
drop policy if exists "Anyone can read approved reviews" on public.reviews;
create policy "Anyone can read approved reviews"
  on public.reviews for select
  using (true);
