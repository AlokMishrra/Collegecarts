-- ============================================================================
-- STEP 3: CREATE STOCK VALIDATION FUNCTIONS
-- ============================================================================
-- Run this AFTER STEP 1 and STEP 2
-- ============================================================================

-- Function 1: check_product_stock
CREATE OR REPLACE FUNCTION check_product_stock(
  p_product_id UUID,
  p_hostel_name TEXT,
  p_quantity INTEGER DEFAULT 1
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_hostel_id UUID;
  v_current_stock INTEGER;
BEGIN
  SELECT id INTO v_hostel_id FROM public.hostels WHERE name = p_hostel_name LIMIT 1;
  
  IF v_hostel_id IS NULL OR p_hostel_name = 'Other' THEN
    SELECT stock_quantity INTO v_current_stock FROM public.products WHERE id = p_product_id;
    RETURN COALESCE(v_current_stock, 0) >= p_quantity;
  END IF;
  
  SELECT stock_quantity INTO v_current_stock
  FROM public.hostel_stock
  WHERE product_id = p_product_id AND hostel_id = v_hostel_id;
  
  RETURN COALESCE(v_current_stock, 0) >= p_quantity;
END;
$$;

-- Function 2: get_product_hostel_stock
CREATE OR REPLACE FUNCTION get_product_hostel_stock(
  p_product_id UUID,
  p_hostel_name TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_hostel_id UUID;
  v_stock INTEGER;
BEGIN
  SELECT id INTO v_hostel_id FROM public.hostels WHERE name = p_hostel_name LIMIT 1;
  
  IF v_hostel_id IS NULL OR p_hostel_name = 'Other' THEN
    SELECT stock_quantity INTO v_stock FROM public.products WHERE id = p_product_id;
    RETURN COALESCE(v_stock, 0);
  END IF;
  
  SELECT stock_quantity INTO v_stock
  FROM public.hostel_stock
  WHERE product_id = p_product_id AND hostel_id = v_hostel_id;
  
  RETURN COALESCE(v_stock, 0);
END;
$$;

-- Function 3: reserve_stock
CREATE OR REPLACE FUNCTION reserve_stock(
  p_product_id UUID,
  p_hostel_name TEXT,
  p_quantity INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_hostel_id UUID;
  v_current_stock INTEGER;
  v_rows_affected INTEGER;
BEGIN
  SELECT id INTO v_hostel_id FROM public.hostels WHERE name = p_hostel_name LIMIT 1;
  
  IF v_hostel_id IS NULL OR p_hostel_name = 'Other' THEN
    SELECT stock_quantity INTO v_current_stock
    FROM public.products WHERE id = p_product_id FOR UPDATE;
    
    IF COALESCE(v_current_stock, 0) < p_quantity THEN
      RETURN FALSE;
    END IF;
    
    UPDATE public.products
    SET stock_quantity = stock_quantity - p_quantity, updated_at = NOW()
    WHERE id = p_product_id AND stock_quantity >= p_quantity;
    
    GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
    RETURN v_rows_affected > 0;
  END IF;
  
  SELECT stock_quantity INTO v_current_stock
  FROM public.hostel_stock
  WHERE product_id = p_product_id AND hostel_id = v_hostel_id FOR UPDATE;
  
  IF COALESCE(v_current_stock, 0) < p_quantity THEN
    RETURN FALSE;
  END IF;
  
  UPDATE public.hostel_stock
  SET stock_quantity = stock_quantity - p_quantity, updated_at = NOW()
  WHERE product_id = p_product_id AND hostel_id = v_hostel_id AND stock_quantity >= p_quantity;
  
  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
  RETURN v_rows_affected > 0;
END;
$$;

-- Function 4: release_stock
CREATE OR REPLACE FUNCTION release_stock(
  p_product_id UUID,
  p_hostel_name TEXT,
  p_quantity INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_hostel_id UUID;
BEGIN
  SELECT id INTO v_hostel_id FROM public.hostels WHERE name = p_hostel_name LIMIT 1;
  
  IF v_hostel_id IS NULL OR p_hostel_name = 'Other' THEN
    UPDATE public.products
    SET stock_quantity = stock_quantity + p_quantity, updated_at = NOW()
    WHERE id = p_product_id;
    RETURN TRUE;
  END IF;
  
  UPDATE public.hostel_stock
  SET stock_quantity = stock_quantity + p_quantity, updated_at = NOW()
  WHERE product_id = p_product_id AND hostel_id = v_hostel_id;
  
  RETURN TRUE;
END;
$$;

-- Function 5: validate_cart_stock
CREATE OR REPLACE FUNCTION validate_cart_stock(
  p_user_id UUID,
  p_hostel_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_out_of_stock JSONB := '[]'::JSONB;
  v_cart_item RECORD;
  v_available_stock INTEGER;
BEGIN
  FOR v_cart_item IN
    SELECT ci.product_id, ci.quantity, p.name as product_name
    FROM public.cart_items ci
    JOIN public.products p ON ci.product_id = p.id
    WHERE ci.user_id = p_user_id
  LOOP
    v_available_stock := get_product_hostel_stock(v_cart_item.product_id, p_hostel_name);
    
    IF v_available_stock < v_cart_item.quantity THEN
      v_out_of_stock := v_out_of_stock || jsonb_build_object(
        'product_id', v_cart_item.product_id,
        'product_name', v_cart_item.product_name,
        'requested_quantity', v_cart_item.quantity,
        'available_stock', v_available_stock
      );
    END IF;
  END LOOP;
  
  RETURN v_out_of_stock;
END;
$$;

-- Function 6: get_low_stock_products
CREATE OR REPLACE FUNCTION get_low_stock_products(
  p_threshold INTEGER DEFAULT 5
)
RETURNS TABLE (
  product_id UUID,
  product_name TEXT,
  hostel_name TEXT,
  stock_quantity INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.name, h.name, hs.stock_quantity
  FROM public.hostel_stock hs
  JOIN public.products p ON hs.product_id = p.id
  JOIN public.hostels h ON hs.hostel_id = h.id
  WHERE hs.stock_quantity <= p_threshold AND hs.stock_quantity > 0
  ORDER BY hs.stock_quantity ASC, p.name ASC;
END;
$$;

-- Verify all functions created
SELECT 
  'Functions created: ' || COUNT(*)::text || '/6' as status
FROM pg_proc
WHERE proname IN (
  'check_product_stock',
  'get_product_hostel_stock',
  'reserve_stock',
  'release_stock',
  'validate_cart_stock',
  'get_low_stock_products'
);

-- If count is 6, setup is complete!
