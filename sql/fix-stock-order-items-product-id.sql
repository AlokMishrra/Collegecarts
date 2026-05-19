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
