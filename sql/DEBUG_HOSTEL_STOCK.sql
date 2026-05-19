-- ============================================================================
-- DEBUG HOSTEL STOCK - Run this to check your data
-- ============================================================================

-- 1. Check if hostels exist
SELECT 'Hostels in database:' as info;
SELECT id, name, is_active FROM hostels ORDER BY name;

-- 2. Check if hostel_stock table has data
SELECT 'Hostel stock records:' as info;
SELECT COUNT(*) as total_records FROM hostel_stock;

-- 3. Check stock for a specific product (replace 'product-id' with actual ID)
-- Find a product ID first:
SELECT 'Sample product IDs:' as info;
SELECT id, name, stock_quantity FROM products LIMIT 5;

-- 4. Check hostel stock for products
SELECT 'Hostel stock breakdown:' as info;
SELECT 
    p.name as product_name,
    h.name as hostel_name,
    hs.stock_quantity,
    p.stock_quantity as total_stock
FROM hostel_stock hs
JOIN products p ON hs.product_id = p.id
JOIN hostels h ON hs.hostel_id = h.id
WHERE hs.stock_quantity > 0
ORDER BY p.name, h.name
LIMIT 20;

-- 5. Check if trigger exists
SELECT 'Trigger status:' as info;
SELECT 
    tgname as trigger_name,
    tgenabled as enabled
FROM pg_trigger
WHERE tgname = 'trigger_sync_hostel_stock_to_products';

-- 6. Check RLS policies
SELECT 'RLS Policies:' as info;
SELECT 
    tablename,
    policyname,
    cmd,
    qual
FROM pg_policies
WHERE tablename IN ('hostels', 'hostel_stock')
ORDER BY tablename, policyname;

-- 7. Test query that frontend uses
SELECT 'Test frontend query:' as info;
SELECT 
    hs.product_id,
    hs.stock_quantity,
    h.name as hostel_name
FROM hostel_stock hs
JOIN hostels h ON hs.hostel_id = h.id
WHERE h.name = 'Mithali'  -- Change to your hostel
AND hs.stock_quantity > 0
LIMIT 10;
