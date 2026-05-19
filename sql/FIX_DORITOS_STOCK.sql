-- ============================================================================
-- FIX DORITOS STOCK ISSUE
-- ============================================================================
-- This script will diagnose and fix the Doritos stock issue
-- Run this in Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- STEP 1: DIAGNOSE THE ISSUE
-- ============================================================================

-- Check if Doritos exists
SELECT 
    '1. Doritos Product Info' as step,
    id, 
    name, 
    stock_quantity as total_stock,
    is_available
FROM products 
WHERE name ILIKE '%doritos%';

-- Check all hostels
SELECT 
    '2. All Hostels' as step,
    id,
    name,
    is_active
FROM hostels
ORDER BY display_order;

-- Check Doritos stock in all hostels
SELECT 
    '3. Doritos Stock by Hostel' as step,
    h.name as hostel_name,
    hs.stock_quantity as hostel_stock,
    p.stock_quantity as total_stock,
    hs.id as hostel_stock_id
FROM products p
LEFT JOIN hostel_stock hs ON hs.product_id = p.id
LEFT JOIN hostels h ON h.id = hs.hostel_id
WHERE p.name ILIKE '%doritos%'
ORDER BY h.name;

-- Check total records in hostel_stock
SELECT 
    '4. Total Hostel Stock Records' as step,
    COUNT(*) as total_records
FROM hostel_stock;

-- ============================================================================
-- STEP 2: FIX THE ISSUE
-- ============================================================================

-- If hostel_stock table is empty, initialize it
DO $$
DECLARE
    record_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO record_count FROM hostel_stock;
    
    IF record_count = 0 THEN
        RAISE NOTICE 'Initializing hostel_stock table...';
        
        INSERT INTO hostel_stock (hostel_id, product_id, stock_quantity)
        SELECT h.id, p.id, 0
        FROM hostels h
        CROSS JOIN products p
        ON CONFLICT (hostel_id, product_id) DO NOTHING;
        
        RAISE NOTICE 'Initialized % records', (SELECT COUNT(*) FROM hostel_stock);
    ELSE
        RAISE NOTICE 'hostel_stock table already has % records', record_count;
    END IF;
END $$;

-- Add stock to Doritos in all hostels (10 units each)
DO $$
DECLARE
    doritos_id TEXT;
    updated_count INTEGER := 0;
BEGIN
    -- Get Doritos product ID
    SELECT id INTO doritos_id 
    FROM products 
    WHERE name ILIKE '%doritos%' 
    LIMIT 1;
    
    IF doritos_id IS NULL THEN
        RAISE NOTICE 'Doritos product not found!';
    ELSE
        RAISE NOTICE 'Found Doritos with ID: %', doritos_id;
        
        -- Update stock in all hostels
        UPDATE hostel_stock 
        SET stock_quantity = 10,
            last_restocked_at = NOW(),
            updated_at = NOW()
        WHERE product_id = doritos_id;
        
        GET DIAGNOSTICS updated_count = ROW_COUNT;
        RAISE NOTICE 'Updated % hostel stock records for Doritos', updated_count;
        
        -- The trigger will automatically update products.stock_quantity
        RAISE NOTICE 'Trigger will sync total stock automatically';
    END IF;
END $$;

-- ============================================================================
-- STEP 3: VERIFY THE FIX
-- ============================================================================

-- Check Doritos stock again
SELECT 
    '5. Doritos Stock After Fix' as step,
    h.name as hostel_name,
    hs.stock_quantity as hostel_stock,
    p.stock_quantity as total_stock
FROM products p
LEFT JOIN hostel_stock hs ON hs.product_id = p.id
LEFT JOIN hostels h ON h.id = hs.hostel_id
WHERE p.name ILIKE '%doritos%'
ORDER BY h.name;

-- Check if trigger exists
SELECT 
    '6. Trigger Status' as step,
    tgname as trigger_name,
    tgenabled as enabled
FROM pg_trigger 
WHERE tgname = 'trigger_sync_hostel_stock_to_products';

-- ============================================================================
-- STEP 4: TEST SPECIFIC HOSTEL
-- ============================================================================

-- Check Mithali hostel specifically
SELECT 
    '7. Mithali Hostel Stock for Doritos' as step,
    p.name as product_name,
    h.name as hostel_name,
    hs.stock_quantity as hostel_stock,
    p.stock_quantity as total_stock,
    CASE 
        WHEN hs.stock_quantity > 0 THEN 'IN STOCK'
        ELSE 'OUT OF STOCK'
    END as status
FROM products p
JOIN hostel_stock hs ON hs.product_id = p.id
JOIN hostels h ON h.id = hs.hostel_id
WHERE p.name ILIKE '%doritos%'
AND h.name = 'Mithali';

-- ============================================================================
-- OPTIONAL: Set custom stock for specific hostel
-- ============================================================================

-- Uncomment and modify this to set specific stock for Mithali
/*
UPDATE hostel_stock 
SET stock_quantity = 15,  -- Change this number
    last_restocked_at = NOW(),
    updated_at = NOW()
WHERE product_id = (SELECT id FROM products WHERE name ILIKE '%doritos%' LIMIT 1)
AND hostel_id = (SELECT id FROM hostels WHERE name = 'Mithali');
*/

-- ============================================================================
-- FINAL SUMMARY
-- ============================================================================

SELECT 
    '8. FINAL SUMMARY' as step,
    (SELECT COUNT(*) FROM products WHERE name ILIKE '%doritos%') as doritos_products,
    (SELECT COUNT(*) FROM hostels WHERE is_active = true) as active_hostels,
    (SELECT COUNT(*) FROM hostel_stock WHERE product_id IN (SELECT id FROM products WHERE name ILIKE '%doritos%')) as doritos_hostel_records,
    (SELECT SUM(stock_quantity) FROM hostel_stock WHERE product_id IN (SELECT id FROM products WHERE name ILIKE '%doritos%')) as total_doritos_stock,
    (SELECT stock_quantity FROM products WHERE name ILIKE '%doritos%' LIMIT 1) as doritos_total_stock_in_products_table;

RAISE NOTICE '============================================';
RAISE NOTICE 'FIX COMPLETE!';
RAISE NOTICE '============================================';
RAISE NOTICE 'Next steps:';
RAISE NOTICE '1. Clear browser cache (F12 > Application > Clear storage)';
RAISE NOTICE '2. Refresh the Shop page';
RAISE NOTICE '3. Check console logs for [Shop] messages';
RAISE NOTICE '4. Verify Doritos shows correct stock status';
RAISE NOTICE '============================================';
