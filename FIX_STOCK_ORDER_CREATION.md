# Fix Stock Order Creation Issue

## Problem
When creating stock orders, the system throws an error:
```
invalid input syntax for type uuid: "694c0d337fae4b16111d6a2a"
```

This happens because:
1. The `products` table uses `TEXT` for IDs
2. The `employee_stock_order_items` table expects `UUID` for `product_id`
3. There's a data type mismatch

## Solution

### Step 1: Run SQL Fix
Run the following SQL in your Supabase SQL Editor:

```sql
-- Fix employee_stock_order_items to use TEXT for product_id instead of UUID
-- This matches the products table which uses TEXT for IDs

-- Drop the existing index
DROP INDEX IF EXISTS idx_employee_stock_order_items_product;

-- Alter the column type from UUID to TEXT
ALTER TABLE public.employee_stock_order_items 
  ALTER COLUMN product_id TYPE TEXT;

-- Recreate the index
CREATE INDEX idx_employee_stock_order_items_product 
  ON public.employee_stock_order_items(product_id);

-- Verify the change
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'employee_stock_order_items' 
  AND column_name = 'product_id';
```

Or simply run the file:
```bash
sql/fix-stock-order-items-product-id.sql
```

### Step 2: UI Improvements Made
The following UI improvements have been implemented:

1. **"Added" Badge**: When a product is added to the order, the button changes to show:
   - A green "Added (quantity)" badge
   - A "+" button to quickly add more of the same item

2. **Visual Feedback**: 
   - Products already in the cart show a different state
   - Quantity is displayed in the badge
   - Easy to add more with the "+" button

### Step 3: Test
1. Navigate to the employee stock order creation page
2. Add products to the order
3. Verify the "Add" button changes to "Added (1)" badge
4. Click the "+" button to add more quantity
5. Submit the order successfully

## Files Modified
- `src/pages/employee/CreateStockOrder.jsx` - Added "Added" state for products
- `sql/fix-stock-order-items-product-id.sql` - SQL fix for UUID/TEXT mismatch

## Status
✅ UI Fixed - "Added" badge now shows when items are in cart
⚠️ Database Fix Required - Run the SQL script above
