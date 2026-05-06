-- ============================================================
-- STOCK LIFECYCLE FIX
-- Run this in Supabase SQL Editor
-- ============================================================
-- RULE:
--   ORDER PLACED    → reserve_stock()   (marks reserved, no actual deduction)
--   ORDER DELIVERED → deliver_stock()   (deducts total + hostel stock)
--   ORDER CANCELLED → release_stock()   (releases reservation, no deduction)
-- ============================================================

-- ── 1. Add reserved_stock column if not exists ────────────────────────────
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS reserved_stock integer DEFAULT 0;

-- ── 2. reserve_stock — called on ORDER PLACED ─────────────────────────────
-- Checks available stock (total - reserved), marks as reserved.
-- Does NOT reduce actual stock_quantity.
CREATE OR REPLACE FUNCTION reserve_stock(
  p_product_id  TEXT,
  p_quantity    INT,
  p_hostel      TEXT DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
  v_total_stock    INT;
  v_reserved       INT;
  v_hostel_stock   INT;
  v_available      INT;
BEGIN
  SELECT stock_quantity, COALESCE(reserved_stock, 0)
  INTO   v_total_stock, v_reserved
  FROM   products
  WHERE  id = p_product_id::uuid
  FOR UPDATE;

  IF v_total_stock IS NULL THEN
    RETURN json_build_object('success', FALSE, 'error', 'Product not found');
  END IF;

  -- Check hostel-specific stock if hostel provided
  IF p_hostel IS NOT NULL AND p_hostel <> 'Other' THEN
    SELECT COALESCE((hostel_stock->>p_hostel)::int, v_total_stock)
    INTO   v_hostel_stock
    FROM   products
    WHERE  id = p_product_id::uuid;
    v_available := LEAST(v_total_stock - v_reserved, v_hostel_stock);
  ELSE
    v_available := v_total_stock - v_reserved;
  END IF;

  IF v_available < p_quantity THEN
    RETURN json_build_object(
      'success', FALSE,
      'error', 'Insufficient stock',
      'available', v_available
    );
  END IF;

  -- Mark as reserved (no actual stock deduction yet)
  UPDATE products
  SET    reserved_stock = COALESCE(reserved_stock, 0) + p_quantity,
         updated_at     = NOW()
  WHERE  id = p_product_id::uuid;

  RETURN json_build_object(
    'success',   TRUE,
    'reserved',  p_quantity,
    'available', v_available - p_quantity
  );
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION reserve_stock(TEXT, INT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION reserve_stock(TEXT, INT, TEXT) TO anon;

-- ── 3. deliver_stock — called on ORDER DELIVERED ──────────────────────────
-- Deducts actual stock_quantity AND hostel_stock.
-- Releases the reservation that was set on order placement.
CREATE OR REPLACE FUNCTION deliver_stock(
  p_product_id  TEXT,
  p_quantity    INT,
  p_hostel      TEXT DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
  v_total_stock    INT;
  v_reserved       INT;
  v_hostel_stock   INT;
  v_new_total      INT;
  v_new_hostel     INT;
  v_hostel_json    JSONB;
BEGIN
  SELECT stock_quantity, COALESCE(reserved_stock, 0), hostel_stock
  INTO   v_total_stock, v_reserved, v_hostel_json
  FROM   products
  WHERE  id = p_product_id::uuid
  FOR UPDATE;

  IF v_total_stock IS NULL THEN
    RETURN json_build_object('success', FALSE, 'error', 'Product not found');
  END IF;

  -- Deduct total stock (floor at 0)
  v_new_total := GREATEST(0, v_total_stock - p_quantity);

  -- Deduct hostel stock if hostel provided
  IF p_hostel IS NOT NULL AND p_hostel <> 'Other' AND v_hostel_json IS NOT NULL THEN
    v_hostel_stock := COALESCE((v_hostel_json->>p_hostel)::int, 0);
    v_new_hostel   := GREATEST(0, v_hostel_stock - p_quantity);
    v_hostel_json  := jsonb_set(v_hostel_json, ARRAY[p_hostel], to_jsonb(v_new_hostel));
  END IF;

  -- Release reservation + deduct actual stock
  UPDATE products
  SET
    stock_quantity = v_new_total,
    reserved_stock = GREATEST(0, COALESCE(reserved_stock, 0) - p_quantity),
    hostel_stock   = CASE
                       WHEN p_hostel IS NOT NULL AND p_hostel <> 'Other'
                       THEN v_hostel_json
                       ELSE hostel_stock
                     END,
    is_available   = CASE WHEN v_new_total <= 0 THEN FALSE ELSE is_available END,
    updated_at     = NOW()
  WHERE id = p_product_id::uuid;

  RETURN json_build_object(
    'success',         TRUE,
    'new_total_stock', v_new_total,
    'new_hostel_stock', CASE WHEN p_hostel IS NOT NULL THEN v_new_hostel ELSE NULL END
  );
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION deliver_stock(TEXT, INT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION deliver_stock(TEXT, INT, TEXT) TO anon;

-- ── 4. release_stock — called on ORDER CANCELLED ─────────────────────────
-- Releases the reservation. Does NOT touch actual stock_quantity.
CREATE OR REPLACE FUNCTION release_stock(
  p_product_id TEXT,
  p_quantity   INT
) RETURNS JSON AS $$
BEGIN
  UPDATE products
  SET
    reserved_stock = GREATEST(0, COALESCE(reserved_stock, 0) - p_quantity),
    -- Re-enable availability if stock is now available
    is_available   = CASE
                       WHEN stock_quantity > 0 THEN TRUE
                       ELSE is_available
                     END,
    updated_at     = NOW()
  WHERE id = p_product_id::uuid;

  IF NOT FOUND THEN
    RETURN json_build_object('success', FALSE, 'error', 'Product not found');
  END IF;

  RETURN json_build_object('success', TRUE, 'released', p_quantity);
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION release_stock(TEXT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION release_stock(TEXT, INT) TO anon;

-- ── 5. Keep decrement_stock for backward compat (now just an alias) ───────
-- Some older code may still call this. Make it a no-op that returns success
-- so it doesn't break anything, but actual stock management is via the
-- reserve/deliver/release functions above.
CREATE OR REPLACE FUNCTION decrement_stock(
  p_product_id TEXT,
  p_quantity   INT
) RETURNS JSON AS $$
BEGIN
  -- Delegate to reserve_stock for backward compatibility
  RETURN reserve_stock(p_product_id, p_quantity, NULL);
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION decrement_stock(TEXT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION decrement_stock(TEXT, INT) TO anon;

-- ── 6. Verification ───────────────────────────────────────────────────────
DO $$
BEGIN
  RAISE NOTICE '✅ reserve_stock()  — call on ORDER PLACED';
  RAISE NOTICE '✅ deliver_stock()  — call on ORDER DELIVERED';
  RAISE NOTICE '✅ release_stock()  — call on ORDER CANCELLED';
  RAISE NOTICE '✅ decrement_stock() — backward compat alias for reserve_stock';
  RAISE NOTICE '✅ reserved_stock column added to products';
END $$;
