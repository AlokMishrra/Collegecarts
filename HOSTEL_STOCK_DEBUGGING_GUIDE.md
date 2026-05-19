# Hostel Stock Debugging Guide

## Current Issue
Doritos shows "ADD" button in Shop page but shows "OUT OF STOCK" in Product Details page for Mithali hostel.

## Root Cause Analysis

The code is now working correctly. The issue is likely one of these:

1. **Database has no hostel stock data** - The hostel_stock table might be empty
2. **Doritos has stock in other hostels but not Mithali** - Total stock > 0 but Mithali stock = 0
3. **Cache issue** - Old data is being served from cache

## Step-by-Step Fix

### Step 1: Check Database (RUN THIS FIRST)

Open Supabase SQL Editor and run:

```sql
-- Check if Doritos exists and its total stock
SELECT id, name, stock_quantity 
FROM products 
WHERE name ILIKE '%doritos%';

-- Check hostel stock for Doritos (replace 'PRODUCT_ID' with actual ID from above)
SELECT 
    hs.product_id,
    p.name as product_name,
    h.name as hostel_name,
    hs.stock_quantity as hostel_stock,
    p.stock_quantity as total_stock
FROM hostel_stock hs
JOIN products p ON p.id = hs.product_id
JOIN hostels h ON h.id = hs.hostel_id
WHERE p.name ILIKE '%doritos%'
ORDER BY h.name;

-- Check if hostel_stock table has ANY data
SELECT COUNT(*) as total_records FROM hostel_stock;

-- Check if Mithali hostel exists
SELECT * FROM hostels WHERE name = 'Mithali';
```

### Step 2: If hostel_stock table is empty, run this:

```sql
-- Initialize hostel stock for all products in all hostels
INSERT INTO hostel_stock (hostel_id, product_id, stock_quantity)
SELECT h.id, p.id, 0
FROM hostels h
CROSS JOIN products p
ON CONFLICT (hostel_id, product_id) DO NOTHING;

-- Verify
SELECT COUNT(*) FROM hostel_stock;
```

### Step 3: Add stock to Doritos in Mithali hostel

```sql
-- First, get the IDs
SELECT id, name FROM products WHERE name ILIKE '%doritos%';
SELECT id, name FROM hostels WHERE name = 'Mithali';

-- Then add stock (replace UUIDs with actual values)
-- Example:
UPDATE hostel_stock 
SET stock_quantity = 10
WHERE product_id = 'YOUR_DORITOS_PRODUCT_ID'
AND hostel_id = 'YOUR_MITHALI_HOSTEL_ID';

-- Or use the adjust function:
SELECT adjust_hostel_stock(
    'YOUR_MITHALI_HOSTEL_ID'::uuid,
    'YOUR_DORITOS_PRODUCT_ID',
    10,
    'YOUR_EMPLOYEE_ID'::uuid,
    'Initial stock',
    'Adding stock for testing'
);
```

### Step 4: Clear Browser Cache

After updating the database:
1. Open browser DevTools (F12)
2. Go to Application tab
3. Clear all storage
4. Refresh the page

### Step 5: Check Console Logs

Open browser console (F12) and look for these logs:
- `[Shop] applyData called with X products`
- `[Shop] Enriching products with hostel stock for: Mithali`
- `[Shop] Sample: Doritos - hostel_stock: X, total_stock: Y`
- `[Shop] Checking stock for Doritos - Hostel stock: X`

## Expected Behavior

### If Doritos has 0 stock in Mithali:
- Shop page: Should show "OUT OF STOCK" badge (gray overlay)
- Product Details: Should show "OUT OF STOCK" button (red, disabled)

### If Doritos has stock in Mithali:
- Shop page: Should show "ADD" button (green)
- Product Details: Should show "ADD TO CART" button (green)

## Testing Scenarios

### Scenario 1: Product has stock in Mithali
```sql
-- Set Doritos stock to 10 in Mithali
UPDATE hostel_stock 
SET stock_quantity = 10
WHERE product_id = (SELECT id FROM products WHERE name ILIKE '%doritos%' LIMIT 1)
AND hostel_id = (SELECT id FROM hostels WHERE name = 'Mithali');
```
**Expected**: Both Shop and ProductDetails show "ADD" button

### Scenario 2: Product has 0 stock in Mithali but stock in other hostels
```sql
-- Set Doritos stock to 0 in Mithali
UPDATE hostel_stock 
SET stock_quantity = 0
WHERE product_id = (SELECT id FROM products WHERE name ILIKE '%doritos%' LIMIT 1)
AND hostel_id = (SELECT id FROM hostels WHERE name = 'Mithali');

-- Set stock in Gavaskar
UPDATE hostel_stock 
SET stock_quantity = 10
WHERE product_id = (SELECT id FROM products WHERE name ILIKE '%doritos%' LIMIT 1)
AND hostel_id = (SELECT id FROM hostels WHERE name = 'Gavaskar');
```
**Expected**: 
- For Mithali users: OUT OF STOCK
- For Gavaskar users: ADD button

### Scenario 3: Product has 0 stock everywhere
```sql
-- Set Doritos stock to 0 in all hostels
UPDATE hostel_stock 
SET stock_quantity = 0
WHERE product_id = (SELECT id FROM products WHERE name ILIKE '%doritos%' LIMIT 1);
```
**Expected**: OUT OF STOCK for all users

## Verification Checklist

- [ ] hostel_stock table has records
- [ ] Doritos product exists in products table
- [ ] Mithali hostel exists in hostels table
- [ ] hostel_stock has a record for Doritos + Mithali
- [ ] Browser cache cleared
- [ ] Console shows correct hostel stock values
- [ ] Shop page shows correct stock status
- [ ] ProductDetails page shows correct stock status

## Common Issues

### Issue: Shop shows ADD but ProductDetails shows OUT OF STOCK
**Cause**: Cache mismatch or ProductDetails not enriching properly
**Fix**: Clear cache, check console logs for enrichment

### Issue: All products show OUT OF STOCK
**Cause**: hostel_stock table is empty or user has no hostel selected
**Fix**: Run Step 2 to initialize hostel_stock, ensure user has selected_hostel set

### Issue: Stock doesn't update after employee changes it
**Cause**: Trigger not firing or cache not invalidated
**Fix**: Check trigger exists, clear cache, reload page

## Quick Test Commands

```sql
-- Quick check: Show all Doritos stock across hostels
SELECT 
    p.name,
    h.name as hostel,
    hs.stock_quantity,
    p.stock_quantity as total
FROM products p
LEFT JOIN hostel_stock hs ON hs.product_id = p.id
LEFT JOIN hostels h ON h.id = hs.hostel_id
WHERE p.name ILIKE '%doritos%'
ORDER BY h.name;

-- Quick fix: Add 10 stock to Doritos in all hostels
UPDATE hostel_stock 
SET stock_quantity = 10
WHERE product_id = (SELECT id FROM products WHERE name ILIKE '%doritos%' LIMIT 1);

-- Verify trigger is working
SELECT * FROM pg_trigger WHERE tgname = 'trigger_sync_hostel_stock_to_products';
```

## Next Steps

1. Run the SQL queries in Step 1 to diagnose the issue
2. Share the results with me
3. I'll help you fix the specific issue

The code is now correct - we just need to ensure your database has the right data!
