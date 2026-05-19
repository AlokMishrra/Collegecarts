# Final Fix Instructions - Hostel Stock Display Issue

## Problem
Shop page shows products as available even when they have 0 stock in the selected hostel.

## Root Cause
The `hostel_stock` table in the database likely has no data or all products have 0 stock for all hostels.

## Solution Steps

### Step 1: Initialize Hostel Stock Table

Run this SQL in Supabase SQL Editor:

```sql
-- File: sql/DEBUG_AND_FIX_HOSTEL_STOCK.sql
-- This will check and fix the hostel_stock table

-- Initialize missing records
INSERT INTO hostel_stock (hostel_id, product_id, stock_quantity)
SELECT h.id, p.id, 0
FROM hostels h
CROSS JOIN products p
ON CONFLICT (hostel_id, product_id) DO NOTHING;
```

### Step 2: Set Stock for Testing

To test the functionality, set different stock levels for different hostels:

```sql
-- Set Mithali hostel to have stock (100 units for all products)
UPDATE hostel_stock
SET stock_quantity = 100, updated_at = NOW()
WHERE hostel_id = (SELECT id FROM hostels WHERE name = 'Mithali');

-- Set Tendulkar hostel to have NO stock (0 units)
UPDATE hostel_stock
SET stock_quantity = 0, updated_at = NOW()
WHERE hostel_id = (SELECT id FROM hostels WHERE name = 'Tendulkar');

-- Set Gavaskar hostel to have some stock (50 units)
UPDATE hostel_stock
SET stock_quantity = 50, updated_at = NOW()
WHERE hostel_id = (SELECT id FROM hostels WHERE name = 'Gavaskar');

-- Set Virat hostel to have stock (75 units)
UPDATE hostel_stock
SET stock_quantity = 75, updated_at = NOW()
WHERE hostel_id = (SELECT id FROM hostels WHERE name = 'Virat');
```

### Step 3: Verify Database

```sql
-- Check stock by hostel
SELECT 
    h.name as hostel_name,
    COUNT(*) as total_products,
    SUM(CASE WHEN hs.stock_quantity > 0 THEN 1 ELSE 0 END) as in_stock,
    SUM(CASE WHEN hs.stock_quantity = 0 THEN 1 ELSE 0 END) as out_of_stock,
    AVG(hs.stock_quantity) as avg_stock
FROM hostel_stock hs
JOIN hostels h ON hs.hostel_id = h.id
GROUP BY h.name
ORDER BY h.name;
```

Expected output:
```
hostel_name | total_products | in_stock | out_of_stock | avg_stock
------------|----------------|----------|--------------|----------
Gavaskar    | 50             | 50       | 0            | 50
Mithali     | 50             | 50       | 0            | 100
Tendulkar   | 50             | 0        | 50           | 0
Virat       | 50             | 50       | 0            | 75
```

### Step 4: Test in Browser

1. **Open Shop page** (http://localhost:5173/shop)

2. **Open Browser Console** (F12)

3. **Select Mithali hostel**
   - Should see console logs showing enrichment
   - Should see products available
   - Console should show: "X products IN STOCK"

4. **Switch to Tendulkar hostel**
   - Click "Change" button
   - Select "Tendulkar"
   - Should see console logs showing re-enrichment
   - ALL products should show "OUT OF STOCK"
   - Console should show: "0 products IN STOCK, X products OUT OF STOCK"

5. **Switch to Gavaskar hostel**
   - Products should become available again
   - Console should show: "X products IN STOCK"

### Step 5: Expected Console Output

When you select a hostel, you should see:

```
[Shop] ========================================
[Shop] applyData called with 50 products
[Shop] Current user hostel: Tendulkar
[Shop] 🔄 Enriching with hostel stock for: Tendulkar
[fetchHostelStock] ========================================
[fetchHostelStock] Fetching FRESH stock for 50 products
[fetchHostelStock] Hostel: Tendulkar
[fetchHostelStock] ✅ Found hostel: Tendulkar ID: <uuid>
[fetchHostelStock] ✅ Found 50 hostel stock records
[fetchHostelStock] Stock summary:
[fetchHostelStock]    - In stock: 0
[fetchHostelStock]    - Out of stock: 50
[fetchHostelStock] ========================================
[Shop] ✅ Enrichment complete:
[Shop]    - 0 products IN STOCK
[Shop]    - 50 products OUT OF STOCK
[Shop] Sample OUT OF STOCK products:
[Shop]    ✗ Product 1: hostel_stock=0
[Shop]    ✗ Product 2: hostel_stock=0
[Shop]    ✗ Product 3: hostel_stock=0
[Shop] Setting 50 products to state
[Shop] ========================================
```

## Troubleshooting

### Issue: Console shows "No hostel stock records found"

**Solution:** Run Step 1 SQL to initialize the table.

### Issue: Console shows "Hostel not found"

**Solution:** Run the complete hostel setup:
```sql
-- Run file: sql/COMPLETE_HOSTEL_SETUP.sql
```

### Issue: Products still show as available

**Possible causes:**
1. Browser cache - Hard refresh (Ctrl+Shift+R)
2. Wrong hostel selected - Check the hostel name in the UI
3. Database not updated - Verify with Step 3 SQL
4. RLS policies blocking access - Check Supabase logs

### Issue: Page keeps reloading

This has been fixed. The page should only reload when:
- Initial page load
- Hostel stock changes in database (via Realtime, debounced 2 seconds)

It should NOT reload when:
- Switching hostels (uses in-place re-enrichment)
- Adding/removing cart items
- Window focus/visibility changes

## Production Setup

For production, you'll need to:

1. **Set actual stock levels** for each hostel based on your inventory
2. **Train employees** to update stock using the employee dashboard
3. **Monitor stock levels** regularly
4. **Set up alerts** for low stock

Example SQL for setting specific product stock:

```sql
-- Set stock for a specific product in a specific hostel
UPDATE hostel_stock
SET stock_quantity = 25, updated_at = NOW()
WHERE hostel_id = (SELECT id FROM hostels WHERE name = 'Mithali')
  AND product_id = '<product-id>';
```

## Files Modified

1. `src/pages/Shop.jsx` - Enhanced logging, optimized reloads
2. `src/utils/hostelStockHelper.js` - Enhanced logging
3. `src/components/shop/HostelSelector.jsx` - Fixed duplicate "Other"
4. `src/components/shop/ProductCard.jsx` - Fixed memo comparison

## Next Steps

1. Run the SQL in Step 1 and Step 2
2. Test in browser following Step 4
3. Verify console output matches Step 5
4. If issues persist, follow Troubleshooting section
5. See TEST_HOSTEL_STOCK.md for detailed debugging guide
