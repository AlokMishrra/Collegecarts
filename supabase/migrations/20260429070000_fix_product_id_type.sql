-- Migration: Change products.id and category_id from uuid to text
-- Base44 uses 24-char hex IDs (e.g. "69ef880f0c671d4908b9db97") which are NOT valid UUIDs

-- ── Step 1: Drop ALL foreign keys that reference products ────────────────────
alter table public.cart_items   drop constraint if exists cart_items_product_id_fkey;
alter table public.reviews      drop constraint if exists reviews_product_id_fkey;
alter table public.wishlists    drop constraint if exists wishlists_product_id_fkey;

-- Drop the FK from products.category_id → categories.id
alter table public.products     drop constraint if exists products_category_id_fkey;

-- ── Step 2: Drop primary key on products ─────────────────────────────────────
alter table public.products drop constraint if exists products_pkey;

-- ── Step 3: Change products.id → text ────────────────────────────────────────
alter table public.products alter column id drop default;
alter table public.products alter column id type text using id::text;
alter table public.products alter column id set default gen_random_uuid()::text;
alter table public.products add primary key (id);

-- ── Step 4: Change products.category_id → text (no FK, Base44 hex IDs) ───────
alter table public.products alter column category_id type text using category_id::text;

-- ── Step 5: Change cart_items.product_id → text, re-add FK ──────────────────
alter table public.cart_items alter column product_id type text using product_id::text;
alter table public.cart_items
  add constraint cart_items_product_id_fkey
  foreign key (product_id) references public.products(id) on delete cascade;

-- ── Step 6: Change reviews.product_id → text, re-add FK ─────────────────────
alter table public.reviews alter column product_id type text using product_id::text;
alter table public.reviews
  add constraint reviews_product_id_fkey
  foreign key (product_id) references public.products(id);

-- ── Step 7: Change wishlists.product_id → text, re-add FK ───────────────────
alter table public.wishlists alter column product_id type text using product_id::text;
alter table public.wishlists
  add constraint wishlists_product_id_fkey
  foreign key (product_id) references public.products(id) on delete cascade;
