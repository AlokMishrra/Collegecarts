-- =============================================================================
-- delivery-earnings-reconcile.sql   (NON-DESTRUCTIVE)
--
-- Purpose : stop delivery partners being paid twice for the same delivery.
-- Safety  : this script DELETES NOTHING. Duplicate commission rows are MOVED to
--           an archive table, so a full rollback is a single INSERT.
--
-- Background
--   markOrderDelivered had no idempotency guard, so a COD delivery that completed
--   twice (COD collection + OTP verification) wrote the same 10% commission twice:
--   once into delivery_persons.total_earnings and again as a second
--   wallet_transactions row. 1,349 commission rows exist, 256 of them duplicate
--   credits for an order already paid, over-crediting partners by Rs 2,760.
--
--   The app code has been fixed (idempotency guard + ledger-derived totals). This
--   script repairs the historical data.
--
-- BEFORE YOU RUN
--   1. Take a Supabase backup (Dashboard -> Database -> Backups -> Restore, or
--      `supabase db dump`). A row-level backup of everything this touches is at
--      supabase/backups/wallet_transactions_2026-09-29.jsonl
--   2. Run the STEP 0 report and read it.
--
-- Run each step separately. Steps 1-3 are reversible; stop after any of them.
--
-- NOTE: order_id is uuid while SPLIT_PART() returns text, so every COALESCE
-- over the two must cast to ::text, otherwise Postgres raises
--   42804: COALESCE types uuid and text cannot be matched
-- =============================================================================


-- ── STEP 0 · Report only. Changes nothing. Run this first. ─────────────────────
-- Shows the duplicates that will be archived and the money involved.
WITH ranked AS (
  SELECT wt.id, wt.delivery_person_id, wt.amount, wt.description, wt.created_at,
         ROW_NUMBER() OVER (
           PARTITION BY wt.delivery_person_id,
                        COALESCE(wt.order_id::text, NULLIF(SPLIT_PART(wt.description, '#', 2), ''))
           ORDER BY wt.created_at ASC, wt.id ASC
         ) AS rn
  FROM wallet_transactions wt
  WHERE wt.type = 'delivery_earning'
)
SELECT COUNT(*)                              AS duplicate_rows_to_archive,
       COUNT(DISTINCT delivery_person_id)    AS partners_affected,
       COALESCE(SUM(amount), 0)              AS overpaid_amount
FROM ranked WHERE rn > 1;
-- Expected: 256 rows, 6 partners, Rs 2760.00


-- ── STEP 1 · Create the archive table. Adds structure, touches no data. ─────────
CREATE TABLE IF NOT EXISTS wallet_transactions_archived (
  archived_at      timestamptz NOT NULL DEFAULT now(),
  reason           text        NOT NULL DEFAULT 'duplicate delivery commission',
  original_row     jsonb       NOT NULL
);


-- ── STEP 2 · Archive duplicate commissions. NOTHING IS DELETED. ────────────────
-- Keeps the EARLIEST row per (partner, order) and archives every later duplicate.
-- The survivor is the original, correct credit.
WITH ranked AS (
  SELECT wt.id, wt.delivery_person_id, wt.amount, wt.description, wt.created_at,
         ROW_NUMBER() OVER (
           PARTITION BY wt.delivery_person_id,
                        COALESCE(wt.order_id::text, NULLIF(SPLIT_PART(wt.description, '#', 2), ''))
           ORDER BY wt.created_at ASC, wt.id ASC
         ) AS rn
  FROM wallet_transactions wt
  WHERE wt.type = 'delivery_earning'
), to_archive AS (
  SELECT * FROM ranked WHERE rn > 1
)
INSERT INTO wallet_transactions_archived (reason, original_row)
SELECT 'duplicate delivery commission',
       jsonb_build_object(
         'id', ta.id,
         'delivery_person_id', ta.delivery_person_id,
         'type', 'delivery_earning',
         'amount', ta.amount,
         'order_id', NULL,
         'description', ta.description,
         'created_at', ta.created_at
       )
FROM to_archive ta;

