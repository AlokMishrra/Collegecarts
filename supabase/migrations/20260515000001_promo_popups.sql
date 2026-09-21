-- Promo Popups for CollegeCart — mobile-only, admin-managed
-- Run this in Supabase Dashboard → SQL Editor
-- Mirrors Swiggy One popup (LIMITED TIME ONLY badge, FREE DELIVERIES WITH one, price, image, CTA)

create table if not exists public.promo_popups (
  id uuid primary key default gen_random_uuid(),
  badge_text text default 'LIMITED TIME ONLY',
  title_small text default 'FREE DELIVERIES WITH',
  title_highlight text default 'One',
  title text not null default 'At just ₹30 for 3+3 months',
  subtitle text default 'on both Shop & Meals.',
  image_url text,
  cta_text text default 'Renew Now',
  cta_link_type text default 'internal' check (cta_link_type in ('internal','category','product','external','none')),
  cta_link_target text,
  background_color text default '#FFFBF5',
  is_active boolean default true,
  display_order int default 0,
  -- show once per session if true, else every page load
  once_per_session boolean default true,
  -- optional scheduling
  start_date timestamptz,
  end_date timestamptz,
  -- analytics
  view_count int default 0,
  click_count int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS: allow anon to read active popups, only authenticated can write (admin via RLS bypass with service role, or restrict to admin role)
alter table public.promo_popups enable row level security;

drop policy if exists "Anyone can read active popups" on public.promo_popups;
create policy "Anyone can read active popups"
  on public.promo_popups for select
  using (true);

drop policy if exists "Authenticated can manage popups" on public.promo_popups;
create policy "Authenticated can manage popups"
  on public.promo_popups for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Index for active lookup
create index if not exists idx_promo_popups_active_order on public.promo_popups (is_active, display_order, created_at desc);

-- updated_at trigger
create or replace function public.handle_promo_popup_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists promo_popups_updated_at on public.promo_popups;
create trigger promo_popups_updated_at
  before update on public.promo_popups
  for each row execute function public.handle_promo_popup_updated_at();

-- Insert default CollegeCart promo (green theme)
insert into public.promo_popups (badge_text, title_small, title_highlight, title, subtitle, cta_text, background_color, cta_link_type, is_active, display_order, once_per_session)
values (
  'LIMITED TIME ONLY',
  'FREE DELIVERIES WITH',
  'One',
  'At just ₹49 for 3+3 months',
  'on both Shop & Meals.',
  'Claim Now',
  '#FFFBF5',
  'internal',
  true,
  0,
  true
) on conflict do nothing;

notify pgrst, 'reload schema';
