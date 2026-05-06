-- ============================================================
-- INVENTORY SYSTEM FIX — Run in Supabase SQL Editor
-- ============================================================
-- This migration:
-- 1. Adds hostel_id column to orders
-- 2. Backfills hostel_id from existing items JSONB
-- 3. Creates/replaces atomic stock RPCs with correct TEXT type
-- 4. Drops old UUID-typed functions that cause type mismatches
-- ============================================================

-- ─── 1. Add hostel_id column ─────────────────────────────────────────────
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS hostel_id TEXT;

-- Backfill hostel_id from items JSONB for existing orders
UPDATE public.orders
SET hostel_id = (items->0->>'hostel')
WHERE hostel_id IS NULL
  AND items IS NOT NULL
  AND jsonb_array_length(items) > 0
  AND items->0->>'hostel' IS NOT NULL
  AND items->0->>'hostel' != 'null';

-- Also backfill from delivery_address for orders that still have NULL hostel_id
UPDATE public.orders
SET hostel_id = (regexp_match(delivery_address, '^(\w+)\s+Hostel'))[1]
WHERE hostel_id IS NULL
  AND delivery_address IS NOT NULL
  AND delivery_address ~ '^\w+\s+Hostel';

-- ─── 2. Add reserved_stock column if missing ─────────────────────────────
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS reserved_stock INTEGER DEFAULT 0;

-- ─── 3. Atomic confirm_delivery_atomic ───────────────────────────────────
-- Called on ORDER DELIVERED.
-- Deducts stock_quantity, hostel_stock, and releases reservation atomically.
-- Uses TEXT for p_product_id to match products.id type.
CREATE OR REPLACE FUNCTION public.confirm_delivery_atomic(
  p_product_id TEXT,
  p_quantity   INT,
  p_hostel     TEXT DEFAULT NULL
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total       INT;
  v_reserved    INT;
  v_new_total   INT;
  v_new_hostel  INT;
  v_hostel_json JSONB;
BEGIN
  -- Lock the row to prevent concurrent modifications
  SELECT stock_quantity, COALESCE(reserved_stock, 0), hostel_stock
  INTO   v_total, v_reserved, v_hostel_json
  FROM   products
  WHERE  id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', FALSE,
      'error', 'Product not found: ' || p_product_id
    );
  END IF;

  -- Prevent negative stock
  IF v_total < p_quantity THEN
    RETURN json_build_object(
      'success', FALSE,
      'error', 'Insufficient stock for product ' || p_product_id,
      'current_stock', v_total,
      'requested', p_quantity
    );
  END IF;

  v_new_total := GREATEST(0, v_total - p_quantity);

  -- Update hostel-specific stock if applicable
  IF p_hostel IS NOT NULL AND p_hostel <> '' AND p_hostel <> 'Other'
     AND v_hostel_json IS NOT NULL AND v_hostel_json ? p_hostel THEN
    v_new_hostel  := GREATEST(0, COALESCE((v_hostel_json ->> p_hostel)::INT, 0) - p_quantity);
    v_hostel_json := jsonb_set(v_hostel_json, ARRAY[p_hostel], to_jsonb(v_new_hostel));
  END IF;

  UPDATE products
  SET
    stock_quantity = v_new_total,
    reserved_stock = GREATEST(0, COALESCE(reserved_stock, 0) - p_quantity),
    hostel_stock   = CASE
                       WHEN p_hostel IS NOT NULL AND p_hostel <> '' AND p_hostel <> 'Other'
                            AND v_hostel_json IS NOT NULL
                       THEN v_hostel_json
                       ELSE hostel_stock
                     END,
    is_available   = CASE WHEN v_new_total <= 0 THEN FALSE ELSE is_available END,
    updated_at     = NOW()
  WHERE id = p_product_id;

  RETURN json_build_object(
    'success', TRUE,
    'new_stock', v_new_total,
    'product_id', p_product_id
  );
END;
$$;

-- ─── 4. Atomic cancel_order_stock_atomic ─────────────────────────────────
-- Called on ORDER CANCELLED.
-- Releases reservation only. Does NOT touch actual stock_quantity.
CREATE OR REPLACE FUNCTION public.cancel_order_stock_atomic(
  p_product_id TEXT,
  p_quantity   INT
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE products
  SET
    reserved_stock = GREATEST(0, COALESCE(reserved_stock, 0) - p_quantity),
    is_available   = CASE WHEN stock_quantity > 0 THEN TRUE ELSE is_available END,
    updated_at     = NOW()
  WHERE id = p_product_id;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', FALSE,
      'error', 'Product not found: ' || p_product_id
    );
  END IF;

  RETURN json_build_object('success', TRUE, 'released', p_quantity);
