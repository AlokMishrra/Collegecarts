-- ============================================================================
-- COMPLETE STOCK SYNC SETUP - ALL IN ONE
-- ============================================================================
-- This script does everything in one go:
-- 1. Removes conflicting functions
-- 2. Enables realtime
-- 3. Creates new stock validation functions
--
-- Run this ONCE in Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- PART 1: CLEANUP - Remove conflicting functions
-- ============================================================================

DO $$
BEGIN
  -- Drop all existing stock-related functions
  DROP FUNCTION IF EXISTS reserve_stock(UUID, TEXT, INTEGER) CASCADE;
  DROP FUNCTION IF EXISTS reserve_stock(TEXT, TEXT, INTEGER) CASCADE;
  DROP FUNCTION IF EXISTS reserve_stock(UUID, INTEGER) CASCADE;
  DROP FUNCTION IF EXISTS reserve_stock(TEXT, INTEGER) CASCADE;
  
  DROP FUNCTION IF EXISTS release_stock(UUID, TEXT, INTEGER) CASCADE;
  DROP FUNCTION IF EXISTS release_stock(TEXT, TEXT, INTEGER) CASCADE;
  DROP FUNCTION IF EXISTS release_stock(UUID, INTEGER) CASCADE;
  DROP FUNCTION IF EXISTS release_stock(TEXT, INTEGER) CASCADE;
  
  DROP FUNCTION IF EXISTS check_product_stock(UUID, TEXT, INTEGER) CASCADE;
  DROP FUNCTION IF EXISTS check_product_stock(TEXT, TEXT, INTEGER) CASCADE;
  
  DROP FUNCTION IF EXISTS get_product_hostel_stock(UUID, TEXT) CASCADE;
  DROP FUNCTION IF EXISTS get_product_hostel_stock(TEXT, TEXT) CASCADE;
  
  DROP FUNCTION IF EXISTS validate_cart_stock(UUID, TEXT) CASCADE;
  DROP FUNCTION IF EXISTS validate_cart_stock(TEXT, TEXT) CASCADE;
  
  DROP FUNCTION IF EXISTS get_low_stock_products(INTEGER) CASCADE;
  DROP FUNCTION IF EXISTS get_low_stock_products() CASCADE;
  
  RAISE NOTICE '✅ Cleaned up old functions';
END $$;

-- ============================================================================
-- PART 2: ENABLE REALTIME
-- ============================================================================

DO $$
BEGIN
  -- Add hostel_stock to realtime publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'hostel_stock'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.hostel_stock;
    RAISE NOTICE '✅ Added hostel_stock to realtime publication';
  ELSE
    RAISE NOTICE 'ℹ️  hostel_stock already in realtime publication';
  END IF;
END $$;

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_hostel_stock_updated_at ON public.hostel_stock;

CREATE TRIGGER update_hostel_stock_updated_at
    BEFORE UPDATE ON public.hostel_stock
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_hostel_stock_product_id ON public.hostel_stock(product_id);
CREATE INDEX IF NOT EXISTS idx_hostel_stock_hostel_id ON public.hostel_stock(hostel_id);
CREATE INDEX IF NOT EXISTS idx_hostel_stock_product_hostel ON public.hostel_stock(product_id, hostel_id);
CREATE INDEX IF NOT EXISTS idx_hostel_stock_quantity ON public.hostel_stock(stock_quantity);

RAISE NOTICE '✅ Realtime and indexes configured';

-- ============================================================================
-- PART 3: CREATE STOCK VALIDATION FUNCTIONS
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

RAISE NOTICE '✅ Created all 6 stock validation functions';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
  realtime_enabled BOOLEAN;
  function_count INTEGER;
  index_count INTEGER;
BEGIN
  -- Check realtime
  SELECT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'hostel_stock'
  ) INTO realtime_enabled;
  
  -- Count functions
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
  
  -- Count indexes
  SELECT COUNT(*) INTO index_count
  FROM pg_indexes
  WHERE tablename = 'hostel_stock' AND indexname LIKE 'idx_hostel_stock%';
  
  RAISE NOTICE '============================================';
  RAISE NOTICE '✅ STOCK SYNC SETUP COMPLETE!';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Realtime enabled: %', realtime_enabled;
  RAISE NOTICE 'Functions created: %/6', function_count;
  RAISE NOTICE 'Indexes created: %/4', index_count;
  RAISE NOTICE '============================================';
  
  IF realtime_enabled AND function_count = 6 AND index_count >= 4 THEN
    RAISE NOTICE '🎉 ALL CHECKS PASSED!';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Restart your frontend: npm run dev';
    RAISE NOTICE '2. Test realtime updates';
    RAISE NOTICE '3. Check console for: [Shop] ✅ Realtime subscription active';
  ELSE
    RAISE NOTICE '⚠️  SOME CHECKS FAILED - Review output above';
  END IF;
  
  RAISE NOTICE '============================================';
END $$;

-- ============================================================================
-- DONE!
-- ============================================================================
