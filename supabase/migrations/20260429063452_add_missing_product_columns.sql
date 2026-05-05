-- Migration: Add missing product columns to match Base44 CSV export
-- Adds all columns present in the CSV that were missing from the original schema

alter table public.products
  add column if not exists original_price numeric,
  add column if not exists source_dhaba text,
  add column if not exists has_variations boolean default false,
  add column if not exists variations jsonb default '[]',
  add column if not exists tags jsonb default '[]',
  add column if not exists unit text default 'piece',
  add column if not exists low_stock_threshold integer default 10,
  add column if not exists profit_margin numeric default 0,
  add column if not exists delivery_time text,
  add column if not exists scheduled_available_date text,
  add column if not exists scheduled_unavailable_date text,
  add column if not exists is_sample boolean default false,
  add column if not exists created_by_id text,
  add column if not exists created_by text;
