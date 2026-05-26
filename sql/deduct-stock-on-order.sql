-- ============================================================
-- DEDUCT STOCK ON ORDER PLACED
-- When a user places an order, immediately deduct stock from:
-- 1. hostel_stock table (hostel-specific stock)
-- 2. products.stock_quantity (total stock)
-- If hostel stock reaches 0, the product shows "Out of Stock" for that hostel.
-- ============================================================

-- Function to deduct stock for a single item from hostel_stock table + products table
CREATE OR REPLACE FUNCTION deduct_stock_on_order(
  p_product_id TEXT,
  p_quantity INT,
  p_hostel_name TEXT DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
  v_hostel_id UUID;
  v_hostel_stock INT;
  v_total_stock INT;
  v_new_hostel_stock INT;
  v_new_total_stock INT;
BEGIN
  -- Get hostel ID from name
  IF p_hostel_name IS NOT NULL AND p_hostel_name <> '' AND p_hostel_name <> 'Other' THEN
    SELECT id INTO v_hostel_id FROM hostels WHERE name = p_hostel_name LIMIT 1;
  END IF;

  -- Lock the product row
  SELECT stock_quantity INTO v_total_stock
  FROM products WHERE id = p_product_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', FALSE, 'error', 'Product not found');
  END IF;

  -- Deduct from hostel_stock table if hostel exists
  IF v_hostel_id IS NOT NULL THEN
    SELECT stock_quantity INTO v_hostel_stock
    FROM hostel_stock
    WHERE product_id = p_product_id AND hostel_id = v_hostel_id
    FOR UPDATE;

    IF FOUND AND v_hostel_stock IS NOT NULL THEN
      v_new_hostel_stock := GREATEST(0, v_hostel_stock - p_quantity);
      
      UPDATE hostel_stock
      SET stock_quantity = v_new_hostel_stock,
          updated_at = NOW()
      WHERE product_id = p_product_id AND hostel_id = v_hostel_id;
    END IF;
  END IF;

  -- Deduct from products.stock_quantity (total stock)
  v_new_total_stock := GREATEST(0, v_total_stock - p_quantity);
  
  UPDATE products
  SET stock_quantity = v_new_total_stock,
      is_available = CASE WHEN v_new_total_stock <= 0 THEN FALSE ELSE is_available END,
      updated_at = NOW()
  WHERE id = p_product_id;

  -- Also update the JSONB hostel_stock field on products table (for backward compat)
  IF p_hostel_name IS NOT NULL AND p_hostel_name <> '' AND p_hostel_name <> 'Other' THEN
    UPDATE products
    SET hostel_stock = CASE
      WHEN hostel_stock IS NOT NULL AND hostel_stock ? p_hostel_name
      THEN jsonb_set(
        hostel_stock,
        ARRAY[p_hostel_name],
        to_jsonb(GREATEST(0, COALESCE((hostel_stock ->> p_hostel_name)::INT, 0) - p_quantity))
      )
      ELSE hostel_stock
    END
    WHERE id = p_product_id;
  END IF;

  RETURN json_build_object(
    'success', TRUE,
    'product_id', p_product_id,
    'new_total_stock', v_new_total_stock,
    'new_hostel_stock', COALESCE(v_new_hostel_stock, v_new_total_stock)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant access
GRANT EXECUTE ON FUNCTION deduct_stock_on_order(TEXT, INT, TEXT) TO authenticated, anon;
