# Test Hostel Stock - Debugging Guide

## Step 1: Check Browser Console

Open the Shop page and check the browser console for these messages:

```
[Shop] ========================================
[Shop] applyData called with X products
[Shop] Current user hostel: Tendulkar (or Mithali, etc.)
[Shop] 🔄 Enriching with hostel stock for: Tendulkar
[fetchHostelStock] ========================================
[fetchHostelStock] Fetching FRESH stock for X products
[fetchHostelStock] Hostel: Tendulkar
[fetchHostelStock] ✅ Found hostel: Tendulkar ID: <uuid>
[fetchHostelStock] ✅ Found X hostel stock records
[fetchHostelStock] Stock summary:
[fetchHostelStock]    - In stock: X
[fetchHostelStock]    - Out of stock: X
[Shop] ✅ Enrichment complete:
[Shop]    - X products IN STOCK
[Shop]    - X products OUT OF STOCK
[Shop] Sample IN STOCK products:
[Shop]    ✓ Product Name: hostel_stock=50
[Shop] Sample OUT OF STOCK products:
[Shop]    ✗ Product Name: hostel_stock=0
```

## Step 2: Check Database

Run this SQL in Supabase SQL Editor:

```sql
-- Check if hostels exist
SELECT id, name FROM hostels ORDER BY name;

-- Check if hostel_stock has data
SELECT COUNT(*) as total_records FROM hostel_stock;

-- Check stock for Tendulkar hostel
SELECT 
    h.name as hostel_name,
    p.name as product_name,
    hs.stock_quantity
FROM hostel_stock hs
JOIN hostels h ON hs.hostel_id = h.id
JOIN products p ON hs.product_id = p.id
WHERE h.name = 'Tendulkar'
ORDER BY hs.stock_quantity DESC, p.name
LIMIT 20;

-- Check stock for Mithali hostel
SELECT 
    h.name as hostel_name,
    p.name as product_name,
    hs.stock_quantity
FROM hostel_stock hs
JOIN hostels h ON hs.hostel_id = h.id
JOIN products p ON hs.product_id = p.id
WHERE h.name = 'Mithali'
ORDER BY hs.stock_quantity DESC, p.name
LIMIT 20;
```

## Step 3: Common Issues

### Issue 1: hostel_stock table is empty
**Symptom:** Console shows "No hostel stock records found"

**Solution:** Run this SQL:
```sql
-- Initialize hostel stock for all products
INSERT INTO hostel_stock (hostel_id, product_id, stock_quantity)
SELECT h.id, p.id, 0
FROM hostels h
CROSS JOIN products p
ON CONFLICT (hostel_id, product_id) DO NOTHING;
```

### Issue 2: All products show 0 stock
**Symptom:** All products show "OUT OF STOCK" even though they should have stock

**Solution:** You need to manually set stock for each hostel. Run this SQL:
```sql
-- Set stock for Mithali hostel (example: 50 units for all products)
UPDATE hostel_stock
SET stock_quantity = 50, updated_at = NOW()
WHERE hostel_id = (SELECT id FROM hostels WHERE name = 'Mithali');

-- Set stock for Tendulkar hostel (example: 0 units to test)
UPDATE hostel_stock
SET stock_quantity = 0, updated_at = NOW()
WHERE hostel_id = (SELECT id FROM hostels WHERE name = 'Tendulkar');
```

### Issue 3: Hostel not found
**Symptom:** Console shows "Hostel not found: Tendulkar"

**Solution:** Run the complete hostel setup:
```sql
-- Run the file: sql/COMPLETE_HOSTEL_SETUP.sql
```

### Issue 4: Products still show as available when they shouldn't
**Symptom:** Products with 0 stock in Tendulkar show as available

**Possible causes:**
1. **Caching**: Clear browser cache and hard refresh (Ctrl+Shift+R)
2. **Wrong hostel selected**: Check which hostel is actually selected in the UI
3. **Database not updated**: Check database directly to verify stock is actually 0
4. **Code not using hostel_stock_quantity**: Check ProductCard is using the right field

## Step 4: Verify ProductCard is Using Correct Stock

The ProductCard should be using `hostelStock` prop which comes from `getHostelStock(product)`.

Check in browser console:
1. Open React DevTools
2. Find a ProductCard component
3. Check its props - should have `hostelStock` prop
4. Verify `hostelStock` matches the database value

## Step 5: Force Refresh Test

1. Open Shop page
2. Select "Mithali" hostel
3. Note which products show as available
4. Open Supabase and set all Mithali stock to 0:
   ```sql
   UPDATE hostel_stock
   SET stock_quantity = 0
   WHERE hostel_id = (SELECT id FROM hostels WHERE name = 'Mithali');
   ```
5. Go back to Shop page
6. Hard refresh (Ctrl+Shift+R)
7. All products should now show "OUT OF STOCK"

## Step 6: Switch Hostel Test

1. Open Shop page
2. Select "Mithali" hostel (should have stock)
3. Note products are available
4. Click "Change" hostel button
5. Select "Tendulkar" hostel (should have 0 stock)
6. Products should immediately show "OUT OF STOCK"
7. Check console for enrichment messages

## Expected Console Output

When switching from Mithali to Tendulkar:

```
[Shop] Hostel changed from Mithali to Tendulkar
[Shop] Re-enriching products with new hostel stock...
[fetchHostelStock] ========================================
[fetchHostelStock] Fetching FRESH stock for 50 products
[fetchHostelStock] Hostel: Tendulkar
[fetchHostelStock] ✅ Found hostel: Tendulkar ID: <uuid>
[fetchHostelStock] ✅ Found 50 hostel stock records
[fetchHostelStock] Stock summary:
[fetchHostelStock]    - In stock: 0
[fetchHostelStock]    - Out of stock: 50
[Shop] Products re-enriched without full reload
```

## If Still Not Working

1. **Check RLS policies**: Make sure hostel_stock table allows public read access
2. **Check Supabase logs**: Look for any errors in Supabase dashboard
3. **Check network tab**: Verify the hostel_stock query is actually being made
4. **Add breakpoint**: Add `debugger;` in `enrichProductsWithHostelStock` function
5. **Check product IDs**: Verify product IDs in database match what's being queried

## Quick Fix SQL

If you just want to test quickly, run this:

```sql
-- Set Mithali to have stock
UPDATE hostel_stock
SET stock_quantity = 100
WHERE hostel_id = (SELECT id FROM hostels WHERE name = 'Mithali');

-- Set Tendulkar to have NO stock
UPDATE hostel_stock
SET stock_quantity = 0
WHERE hostel_id = (SELECT id FROM hostels WHERE name = 'Tendulkar');

-- Verify
SELECT 
    h.name,
    COUNT(*) as total_products,
    SUM(CASE WHEN hs.stock_quantity > 0 THEN 1 ELSE 0 END) as in_stock,
    SUM(CASE WHEN hs.stock_quantity = 0 THEN 1 ELSE 0 END) as out_of_stock
FROM hostel_stock hs
JOIN hostels h ON hs.hostel_id = h.id
GROUP BY h.name
ORDER BY h.name;
```

Now test:
1. Select Mithali → Should see products available
2. Select Tendulkar → Should see all products OUT OF STOCK