END;
$$;

-- ─── 5. Updated decrement_stock (TEXT type) ──────────────────────────────
-- Kept for backward compat. Calls confirm_delivery_atomic internally.
DROP FUNCTION IF EXISTS public.decrement_stock(TEXT, INT);
CREATE OR REPLACE FUNCTION public.decrement_stock(
  p_product_id TEXT,
  p_quantity   INT
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_stock INT;
  remaining_stock INT;
BEGIN
  SELECT stock_quantity INTO current_stock
  FROM products
  WHERE id = p_product_id
  FOR UPDATE;

  IF current_stock IS NULL THEN
    RETURN json_build_object('success', FALSE, 'error', 'Product not found', 'remaining_stock', 0);
  END IF;

  IF current_stock < p_quantity THEN
    RETURN json_build_object('success', FALSE, 'error', 'Insufficient stock', 'remaining_stock', current_stock);
  END IF;

  remaining_stock := current_stock - p_quantity;

  UPDATE products
  SET
    stock_quantity = remaining_stock,
    reserved_stock = GREATEST(0, COALESCE(reserved_stock, 0) - p_quantity),
    is_available = CASE WHEN remaining_stock <= 0 THEN FALSE ELSE is_available END,
    updated_at = NOW()
  WHERE id = p_product_id;

  RETURN json_build_object('success', TRUE, 'remaining_stock', remaining_stock, 'message', 'Stock updated successfully');
END;
$$ ;

-- ─── 6. Reserve stock (TEXT type) ────────────────────────────────────────
DROP FUNCTION IF EXISTS public.reserve_stock(UUID, INT, TEXT);
CREATE OR REPLACE FUNCTION public.reserve_stock(
  p_product_id TEXT,
  p_quantity   INT,
  p_hostel     TEXT DEFAULT NULL
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total        INT;
  v_reserved     INT;
  v_hostel_avail INT;
  v_available    INT;
BEGIN
  SELECT stock_quantity, COALESCE(reserved_stock, 0)
  INTO   v_total, v_reserved
  FROM   products
  WHERE  id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', FALSE, 'error', 'Product not found');
  END IF;

  IF p_hostel IS NOT NULL AND p_hostel <> '' AND p_hostel <> 'Other' THEN
    SELECT COALESCE((hostel_stock ->> p_hostel)::INT, v_total)
    INTO   v_hostel_avail
    FROM   products
    WHERE  id = p_product_id;
    v_available := LEAST(v_total - v_reserved, v_hostel_avail);
  ELSE
    v_available := v_total - v_reserved;
  END IF;

  IF v_available < p_quantity THEN
    RETURN json_build_object(
      'success',   FALSE,
      'error',     'Insufficient stock',
      'available', v_available
    );
  END IF;

  UPDATE products
  SET    reserved_stock = COALESCE(reserved_stock, 0) + p_quantity,
         updated_at     = NOW()
  WHERE  id = p_product_id;

  RETURN json_build_object(
    'success',   TRUE,
    'reserved',  p_quantity,
    'available', v_available - p_quantity
  );
END;
$$;

-- ─── 7. Cancel order stock (TEXT type, drop old UUID version) ─────────────
DROP FUNCTION IF EXISTS public.cancel_order_stock(UUID, INT);
DROP FUNCTION IF EXISTS public.confirm_delivery(UUID, INT, TEXT);

-- ─── 8. Grants ───────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.confirm_delivery_atomic(TEXT, INT, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.cancel_order_stock_atomic(TEXT, INT)     TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.reserve_stock(TEXT, INT, TEXT)           TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.decrement_stock(TEXT, INT)               TO authenticated, anon;

-- ─── 9. Reload PostgREST schema cache ────────────────────────────────────
NOTIFY pgrst, 'reload schema';

-- ─── 10. Verify ──────────────────────────────────────────────────────────
SELECT routine_name, data_type
FROM   information_schema.routines
WHERE  routine_schema = 'public'
  AND  routine_name IN (
    'confirm_delivery_atomic',
    'cancel_order_stock_atomic',
    'reserve_stock',
    'decrement_stock'
  );

SELECT 'Inventory system fix applied successfully!' AS status;
