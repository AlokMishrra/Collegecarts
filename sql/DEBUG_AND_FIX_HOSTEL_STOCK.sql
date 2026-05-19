-- ============================================================================
-- DEBUG AND FIX HOSTEL STOCK ISSUES
-- ============================================================================
-- This script will help you debug and fix hostel stock display issues
-- Run this in Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- STEP 1: CHECK HOSTELS TABLE
-- ============================================================================
SELECT 
    '=== HOSTELS TABLE ===' as section,
    id,
    name,
    code,
    is_active
FROM hostels
ORDER BY display_order;

-- ============================================================================
-- STEP 2: CHECK HOSTEL_STOCK TABLE
-- ============================================================================
-- Count total records
SELECT 
    '=== HOSTEL STOCK SUMMARY ===' as section,
    COUNT(*) as total_records,
    COUNT(DISTINCT hostel_id) as unique_hostels,
    COUNT(DISTINCT product_id) as unique_products
FROM hostel_stock;

-- ============================================================================
-- STEP 3: CHECK STOCK BY HOSTEL
-- ============================================================================
SELECT 
    '=== STOCK BY HOSTEL ===' as section,
    h.name as hostel_name,
    COUNT(hs.id) as total_products,
    SUM(CASE WHEN hs.stock_quantity > 0 THEN 1 ELSE 0 END) as in_stock_products,
    SUM(CASE WHEN hs.stock_quantity = 0 THEN 1 ELSE 0 END) as out_of_stock_products,
    SUM(hs.stock_quantity) as total_stock_quantity
FROM hostels h
LEFT JOIN hostel_stock hs ON h.id = hs.hostel_id
GROUP BY h.id, h.name
ORDER BY h.name;

-- ============================================================================
-- STEP 4: CHECK SPECIFIC PRODUCTS (Tendulkar vs Mithali)
-- ============================================================================
-- Show stock for all products in Tendulkar hostel
SELECT 
    '=== TENDULKAR HOSTEL STOCK ===' as section,
    p.name as product_name,
    p.id as product_id,
    hs.stock_quantity as tendulkar_stock,
    p.stock_quantity as total_stock
FROM products p
LEFT JOIN hostel_stock hs ON p.id = hs.product_id
LEFT JOIN hostels h ON hs.hostel_id = h.id AND h.name = 'Tendulkar'
ORDER BY p.name
LIMIT 20;

-- Show stock for all products in Mithali hostel
SELECT 
    '=== MITHALI HOSTEL STOCK ===' as section,
    p.name as product_name,
    p.id as product_id,
    hs.stock_quantity as mithali_stock,
    p.stock_quantity as total_stock
FROM products p
LEFT JOIN hostel_stock hs ON p.id = hs.product_id
LEFT JOIN hostels h ON hs.hostel_id = h.id AND h.name = 'Mithali'
ORDER BY p.name
LIMIT 20;

-- ============================================================================
-- STEP 5: FIND PRODUCTS WITH MISMATCHED STOCK
-- ============================================================================
-- Products that have stock in Mithali but not in Tendulkar
SELECT 
    '=== PRODUCTS IN MITHALI BUT NOT TENDULKAR ===' as section,
    p.name as product_name,
    mithali.stock_quantity as mithali_stock,
    tendulkar.stock_quantity as tendulkar_stock
FROM products p
LEFT JOIN (
    SELECT hs.product_id, hs.stock_quantity
    FROM hostel_stock hs
    JOIN hostels h ON hs.hostel_id = h.id
    WHERE h.name = 'Mithali'
) mithali ON p.id = mithali.product_id
LEFT JOIN (
    SELECT hs.product_id, hs.stock_quantity
    FROM hostel_stock hs
    JOIN hostels h ON hs.hostel_id = h.id
    WHERE h.name = 'Tendulkar'
) tendulkar ON p.id = tendulkar.product_id
WHERE COALESCE(mithali.stock_quantity, 0) > 0 
  AND COALESCE(tendulkar.stock_quantity, 0) = 0
ORDER BY p.name
LIMIT 20;

