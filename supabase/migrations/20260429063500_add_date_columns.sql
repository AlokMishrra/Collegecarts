-- Migration: Add created_date and updated_date columns to match CSV import
-- These are aliases for created_at and updated_at from Base44

alter table public.products
  add column if not exists created_date timestamptz,
  add column if not exists updated_date timestamptz;

-- Create triggers to keep them in sync with created_at/updated_at
create or replace function sync_product_dates()
returns trigger as $$
begin
  -- When created_at changes, update created_date
  if NEW.created_at is distinct from OLD.created_at then
    NEW.created_date := NEW.created_at;
  end if;
  
  -- When updated_at changes, update updated_date
  if NEW.updated_at is distinct from OLD.updated_at then
    NEW.updated_date := NEW.updated_at;
  end if;
  
  -- When created_date changes, update created_at
  if NEW.created_date is distinct from OLD.created_date then
    NEW.created_at := NEW.created_date;
  end if;
  
  -- When updated_date changes, update updated_at
  if NEW.updated_date is distinct from OLD.updated_date then
    NEW.updated_at := NEW.updated_date;
  end if;
  
  return NEW;
end;
$$ language plpgsql;

-- Drop trigger if exists
drop trigger if exists sync_product_dates_trigger on public.products;

-- Create trigger
create trigger sync_product_dates_trigger
  before insert or update on public.products
  for each row
  execute function sync_product_dates();
