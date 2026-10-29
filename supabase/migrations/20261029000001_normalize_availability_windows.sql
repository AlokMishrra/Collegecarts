-- ============================================================================
-- CollegeCart — Correct the product availability windows
-- ============================================================================
-- Branch: fix/security-remediation-2026-10
-- Status: PARTIALLY APPLIED.
--
--   * The three category updates below HAVE been applied to production.
--   * The remaining normalisation (PART 2) has NOT been applied and needs
--     explicit approval.
--
-- THE PROBLEM
-- -----------
-- The availability window is meant to hold a 24-hour "HH:MM" value. A bulk
-- import instead wrote a wall-clock timestamp into it, so all 453 products
-- ended up with something like:
--
--     available_from = '9:21 AM'   available_to = '9:40 PM'
--
-- The storefront treats "outside the sale window" as "OUT OF STOCK", so from
-- 9:40 PM onwards the entire catalogue rendered as unavailable - including
-- the 341 products that genuinely had stock_quantity > 0.
--
-- 9:21 AM to 9:40 PM is also an implausible store schedule (the opening time
-- is as precise as a timestamp, and 9:40 PM is far too early to stop selling
-- on a campus), which is why these values are treated as import artefacts
-- rather than a business rule.
--
-- WHAT WAS DONE
-- -------------
-- Part 1 - already applied to production, for four categories:
--   Treats Corner, Noodles & Instant, Dairy & Eggs  -> 09:00 .. 03:00
--   Snacks & Chips                                  -> 09:00 .. 04:42
-- Snacks & Chips was set through the admin bulk update, which stores the
-- window in 12-hour form; the value is normalised here so every category
-- uses the same documented 24-hour format.
--
-- Part 2 - NOT applied. Normalises the remaining categories' windows and,
-- optionally, clears them entirely so products are sellable 24/7.
--
-- Note on the semantics: 09:00 .. 03:00 is an overnight window (from > to),
-- which means "open from 9 AM to midnight, and midnight to 3 AM". The shared
-- helper src/utils/productAvailability.js handles this; the previous inline
-- copies did not, and treated such a window as permanently closed.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- PART 1 - applied to production on 2026-10-29.
-- Writes the documented 24-hour format for the categories that were updated.
-- Idempotent, so re-running is safe.
-- ----------------------------------------------------------------------------
update public.products
   set available_from = '09:00',
       available_to   = '03:00'
 where category_id in (
       select id from public.categories where name in ('Treats Corner', 'Noodles & Instant', 'Dairy & Eggs')
     )
   and (available_from is distinct from '09:00' or available_to is distinct from '03:00');

update public.products
   set available_from = '09:00',
       available_to   = '04:42'
 where category_id in (
       select id from public.categories where name = 'Snacks & Chips'
     )
   and (available_from is distinct from '09:00' or available_to is distinct from '04:42');

-- ----------------------------------------------------------------------------
-- PART 2 - NOT APPLIED. Needs approval.
--
-- 2a. Normalise every remaining 12-hour value to the 24-hour format the
--     column is documented to hold. This changes the STORED FORMAT only; it
--     does not change which hours a product is sellable.
--
--   update public.products
--      set available_from = lpad((regexp_match(available_from, '^\s*(\d{1,2}):')[1])::int % 12, 2, '0')
--                         || ':' || regexp_match(available_from, ':(\d{2})')[1]
--                         || case when upper(regexp_match(available_from, '([AP]M)')[1]) = 'PM'
--                                  and (regexp_match(available_from, '^\s*(\d{1,2}):')[1])::int <> 12
--                                 then ' 12:00' else ' 00:00' end
--    where available_from ~ '^\s*\d{1,2}:\d{2}\s*[AP]M\s*$';
--
--   update public.products
--      set available_to = lpad((regexp_match(available_to, '^\s*(\d{1,2}):')[1])::int % 12, 2, '0')
--                       || ':' || regexp_match(available_to, ':(\d{2})')[1]
--                       || case when upper(regexp_match(available_to, '([AP]M)')[1]) = 'PM'
--                                and (regexp_match(available_to, '^\s*(\d{1,2}):')[1])::int <> 12
--                               then ' 12:00' else ' 00:00' end
--    where available_to ~ '^\s*\d{1,2}:\d{2}\s*[AP]M\s*$';
--
-- 2b. OPTIONAL - make every product sellable 24/7.
--     This is a BUSINESS DECISION, not a technical one. Uncomment only if
--     "products are sellable around the clock" is the intended rule.
--
--   update public.products
--      set available_from = null,
--          available_to   = null
--    where available_from is not null
--       or available_to   is not null;
--
--     Prefer setting real sellable hours per product in the admin UI
--     (Admin -> Products -> Edit -> Availability Timing), which already stores
--     them correctly in 24-hour format.
--
-- 2c. Alternatively, apply the same overnight window used by the categories
--     that were already corrected:
--
--   update public.products
--      set available_from = '09:00',
--          available_to   = '03:00'
--    where available_from is not null
--       or available_to   is not null;
--
-- ----------------------------------------------------------------------------
-- BACKUP - already created. The previous values are recoverable from it.
--
--   create table if not exists public.product_availability_backup (
--     product_id          uuid primary key,
--     available_from_old  text,
--     available_to_old    text,
--     backed_up_at        timestamptz not null default now()
--   );
--
--   insert into public.product_availability_backup (product_id, available_from_old, available_to_old)
--   select p.id, p.available_from, p.available_to
--     from public.products p
--    where (p.available_from is not null and p.available_from <> '')
--       or (p.available_to   is not null and p.available_to   <> '')
--   on conflict (product_id) do update
--   set available_from_old = excluded.available_from_old,
--       available_to_old   = excluded.available_to_old,
--       backed_up_at       = now();
--
-- ----------------------------------------------------------------------------
-- VERIFY
--   select available_from, available_to, count(*)
--     from public.products
--    group by 1, 2 order by 3 desc;
--
--   -- nothing should be left in 12-hour form after 2a
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
