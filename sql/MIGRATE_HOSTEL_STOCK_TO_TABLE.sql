-- ============================================================================
-- MIGRATE HOSTEL STOCK FROM JSONB TO TABLE
-- ============================================================================
-- This script migrates existing hostel_stock JSONB data to hostel_stock table
-- and removes the JSONB column from products table
-- ============================================================================

-- Step 1: Migrate existing JSONB data to hostel_stock table
DO $$
DECLARE
    product_record RECORD;
    hostel_record RECORD;
    hostel_name TEXT;
    stock_qty INTEGER;
BEGIN
    -- Loop through all products that have hostel_stock JSONB data
    FOR product_record IN 
        SELECT id, hostel_stock 
        FROM products 
        WHERE hostel_stock IS NOT NULL 
          AND hostel_stock::text != '{}'::text
    LOOP
        -- Loop through each hostel in the JSONB
        FOR hostel_name, stock_qty IN 
            SELECT * FROM jsonb_each_text(product_record.hostel_stock)
        LOOP
            -- Find the hostel ID
            SELECT id INTO hostel_record
            FROM hostels
            WHERE name = hostel_name
            LIMIT 1;
            
            IF hostel_record.id IS NOT NULL THEN
                -- Insert or update hostel_stock
                INSERT INTO hostel_stock (hostel_id, product_id, stock_quantity, updated_at)
                VALUES (
                    hostel_record.id,
                    product_record.id,
                    COALESCE(stock_qty::integer, 0),
                    NOW()
                )
                ON CONFLICT (hostel_id, product_id)
                DO UPDATE SET
                    stock_quantity = COALESCE(EXCLUDED.stock_quantity, 0),
                    updated_at = NOW();
                    
                RAISE NOTICE 'Migrated: Product % - Hostel % - Stock %', 
                    product_record.id, hostel_name, stock_qty;
            ELSE
                RAISE NOTICE 'Hostel not found: %', hostel_name;
            END IF;
        END LOOP;
    END LOOP;
    
    RAISE NOTICE 'Migration completed successfully!';
END $$;

-- Step 2: Verify the migration
SELECT 
    'Total products with JSONB hostel_stock' as description,
    COUNT(*) as count
FROM products 
WHERE hostel_stock IS NOT NULL 
  AND hostel_stock::text != '{}'::text

UNION ALL

SELECT 
    'Total hostel_stock records created' as description,
    COUNT(*) as count
FROM hostel_stock;

-- Step 3: Show sample migrated data
SELECT 
    p.name as product_name,
    h.name as hostel_name,
    hs.stock_quantity,
    p.stock_quantity as total_stock
FROM hostel_stock hs
JOIN products p ON hs.product_id = p.id
JOIN hostels h ON hs.hostel_id = h.id
ORDER BY p.name, h.name
LIMIT 20;

-- Step 4: Update products.stock_quantity to match sum of hostel stocks
-- (The trigger should do this automatically, but let's ensure it)
UPDATE products p
SET stock_quantity = (
    SELECT COALESCE(SUM(hs.stock_quantity), 0)
    FROM hostel_stock hs
    WHERE hs.product_id = p.id
)
WHERE EXISTS (
    SELECT 1 FROM hostel_stock hs WHERE hs.product_id = p.id
);

-- Step 5: Drop the old hostel_stock JSONB column (OPTIONAL - uncomment if you want to remove it)
-- WARNING: This is irreversible! Make sure migration is successful first.
-- ALTER TABLE products DROP COLUMN IF EXISTS hostel_stock;

-- Verification query
SELECT 
    p.id,
    p.name,
    p.stock_quantity as total_stock,
    (SELECT SUM(hs.stock_quantity) FROM hostel_stock hs WHERE hs.product_id = p.id) as calculated_total,
    CASE 
        WHEN p.stock_quantity = (SELECT COALESCE(SUM(hs.stock_quantity), 0) FROM hostel_stock hs WHERE hs.product_id = p.id)
        THEN '✓ Match'
        ELSE '✗ Mismatch'
    END as status
FROM products p
WHERE EXISTS (SELECT 1 FROM hostel_stock hs WHERE hs.product_id = p.id)
ORDER BY p.name
LIMIT 50;

-- ============================================================================
-- NOTES
-- ============================================================================
-- 1. This script migrates data from products.hostel_stock (JSONB) to hostel_stock table
-- 2. The trigger will keep products.stock_quantity in sync going forward
-- 3. The old JSONB column is NOT dropped by default (safety measure)
-- 4. Uncomment Step 5 to drop the JSONB column after verifying migration
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '============================================';
    RAISE NOTICE 'MIGRATION COMPLETE!';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Verify the data looks correct';
    RAISE NOTICE '2. Test the website to ensure stock displays correctly';
    RAISE NOTICE '3. If everything works, uncomment Step 5 to drop old column';
    RAISE NOTICE '============================================';
END $$;
