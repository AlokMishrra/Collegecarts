-- ============================================================
-- SYNC MEAL MENU ITEMS TO PRODUCTS TABLE
-- This allows meal items to be added to the same cart as groceries
-- Run this after create-meals-system.sql
-- ============================================================

INSERT INTO public.products (id, name, price, image_url, stock_quantity, is_available, description)
SELECT 
  id,
  name,
  price,
  image_url,
  999,
  is_available,
  CONCAT(UPPER(LEFT(meal_type, 1)), SUBSTRING(meal_type, 2), ' - ', calories, ' kcal')
FROM public.meal_menu_items
WHERE is_available = true
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  price = EXCLUDED.price,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  description = EXCLUDED.description;
