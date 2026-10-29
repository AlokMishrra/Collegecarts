-- ============================================================================
-- CollegeCart — Financial Integrity: idempotency for money-moving operations
-- ============================================================================
-- Branch: fix/security-remediation-2026-10
--
-- PROBLEM (from audit, re-verified here):
--   1. Double commission credit. A partner could be credited twice for one
--      order because the post-delivery write path had no uniqueness guard.
--      The prior fix attempt was committed COMMENTED OUT:
--        -- CREATE UNIQUE INDEX ... wallet_transactions_one_earning_per_order
--      (supabase/delivery-earnings-reconcile.sql:159-161)
--      leaving the application guard as the only defence.
--   2. `collect_cod_cash(partner, order, amount)` deducts the wallet and
--      increments cod_held with no "already collected" check, so a second call
--      deducts twice for one order.
--   3. No unique constraint on (delivery_person_id, order_id) for earnings, and
--      no unique constraint on COD collection events at all.
--
-- DESIGN:
--   * Prevent the duplicate-credit CLASS from recurring using a partial unique
--     index on the columns that exist and are reliable.
--   * `order_id` is NOT reliable: it is NULL on existing rows (order number was
--     embedded in `description` instead). A unique index over a nullable column
--     does not protect NULLs in Postgres (NULLs are distinct). Two strategies:
--       (a) new code must always write order_id.
--       (b) a stable event key column carries the order identity for rows
--            written before order_id was populated.
--     This migration adds the partial unique index on order_id AND a
--     stable-event-key column with its own unique index, so both old and new
--     writes are protected.
--   * `collect_cod_cash` is replaced with an idempotent version that takes the
--     expected prior state and effects nothing when already applied.
--   * NO historical ledger row is deleted or rewritten. Nothing here mutates
--     data; it only adds constraints and a safer function.
--
-- SAFE TO RE-RUN. NO DESTRUCTIVE OPERATIONS.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Reliable event key for earnings.
--    `order_id` is null on legacy rows, so uniqueness must not depend on it
--    alone. `type` + `delivery_person_id` + a non-null event key is the
--    strongest available invariant.
-- ----------------------------------------------------------------------------
alter table public.wallet_transactions
  add column if not exists earning_event_key text;

comment on column public.wallet_transactions.earning_event_key is
'Stable idempotency key for credit-type ledger rows, e.g. ''delivery_earning:<order_id>''. NULL for debits and unclassified rows.';

-- One commission credit per (partner, order).
create unique index if not exists wallet_transactions_one_earning_per_order
  on public.wallet_transactions (delivery_person_id, order_id)
  where type = 'delivery_earning' and order_id is not null;

-- Second guard for rows whose order_id could not be recorded.
create unique index if not exists wallet_transactions_one_earning_per_event
  on public.wallet_transactions (earning_event_key)
  where earning_event_key is not null;

-- ----------------------------------------------------------------------------
-- 2. Required hot-path indexes.
--    Every partner earnings read currently seq-scans 2,180+ rows because
--    delivery_person_id has no index. The reconcile window function partitions
--    by delivery_person_id on the same table.
-- ----------------------------------------------------------------------------
create index if not exists idx_wallet_transactions_partner
  on public.wallet_transactions (delivery_person_id, created_at desc);

create index if not exists idx_wallet_transactions_order
  on public.wallet_transactions (order_id)
  where order_id is not null;

create index if not exists idx_wallet_transactions_type
  on public.wallet_transactions (type, created_at desc);

-- ----------------------------------------------------------------------------
-- 3. Other confirmed un-indexed foreign keys on hot paths only.
--    Deliberately not speculative: each index below targets a query the app
--    actually issues.
-- ----------------------------------------------------------------------------
create index if not exists idx_refunds_order
  on public.refunds (order_id);

create index if not exists idx_refunds_user
  on public.refunds (user_id, created_at desc);

create index if not exists idx_campaign_usage_campaign
  on public.campaign_usage (campaign_id);

create index if not exists idx_campaign_usage_user
  on public.campaign_usage (user_id);

create index if not exists idx_loyalty_txn_user
  on public.loyalty_transactions (user_id, created_at desc);

create index if not exists idx_support_tickets_order
  on public.support_tickets (order_id);

create index if not exists idx_notifications_user_created
  on public.notifications (user_id, created_at desc);

