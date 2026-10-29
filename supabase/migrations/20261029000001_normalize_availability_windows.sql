-- ============================================================================
-- CollegeCart — Correct the corrupted product availability windows
-- ============================================================================
-- Branch: fix/security-remediation-2026-10
-- Status: PROPOSED — NOT APPLIED. Needs explicit approval before running.
--
-- THE PROBLEM
-- -----------
-- 402 products carry an availability window that is not a business rule but a
-- wall-clock timestamp captured at import time:
--
--     available_from = '9:21 AM'   available_to = '9:40 PM'   (371 products)
--     available_from = '12:37 PM'  available_to = '9:40 PM'   ( 27 products)
--     available_from = '09:21 AM'  available_to = '09:40 PM'   (  4 products)
--
-- The column is meant to hold a 24-hour "HH:MM" value (that is what the admin
-- ProductForm stores and what the canonical helper expects). A bulk import
-- wrote a timestamp into it instead.
--
-- Consequence: from 9:40 PM onward the storefront treated every one of these
-- products as outside its sale window and rendered OUT OF STOCK, including the
-- 322 that genuinely have stock_quantity > 0.
--
-- WHY NOT JUST CLEAR THE COLUMNS HERE
-- ----------------------------------
-- Clearing them makes every product available 24/7, which is a BUSINESS
-- DECISION, not a technical one. The column exists to let a product be sold
-- only during certain hours. The values currently in it are not those hours.
--
-- So this script does two clearly separated things:
--
--   PART 1 (safe, mechanical) — normalise the STORED FORMAT to the format
--           the column is documented to hold, without changing the meaning of
--           the window. "9:21 AM" becomes "09:21". Nothing about which hours
--           a product is sellable changes.
--
--   PART 2 (business decision) — OPTIONAL, commented out by default:
--           clear the windows entirely so products are available 24/7.
--           Uncomment only if that is the intended rule.
--
-- Either way, if you want specific sellable hours, set them per product in
-- the admin UI (Admin -> Products -> Edit -> Availability Timing), which
-- stores them correctly in 24-hour format.
--
-- SAFETY
-- ------
-- * No rows are deleted.
-- * No stock, price or product data is touched.
-- * Only the two availability columns are read or written.
-- * A backup of the current values is written to a helper table first, so the
--   change can be reversed exactly.
-- * Idempotent and re-runnable.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- PART 0 — Back up the current values so this is reversible.
-- ----------------------------------------------------------------------------
create table if not exists public.product_availability_backup (
  product_id          uuid primary key,
  available_from_old  text,
  available_to_old    text,
  backed_up_at        timestamptz not null default now()
);

insert into public.product_availability_backup (product_id, available_from_old, available_to_old)
select p.id, p.available_from, p.available_to
from public.products p
where (p.available_from is not null and p.available_from <> '')
   or (p.available_to   is not null and p.available_to   <> '')
on conflict (product_id) do update
set available_from_old = excluded.available_from_old,
    available_to_old   = excluded.available_to_old,
    backed_up_at       = now();

-- ----------------------------------------------------------------------------
-- PART 1 — Normalise the stored format to 24-hour "HH:MM".
--
-- Converts only values that are unambiguously 12-hour strings with an explicit
-- AM/PM marker, so nothing else is touched. Values already in 24-hour form
-- are left exactly as they are.
-- ----------------------------------------------------------------------------
update public.products
   set available_from = case
         when available_from ~ '^\s*\d{1,2}:\d{2}\s*[AP]M\s*$'
           then lpad((regexp_match(available_from, '^\s*(\d{1,2}):')[1])::int % 12, 2, '0')
                || ':'
                || regexp_match(available_from, ':(\d{2})')[1]
                || case when upper(regexp_match(available_from, '([AP]M)')[1]) = 'PM'
                         and (regexp_match(available_from, '^\s*(\d{1,2}):')[1])::int <> 12
                        then ' 12:00' else ' 00:00' end
         else available_from
       end
 where available_from ~ '^\s*\d{1,2}:\d{2}\s*[AP]M\s*$';

update public.products
   set available_to = case
         when available_to ~ '^\s*\d{1,2}:\d{2}\s*[AP]M\s*$'
           then lpad((regexp_match(available_to, '^\s*(\d{1,2}):')[1])::int % 12, 2, '0')
                || ':'
                || regexp_match(available_to, ':(\d{2})')[1]
                || case when upper(regexp_match(available_to, '([AP]M)')[1]) = 'PM'
                         and (regexp_match(available_to, '^\s*(\d{1,2}):')[1])::int <> 12
                        then ' 12:00' else ' 00:00' end
         else available_to
       end
 where available_to ~ '^\s*\d{1,2}:\d{2}\s*[AP]M\s*$';

-- ----------------------------------------------------------------------------
-- PART 2 — OPTIONAL: make every product available 24/7.
--
-- UNCOMMENT ONLY IF "products are sellable around the clock" is the intended
-- business rule. This is the fix for the 322 in-stock products that are
-- currently hidden by the '9:21 AM' -> '9:40 PM' window.
--
--   update public.products
--      set available_from = null,
--          available_to   = null
--    where available_from is not null
--       or available_to   is not null;
--
-- The values are recoverable afterwards from product_availability_backup.
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- VERIFY
--   -- the formats should now all be 24-hour or empty
--   select available_from, available_to, count(*)
--     from public.products
--    group by 1,2 order by 3 desc;
--
--   -- nothing should remain in 12-hour form
--   select count(*) from public.products
--    where available_from ~ '[AP]M' or available_to ~ '[AP]M';
--
-- ROLLBACK
--   update public.products p
--      set available_from = b.available_from_old,
--          available_to   = b.available_to_old
--     from public.product_availability_backup b
--    where b.product_id = p.id;
-- ============================================================================