-- ============================================================================
-- STEP 6: CHECK IF HOSTEL_STOCK TABLE IS EMPTY
-- ============================================================================
DO $$
DECLARE
    stock_count INTEGER;
    hostel_count INTEGER;
    product_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO stock_count FROM hostel_stock;
    SELECT COUNT(*) INTO hostel_count FROM hostels;
    SELECT COUNT(*) INTO product_count FROM products;
    
    RAISE NOTICE '============================================';
    RAISE NOTICE 'HOSTEL STOCK DIAGNOSTIC';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Total hostels: %', hostel_count;
    RAISE NOTICE 'Total products: %', product_count;
    RAISE NOTICE 'Total hostel_stock records: %', stock_count;
    RAISE NOTICE 'Expected records: %', hostel_count * product_count;
    
    IF stock_count = 0 THEN
        RAISE NOTICE '============================================';
        RAISE NOTICE 'WARNING: hostel_stock table is EMPTY!';
        RAISE NOTICE 'This is why stock is not showing correctly.';
        RAISE NOTICE 'Run the FIX section below to initialize stock.';
        RAISE NOTICE '============================================';
    ELSIF stock_count < (hostel_count * product_count) THEN
        RAISE NOTICE '============================================';
        RAISE NOTICE 'WARNING: hostel_stock table is INCOMPLETE!';
        RAISE NOTICE 'Missing % records', (hostel_count * product_count) - stock_count;
        RAISE NOTICE 'Run the FIX section below to complete stock.';
        RAISE NOTICE '============================================';
    ELSE
        RAISE NOTICE '============================================';
        RAISE NOTICE 'SUCCESS: hostel_stock table is complete!';
        RAISE NOTICE '============================================';
    END IF;
END $$;

-- ============================================================================
-- STEP 7: FIX - INITIALIZE MISSING HOSTEL STOCK RECORDS
-- ============================================================================
-- This will create hostel_stock records for all products in all hostels
-- Starting with 0 stock (you can adjust manually later)

INSERT INTO hostel_stock (hostel_id, product_id, stock_quantity)
SELECT h.id, p.id, 0
FROM hostels h
CROSS JOIN products p
ON CONFLICT (hostel_id, product_id) DO NOTHING;

-- ============================================================================
-- STEP 8: OPTIONAL - SET SAMPLE STOCK FOR TESTING
-- ============================================================================
-- Uncomment and modify this section to set stock for specific hostels

-- Set stock for Mithali hostel (example: 50 units for all products)
-- UPDATE hostel_stock
-- SET stock_quantity = 50, updated_at = NOW()
-- WHERE hostel_id = (SELECT id FROM hostels WHERE name = 'Mithali');

-- Set stock for Tendulkar hostel (example: 0 units for all products)
-- UPDATE hostel_stock
-- SET stock_quantity = 0, updated_at = NOW()
-- WHERE hostel_id = (SELECT id FROM hostels WHERE name = 'Tendulkar');

-- ============================================================================
-- STEP 9: VERIFY FIX
-- ============================================================================
SELECT 
    '=== VERIFICATION AFTER FIX ===' as section,
    h.name as hostel_name,
    COUNT(hs.id) as total_products,
    SUM(CASE WHEN hs.stock_quantity > 0 THEN 1 ELSE 0 END) as in_stock_products,
    SUM(CASE WHEN hs.stock_quantity = 0 THEN 1 ELSE 0 END) as out_of_stock_products
FROM hostels h
LEFT JOIN hostel_stock hs ON h.id = hs.hostel_id
GROUP BY h.id, h.name
ORDER BY h.name;

-- ============================================================================
-- STEP 10: CHECK RLS POLICIES
-- ============================================================================
SELECT 
    '=== RLS POLICIES ===' as section,
    schemaname,
    tablename,
    policyname,
    permissive,
    cmd,
    qual as using_expression
FROM pg_policies
WHERE tablename IN ('hostels', 'hostel_stock')
ORDER BY tablename, policyname;

-- ============================================================================
-- FINAL NOTES
-- ============================================================================
-- After running this script:
-- 1. Check the output to see if hostel_stock table was empty
-- 2. The FIX section will initialize all missing records
-- 3. You may need to manually set stock quantities for each hostel
-- 4. Refresh your Shop page to see the changes
-- ============================================================================
