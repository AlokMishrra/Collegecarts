-- ============================================================================
-- STEP 1: DROP ALL OLD STOCK FUNCTIONS
-- ============================================================================
-- Run this FIRST to remove all conflicting functions
-- ============================================================================

-- Drop all possible variations of reserve_stock
DROP FUNCTION IF EXISTS public.reserve_stock(uuid, text, integer) CASCADE;
DROP FUNCTION IF EXISTS public.reserve_stock(text, text, integer) CASCADE;
DROP FUNCTION IF EXISTS public.reserve_stock(uuid, integer) CASCADE;
DROP FUNCTION IF EXISTS public.reserve_stock(text, integer) CASCADE;
DROP FUNCTION IF EXISTS reserve_stock(uuid, text, integer) CASCADE;
DROP FUNCTION IF EXISTS reserve_stock(text, text, integer) CASCADE;
DROP FUNCTION IF EXISTS reserve_stock(uuid, integer) CASCADE;
DROP FUNCTION IF EXISTS reserve_stock(text, integer) CASCADE;

-- Drop all possible variations of release_stock
DROP FUNCTION IF EXISTS public.release_stock(uuid, text, integer) CASCADE;
DROP FUNCTION IF EXISTS public.release_stock(text, text, integer) CASCADE;
DROP FUNCTION IF EXISTS public.release_stock(uuid, integer) CASCADE;
DROP FUNCTION IF EXISTS public.release_stock(text, integer) CASCADE;
DROP FUNCTION IF EXISTS release_stock(uuid, text, integer) CASCADE;
DROP FUNCTION IF EXISTS release_stock(text, text, integer) CASCADE;
DROP FUNCTION IF EXISTS release_stock(uuid, integer) CASCADE;
DROP FUNCTION IF EXISTS release_stock(text, integer) CASCADE;

-- Drop all possible variations of check_product_stock
DROP FUNCTION IF EXISTS public.check_product_stock(uuid, text, integer) CASCADE;
DROP FUNCTION IF EXISTS public.check_product_stock(text, text, integer) CASCADE;
DROP FUNCTION IF EXISTS check_product_stock(uuid, text, integer) CASCADE;
DROP FUNCTION IF EXISTS check_product_stock(text, text, integer) CASCADE;

-- Drop all possible variations of get_product_hostel_stock
DROP FUNCTION IF EXISTS public.get_product_hostel_stock(uuid, text) CASCADE;
DROP FUNCTION IF EXISTS public.get_product_hostel_stock(text, text) CASCADE;
DROP FUNCTION IF EXISTS get_product_hostel_stock(uuid, text) CASCADE;
DROP FUNCTION IF EXISTS get_product_hostel_stock(text, text) CASCADE;

-- Drop all possible variations of validate_cart_stock
DROP FUNCTION IF EXISTS public.validate_cart_stock(uuid, text) CASCADE;
DROP FUNCTION IF EXISTS public.validate_cart_stock(text, text) CASCADE;
DROP FUNCTION IF EXISTS validate_cart_stock(uuid, text) CASCADE;
DROP FUNCTION IF EXISTS validate_cart_stock(text, text) CASCADE;

-- Drop all possible variations of get_low_stock_products
DROP FUNCTION IF EXISTS public.get_low_stock_products(integer) CASCADE;
DROP FUNCTION IF EXISTS public.get_low_stock_products() CASCADE;
DROP FUNCTION IF EXISTS get_low_stock_products(integer) CASCADE;
DROP FUNCTION IF EXISTS get_low_stock_products() CASCADE;

-- Verify cleanup
SELECT 
  'Functions remaining: ' || COUNT(*)::text as status
FROM pg_proc
WHERE proname IN (
  'check_product_stock',
  'get_product_hostel_stock',
  'reserve_stock',
  'release_stock',
  'validate_cart_stock',
  'get_low_stock_products'
);

-- If count is 0, you're good to proceed to STEP 2
