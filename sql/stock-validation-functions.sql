-- ============================================================================
-- STOCK VALIDATION FUNCTIONS
-- ============================================================================
-- Server-side functions for validating stock availability
-- These functions ensure stock checks happen on the database level
-- preventing race conditions and ensuring data integrity
--
-- Run this in Supabase SQL Editor AFTER enable-realtime-stock-sync.sql
-- ============================================================================

-- ============================================================================
-- FUNCTION: check_product_stock
-- ============================================================================
-- Check if a product has sufficient stock in a specific hostel
-- Returns: TRUE if stock available, FALSE otherwise

-- Drop existing function if it exists (with any signature)
DROP FUNCTION IF EXISTS check_product_stock(UUID, TEXT, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS check_product_stock(TEXT, TEXT, INTEGER) CASCADE;

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
  -- Get hostel ID
  SELECT id INTO v_hostel_id
  FROM public.hostels
  WHERE name = p_hostel_name
  LIMIT 1;
  
  -- If hostel not found or "Other", check total stock
  IF v_hostel_id IS NULL OR p_hostel_name = 'Other' THEN
    SELECT stock_quantity INTO v_current_stock
    FROM public.products
    WHERE id = p_product_id;
    
    RETURN COALESCE(v_current_stock, 0) >= p_quantity;
  END IF;
  
  -- Check hostel-specific stock
  SELECT stock_quantity INTO v_current_stock
  FROM public.hostel_stock
  WHERE product_id = p_product_id
  AND hostel_id = v_hostel_id;
  
  RETURN COALESCE(v_current_stock, 0) >= p_quantity;
END;
$$;

COMMENT ON FUNCTION check_product_stock IS 'Check if product has sufficient stock in hostel';

-- ============================================================================
-- FUNCTION: get_product_hostel_stock
-- ============================================================================
-- Get current stock quantity for a product in a specific hostel
-- Returns: Stock quantity (integer)

-- Drop existing function if it exists (with any signature)
DROP FUNCTION IF EXISTS get_product_hostel_stock(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS get_product_hostel_stock(TEXT, TEXT) CASCADE;

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
  -- Get hostel ID
  SELECT id INTO v_hostel_id
  FROM public.hostels
  WHERE name = p_hostel_name
  LIMIT 1;
  
  -- If hostel not found or "Other", return total stock
  IF v_hostel_id IS NULL OR p_hostel_name = 'Other' THEN
    SELECT stock_quantity INTO v_stock
    FROM public.products
    WHERE id = p_product_id;
    
    RETURN COALESCE(v_stock, 0);
  END IF;
  
  -- Get hostel-specific stock
  SELECT stock_quantity INTO v_stock
  FROM public.hostel_stock
  WHERE product_id = p_product_id
  AND hostel_id = v_hostel_id;
  
  RETURN COALESCE(v_stock, 0);
END;
$$;

COMMENT ON FUNCTION get_product_hostel_stock IS 'Get current stock for product in hostel';

-- ============================================================================
-- FUNCTION: reserve_stock
-- ============================================================================
-- Atomically reserve stock for an order
-- Returns: TRUE if reservation successful, FALSE if insufficient stock

-- Drop existing function if it exists (with any signature)
DROP FUNCTION IF EXISTS reserve_stock(UUID, TEXT, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS reserve_stock(TEXT, TEXT, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS reserve_stock(UUID, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS reserve_stock(TEXT, INTEGER) CASCADE;

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
  -- Get hostel ID
  SELECT id INTO v_hostel_id
  FROM public.hostels
  WHERE name = p_hostel_name
  LIMIT 1;
  
  -- If hostel not found or "Other", update total stock
  IF v_hostel_id IS NULL OR p_hostel_name = 'Other' THEN
    -- Check current stock
    SELECT stock_quantity INTO v_current_stock
    FROM public.products
    WHERE id = p_product_id
    FOR UPDATE; -- Lock row for update
    
    IF COALESCE(v_current_stock, 0) < p_quantity THEN
      RETURN FALSE; -- Insufficient stock
    END IF;
    
    -- Deduct stock
    UPDATE public.products
    SET stock_quantity = stock_quantity - p_quantity,
        updated_at = NOW()
    WHERE id = p_product_id
    AND stock_quantity >= p_quantity;
    
    GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
    RETURN v_rows_affected > 0;
  END IF;
  
  -- Check hostel-specific stock
  SELECT stock_quantity INTO v_current_stock
  FROM public.hostel_stock
  WHERE product_id = p_product_id
  AND hostel_id = v_hostel_id
  FOR UPDATE; -- Lock row for update
  
  IF COALESCE(v_current_stock, 0) < p_quantity THEN
    RETURN FALSE; -- Insufficient stock
  END IF;
  
  -- Deduct hostel stock
  UPDATE public.hostel_stock
  SET stock_quantity = stock_quantity - p_quantity,
      updated_at = NOW()
  WHERE product_id = p_product_id
  AND hostel_id = v_hostel_id
  AND stock_quantity >= p_quantity;
  
  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
  RETURN v_rows_affected > 0;
END;
$$;

COMMENT ON FUNCTION reserve_stock IS 'Atomically reserve stock for order';

-- ============================================================================
-- FUNCTION: release_stock
-- ============================================================================
-- Release reserved stock (e.g., when order is cancelled)
-- Returns: TRUE if release successful

-- Drop existing function if it exists (with any signature)
DROP FUNCTION IF EXISTS release_stock(UUID, TEXT, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS release_stock(TEXT, TEXT, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS release_stock(UUID, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS release_stock(TEXT, INTEGER) CASCADE;

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
  -- Get hostel ID
  SELECT id INTO v_hostel_id
  FROM public.hostels
  WHERE name = p_hostel_name
  LIMIT 1;
  
  -- If hostel not found or "Other", update total stock
  IF v_hostel_id IS NULL OR p_hostel_name = 'Other' THEN
    UPDATE public.products
    SET stock_quantity = stock_quantity + p_quantity,
        updated_at = NOW()
    WHERE id = p_product_id;
    
    RETURN TRUE;
  END IF;
  
  -- Release hostel stock
  UPDATE public.hostel_stock
  SET stock_quantity = stock_quantity + p_quantity,
      updated_at = NOW()
  WHERE product_id = p_product_id
  AND hostel_id = v_hostel_id;
  
  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION release_stock IS 'Release reserved stock (e.g., cancelled order)';

-- ============================================================================
-- FUNCTION: validate_cart_stock
-- ============================================================================
-- Validate all items in a cart have sufficient stock
-- Returns: JSONB array of out-of-stock items

-- Drop existing function if it exists (with any signature)
DROP FUNCTION IF EXISTS validate_cart_stock(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS validate_cart_stock(TEXT, TEXT) CASCADE;

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
  -- Loop through cart items
  FOR v_cart_item IN
    SELECT 
      ci.product_id,
      ci.quantity,
      p.name as product_name
    FROM public.cart_items ci
    JOIN public.products p ON ci.product_id = p.id
    WHERE ci.user_id = p_user_id
  LOOP
    -- Check stock for this item
    v_available_stock := get_product_hostel_stock(
      v_cart_item.product_id,
      p_hostel_name
    );
    
    -- If insufficient stock, add to out-of-stock array
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

COMMENT ON FUNCTION validate_cart_stock IS 'Validate all cart items have sufficient stock';

-- ============================================================================
-- FUNCTION: get_low_stock_products
-- ============================================================================
-- Get products with low stock (below threshold)
-- Useful for admin alerts

-- Drop existing function if it exists (with any signature)
DROP FUNCTION IF EXISTS get_low_stock_products(INTEGER) CASCADE;
DROP FUNCTION IF EXISTS get_low_stock_products() CASCADE;

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
  SELECT 
    p.id as product_id,
    p.name as product_name,
    h.name as hostel_name,
    hs.stock_quantity
  FROM public.hostel_stock hs
  JOIN public.products p ON hs.product_id = p.id
  JOIN public.hostels h ON hs.hostel_id = h.id
  WHERE hs.stock_quantity <= p_threshold
  AND hs.stock_quantity > 0
  ORDER BY hs.stock_quantity ASC, p.name ASC;
END;
$$;

COMMENT ON FUNCTION get_low_stock_products IS 'Get products with low stock for alerts';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
  function_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO function_count
  FROM pg_proc
  WHERE proname IN (
    'check_product_stock',
    'get_product_hostel_stock',
    'reserve_stock',
    'release_stock',
    'validate_cart_stock',
    'get_low_stock_products'
  );
  
  RAISE NOTICE '============================================';
  RAISE NOTICE 'STOCK VALIDATION FUNCTIONS VERIFICATION';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Functions created: %/6', function_count;
  RAISE NOTICE '============================================';
  
  IF function_count = 6 THEN
    RAISE NOTICE '✅ ALL FUNCTIONS CREATED SUCCESSFULLY!';
    RAISE NOTICE '';
    RAISE NOTICE 'Available functions:';
    RAISE NOTICE '  - check_product_stock(product_id, hostel_name, quantity)';
    RAISE NOTICE '  - get_product_hostel_stock(product_id, hostel_name)';
    RAISE NOTICE '  - reserve_stock(product_id, hostel_name, quantity)';
    RAISE NOTICE '  - release_stock(product_id, hostel_name, quantity)';
    RAISE NOTICE '  - validate_cart_stock(user_id, hostel_name)';
    RAISE NOTICE '  - get_low_stock_products(threshold)';
  ELSE
    RAISE NOTICE '⚠️  SOME FUNCTIONS FAILED TO CREATE';
  END IF;
  
  RAISE NOTICE '============================================';
END $$;

-- ============================================================================
-- EXAMPLE USAGE
-- ============================================================================

/*
-- Check if product has stock
SELECT check_product_stock(
  'product-uuid-here'::UUID,
  'Mithali',
  2
);

-- Get current stock
SELECT get_product_hostel_stock(
  'product-uuid-here'::UUID,
  'Mithali'
);

-- Reserve stock for order
SELECT reserve_stock(
  'product-uuid-here'::UUID,
  'Mithali',
  2
);

-- Release stock (cancelled order)
SELECT release_stock(
  'product-uuid-here'::UUID,
  'Mithali',
  2
);

-- Validate cart
SELECT validate_cart_stock(
  'user-uuid-here'::UUID,
  'Mithali'
);

-- Get low stock products
SELECT * FROM get_low_stock_products(5);
*/

-- ============================================================================
-- DONE!
-- ============================================================================
-- Next steps:
-- 1. Restart your frontend development server
-- 2. Test stock validation by trying to add out-of-stock items to cart
-- 3. Test checkout validation with mixed stock items
-- ============================================================================
