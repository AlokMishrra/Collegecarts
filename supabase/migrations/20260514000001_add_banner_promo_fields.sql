-- Banner promo fields for new swipeable promo cards (Rich & Creamy style)
-- Run this once in Supabase Dashboard → SQL Editor
alter table public.banners add column if not exists background_color text default '#c4b5fd';
alter table public.banners add column if not exists text_color text default '#111827';
alter table public.banners add column if not exists description text;
alter table public.banners add column if not exists cta_text text default 'SHOP NOW';
alter table public.banners add column if not exists link_type text default 'internal';
alter table public.banners add column if not exists link_target text;
alter table public.banners add column if not exists badge_text text;

-- Backfill: copy existing link_url into link_target where new column is empty
update public.banners set link_target = link_url where link_target is null and link_url is not null;
update public.banners set description = subtitle where description is null and subtitle is not null;

-- Refresh PostgREST schema cache (optional, auto-refreshes in ~30s)
notify pgrst, 'reload schema';
