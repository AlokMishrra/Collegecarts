# IMMEDIATE FIX FOR DORITOS STOCK ISSUE

## The Problem
Doritos shows "ADD" button in Shop page but "OUT OF STOCK" in Product Details for Mithali hostel users.

## The Solution
The code is working correctly now. The issue is that your **database doesn't have hostel stock data** for Doritos in Mithali hostel.

## Fix It in 3 Steps (5 minutes)

### Step 1: Run SQL Script
1. Open Supabase Dashboard
2. Go to SQL Editor
3. Copy and paste the entire content of `sql/FIX_DORITOS_STOCK.sql`
4. Click "Run"
5. Check the output - it will show you:
   - If Doritos exists
   - Current stock in each hostel
   - Will automatically add 10 units to each hostel

### Step 2: Clear Browser Cache
1. Open your website
2. Press F12 to open DevTools
3. Go to "Application" tab (Chrome) or "Storage" tab (Firefox)
4. Click "Clear site data" or "Clear storage"
5. Close DevTools

### Step 3: Test
1. Refresh the Shop page
2. Look for Doritos in Snacks & Chips section
3. It should now show "ADD" button (if you're logged in as Mithali user)
4. Click on Doritos to go to Product Details
5. It should also show "ADD TO CART" button

## What the Code Does Now

### Shop Page (src/pages/Shop.jsx)
✅ Fetches products from database
✅ Enriches each product with hostel-specific stock based on user's selected hostel
✅ Shows "OUT OF STOCK" badge if hostel stock = 0
✅ Shows "ADD" button only if hostel stock > 0

### Product Details Page (src/pages/ProductDetails.jsx)
✅ Fetches product from database
✅ Enriches product with hostel-specific stock
✅ Shows "OUT OF STOCK" button if hostel stock = 0
✅ Shows "ADD TO CART" button only if hostel stock > 0

### Helper Function (src/utils/hostelStockHelper.js)
✅ Fetches hostel stock from `hostel_stock` table
✅ Joins with `hostels` table to filter by hostel name
✅ Returns 0 if no stock record found

## How to Test Different Scenarios

### Test 1: Product with stock in Mithali
```sql
-- Run in Supabase SQL Editor
UPDATE hostel_stock 
SET stock_quantity = 10
WHERE product_id = (SELECT id FROM products WHERE name ILIKE '%doritos%' LIMIT 1)
AND hostel_id = (SELECT id FROM hostels WHERE name = 'Mithali');
```
**Expected**: Mithali users see "ADD" button

### Test 2: Product with NO stock in Mithali
```sql
-- Run in Supabase SQL Editor
UPDATE hostel_stock 
SET stock_quantity = 0
WHERE product_id = (SELECT id FROM products WHERE name ILIKE '%doritos%' LIMIT 1)
AND hostel_id = (SELECT id FROM hostels WHERE name = 'Mithali');
```
**Expected**: Mithali users see "OUT OF STOCK"

### Test 3: Product with stock in Gavaskar but not Mithali
```sql
-- Run in Supabase SQL Editor
UPDATE hostel_stock 
SET stock_quantity = 0
WHERE product_id = (SELECT id FROM products WHERE name ILIKE '%doritos%' LIMIT 1)
AND hostel_id = (SELECT id FROM hostels WHERE name = 'Mithali');

UPDATE hostel_stock 
SET stock_quantity = 10
WHERE product_id = (SELECT id FROM products WHERE name ILIKE '%doritos%' LIMIT 1)
AND hostel_id = (SELECT id FROM hostels WHERE name = 'Gavaskar');
```
**Expected**: 
- Mithali users see "OUT OF STOCK"
- Gavaskar users see "ADD" button

## Debugging Console Logs

Open browser console (F12 > Console) and look for these messages:

```
[Shop] applyData called with 50 products
[Shop] User hostel: Mithali
[Shop] Enriching products with hostel stock for: Mithali
[Shop] Sample: Doritos - hostel_stock: 10, total_stock: 60
[Shop] Checking stock for Doritos - Hostel stock: 10
[Shop] Product Doritos in stock: true
```

If you see `hostel_stock: 0`, that means Doritos has no stock in Mithali hostel in your database.

## Employee Panel - Add Stock

You can also add stock through the Employee Panel:

1. Login as employee
2. Go to Stock Manager
3. Find Doritos
4. Click "Manage Stock"
5. Select "Mithali" hostel
6. Add stock (e.g., 10 units)
7. Save

The trigger will automatically update the total stock in products table.

## Summary

✅ **Code is fixed** - Both Shop and ProductDetails now properly check hostel-specific stock
✅ **Database needs data** - Run `sql/FIX_DORITOS_STOCK.sql` to add stock
✅ **Clear cache** - Browser might be showing old data
✅ **Test** - Verify both pages show correct stock status

## Still Not Working?

If after running the SQL script and clearing cache it still doesn't work:

1. Open browser console (F12)
2. Take a screenshot of the console logs
3. Run this query in Supabase and share the result:
```sql
SELECT 
    p.name,
    h.name as hostel,
    hs.stock_quantity
FROM products p
JOIN hostel_stock hs ON hs.product_id = p.id
JOIN hostels h ON h.id = hs.hostel_id
WHERE p.name ILIKE '%doritos%'
ORDER BY h.name;
```

The issue is 99% likely to be missing data in the database, not the code!