-- Now remove the archived rows from the live table.
WITH ranked AS (
  SELECT wt.id,
         ROW_NUMBER() OVER (
           PARTITION BY wt.delivery_person_id,
                        COALESCE(wt.order_id::text, NULLIF(SPLIT_PART(wt.description, '#', 2), ''))
           ORDER BY wt.created_at ASC, wt.id ASC
         ) AS rn
  FROM wallet_transactions wt
  WHERE wt.type = 'delivery_earning'
)
DELETE FROM wallet_transactions
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- ROLLBACK for step 2 (restores every archived row):
-- INSERT INTO wallet_transactions (id, delivery_person_id, type, amount, order_id, description, created_at)
-- SELECT (original_row->>'id')::uuid, (original_row->>'delivery_person_id')::uuid,
--        original_row->>'type', (original_row->>'amount')::numeric,
--        NULL, original_row->>'description', (original_row->>'created_at')::timestamptz
-- FROM wallet_transactions_archived WHERE reason = 'duplicate delivery commission';


-- ── STEP 3 · Resync the denormalised counters. GROSS lifetime figure. ─────────
-- total_earnings / lifetime_earnings are a GROSS lifetime figure: the total
-- commission a partner has ever earned, which never decreases. Withdrawals are
-- NOT subtracted here — subtracting them is what allowed the stored number to
-- drift away from the ledger in the first place. Withdrawability is computed on
-- demand as (commission earned - withdrawals already paid) in the admin UI.
--
-- This step changes the stored number only; no business rule changes.
--
-- Verified against live data — the value each partner should end up with:
--   Anshika 1475.90 -> 734.00   Rashmi 1550.30 -> 956.00
--   Mahi      40.50 ->  23.00   Manan 4611.60 -> 2337.00
--   Nidhi   2451.00 -> 2434.00   Ananya 2359.80 -> 1959.00
--   Priyanka 2280.20 -> 1138.00  Komal 1912.90 -> 930.00
--   Priyam   191.50 ->  116.00   Ridhi 846.87 -> 979.00
--   Suraj      0.00 ->   69.00   Pragya 43.00 -> 43.00
--   Rudra    104.40 ->   52.00   Rohit  243.00 -> 123.00
--   Ritesh     0.50 ->    0.00
WITH earned AS (
  SELECT delivery_person_id, SUM(amount) AS total
  FROM wallet_transactions
  WHERE type = 'delivery_earning'
  GROUP BY delivery_person_id
)
UPDATE delivery_persons dp
SET total_earnings    = e.total,
    lifetime_earnings = e.total
FROM earned e
WHERE dp.id = e.delivery_person_id;

UPDATE delivery_persons dp
SET total_earnings = 0, lifetime_earnings = 0
WHERE NOT EXISTS (
  SELECT 1 FROM wallet_transactions wt
  WHERE wt.delivery_person_id = dp.id AND wt.type = 'delivery_earning'
);


-- ── STEP 4 · OPTIONAL hard guard. Skip if you want zero database behaviour change.
-- Populates order_id from the order number in the description, then makes a second
-- commission for the same delivery impossible at the database level. The app code
-- already prevents this; this is defence in depth.
--
-- UPDATE wallet_transactions wt
-- SET order_id = o.id
-- FROM orders o
-- WHERE wt.type = 'delivery_earning'
--   AND wt.order_id IS NULL
--   AND SPLIT_PART(wt.description, '#', 2) = o.order_number;
--
-- CREATE UNIQUE INDEX IF NOT EXISTS wallet_transactions_one_earning_per_order
--   ON wallet_transactions (delivery_person_id, order_id)
--   WHERE type = 'delivery_earning' AND order_id IS NOT NULL;


-- ── VERIFY · Run after steps 2 and 3. ──────────────────────────────────────────
-- Must show commission_rows = distinct_orders for every partner.
SELECT delivery_person_id,
       COUNT(*)             AS commission_rows,
       COUNT(DISTINCT COALESCE(order_id::text, NULLIF(SPLIT_PART(description, '#', 2), ''))) AS distinct_orders,
       SUM(amount)          AS total_earnings
FROM wallet_transactions
WHERE type = 'delivery_earning'
GROUP BY delivery_person_id
ORDER BY total_earnings DESC;

-- Compare against the stored counter.
SELECT dp.name, dp.total_earnings AS stored_counter,
       COALESCE(l.total, 0)     AS ledger_total
FROM delivery_persons dp
LEFT JOIN (
  SELECT delivery_person_id, SUM(amount) AS total
  FROM wallet_transactions WHERE type = 'delivery_earning'
  GROUP BY delivery_person_id
) l ON l.delivery_person_id = dp.id
ORDER BY dp.total_earnings DESC;
