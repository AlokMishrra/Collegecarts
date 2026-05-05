-- Migration: Change categories.id from uuid to text
-- Base44 category IDs are 24-char hex strings, not valid UUIDs

-- Drop FK from products.category_id first (already text, but drop any remaining constraint)
alter table public.products drop constraint if exists products_category_id_fkey;

-- Drop primary key on categories
alter table public.categories drop constraint if exists categories_pkey;

-- Change categories.id to text
alter table public.categories alter column id drop default;
alter table public.categories alter column id type text using id::text;
alter table public.categories alter column id set default gen_random_uuid()::text;
alter table public.categories add primary key (id);