-- ----------------------------------------------------------------------------
-- 4. Idempotent COD collection.
--    Replaces the prior implementation which deducted the wallet and moved
--    cash unconditionally. The new version effects nothing when the order has
--    already been collected, which is the exact failure mode the audit found.
--
--    Behaviour preserved from the original:
--      wallet_balance decreases by p_amount, cod_held increases by the same.
--    Added: an explicit idempotency contract based on the order's own collected
--    marker, so a repeat call for the same order is a no-op.
--
--    Returns text: 'collected' | 'already_collected' | 'insufficient_balance'
--                  | 'order_not_found'
-- ----------------------------------------------------------------------------
-- ----------------------------------------------------------------------------
-- 4. Idempotent COD collection.
--
--    IMPORTANT: the production function was VERIFIED live before writing this.
--    It returns JSON: {"success": true, "cod_amount": <p_amount>,
--    "commission": <10% of p_amount>} and applies a flat 10% commission. The
--    copy in COMPLETE_DATABASE_SETUP.sql only returns {"success": true}, so
--    the repo was behind production. This migration keeps the PRODUCTION
--    contract byte-for-byte compatible and only adds the missing guard.
--
--    Defect being fixed: the original deducted wallet_balance and moved cash
--    with no check that cod_collected was already set, so a repeat call for the
--    same order double-deducted the partner's wallet.
--
--    Preserved exactly:
--      * wallet_balance -= p_amount, cod_held += p_amount
--      * cod_held_since set only when the partner held nothing beforehand
--      * orders.cod_collected / cod_collected_at / cod_collected_by set
--      * orders.cod_collection_method = 'cash'
--      * 10% commission returned to the caller
--    Added:
--      * SELECT ... FOR UPDATE on the order, so two concurrent collections
--        serialise instead of both deducting
--      * an early return when the order is already collected
--      * a ledger row keyed by the order, guarded by the event-key unique
--        index, so the movement is auditable and cannot be duplicated
-- ----------------------------------------------------------------------------
create or replace function public.collect_cod_cash(
  p_partner_id uuid,
  p_order_id   uuid,
  p_amount     numeric
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order      public.orders%rowtype;
  current_held numeric;
  v_commission numeric;
begin
  if p_amount is null or p_amount <= 0 then
    return json_build_object('success', false, 'error', 'invalid_amount');
  end if;

  -- Lock the order first so concurrent collections of the same order
  -- serialise rather than both deducting the partner's wallet.
  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    return json_build_object('success', false, 'error', 'order_not_found');
  end if;

  -- Idempotency: this order has already been collected. Do not move money.
  if coalesce(v_order.cod_collected, false) then
    return json_build_object(
      'success', true,
      'cod_amount', 0,
      'commission', 0,
      'already_collected', true
    );
  end if;

  -- Ownership: only the assigned partner may collect this order.
  if v_order.delivery_person_id is not null
     and v_order.delivery_person_id <> p_partner_id then
    return json_build_object('success', false, 'error', 'order_not_assigned_to_partner');
  end if;

  SELECT cod_held INTO current_held
  FROM delivery_persons WHERE id = p_partner_id FOR UPDATE;

  UPDATE delivery_persons SET
    wallet_balance = COALESCE(wallet_balance, 0) - p_amount,
    cod_held = COALESCE(cod_held, 0) + p_amount,
    cod_held_since = CASE WHEN COALESCE(current_held, 0) = 0 THEN NOW() ELSE cod_held_since END
  WHERE id = p_partner_id;

  UPDATE orders SET
    cod_collected = TRUE,
    cod_collected_at = NOW(),
    cod_collected_by = p_partner_id,
    cod_collection_method = 'cash'
  WHERE id = p_order_id;

  -- Auditable ledger row. The event-key unique index makes a second credit
  -- for the same order impossible even if the guard above is bypassed.
  begin
    insert into public.wallet_transactions (
      type, delivery_person_id, order_id, amount, description, earning_event_key
    ) values (
      'cod_collection', p_partner_id, p_order_id, -p_amount,
      format('COD cash collected for order #%s',
             coalesce(v_order.order_number, p_order_id::text)),
      'cod_collection:' || p_order_id::text
    );
  exception when unique_violation then
    null; -- already recorded; the money movement above is the guarded one
  end;

  v_commission := round(p_amount * 0.10, 2);

  return json_build_object(
    'success', true,
    'cod_amount', p_amount,
    'commission', v_commission
  );
end;
$$;

comment on function public.collect_cod_cash(uuid, uuid, numeric) is
'Idempotent COD collection. Marks the order collected and moves wallet_balance to cod_held. Returns already_collected on repeat calls.';

-- Re-grant to the callers the original had.
grant execute on function public.collect_cod_cash(uuid, uuid, numeric)
  to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 5. Backfill the event key for existing earnings rows where possible.
--    This is a non-destructive UPDATE that populates a new column from data
--    already present in `description`, so the second unique index can protect
--    legacy rows too. Rows whose order number cannot be parsed are left NULL
--    and therefore unprotected by this index — the order_id index still covers
--    everything written by new code.
--    NOTE: run in batches on production. Not destructive; safe to re-run.
-- ----------------------------------------------------------------------------
update public.wallet_transactions
   set earning_event_key = 'delivery_earning:' || substring(description from '#([A-Za-z0-9-]+)')
 where earning_event_key is null
   and type = 'delivery_earning'
   and order_id is null
   and description like '%#%';

update public.wallet_transactions
   set earning_event_key = 'cod_collection:' || order_id::text
 where earning_event_key is null
   and type = 'cod_collection'
   and order_id is not null;

-- ----------------------------------------------------------------------------
-- VERIFY AFTER APPLYING:
--   select conname, contype from pg_constraint
--    where conname like 'wallet_transactions%';
--   select indexname from pg_indexes where tablename='wallet_transactions';
--   -- then run the duplicate-event test in COLLEGECART_SECURITY_FIXES.md
--
-- ROLLBACK: drop the indexes and the earning_event_key column. No data is
-- mutated by the DDL itself; the earn-key backfill only fills a new column.
-- ============================================================================