-- ============================================================
-- ⚠️  DEPRECATED — Use sql/inventory_system_fix.sql instead
-- This file has UUID type params but products.id is TEXT.
-- The new file fixes all type mismatches and adds hostel_id.
-- ============================================================
-- PASTE THIS ENTIRE FILE INTO SUPABASE SQL EDITOR AND RUN IT
-- Dashboard: https://supabase.com/dashboard/project/vbbdzhuzwgiipsnssmxq/sql
-- ============================================================

-- Step 1: Add reserved_stock column
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS reserved_stock integer DEFAULT 0;

-- Step 2: reserve_stock — called on ORDER PLACED
-- Checks available stock atomically and marks it reserved.
-- Does NOT deduct actual stock_quantity.
CREATE OR REPLACE FUNCTION public.reserve_stock(
  p_product_id uuid,
  p_quantity   int,
  p_hostel     text DEFAULT NULL
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total        int;
  v_reserved     int;
  v_hostel_avail int;
  v_available    int;
BEGIN
  SELECT stock_quantity, COALESCE(reserved_stock, 0)
  INTO   v_total, v_reserved
  FROM   products
  WHERE  id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Product not found');
  END IF;

  IF p_hostel IS NOT NULL AND p_hostel <> 'Other' THEN
    SELECT COALESCE((hostel_stock ->> p_hostel)::int, v_total)
    INTO   v_hostel_avail
    FROM   products
    WHERE  id = p_product_id;
    v_available := LEAST(v_total - v_reserved, v_hostel_avail);
  ELSE
    v_available := v_total - v_reserved;
  END IF;

  IF v_available < p_quantity THEN
    RETURN json_build_object(
      'success',   false,
      'error',     'Insufficient stock',
      'available', v_available
    );
  END IF;

  UPDATE products
  SET    reserved_stock = COALESCE(reserved_stock, 0) + p_quantity,
         updated_at     = NOW()
  WHERE  id = p_product_id;

  RETURN json_build_object(
    'success',   true,
    'reserved',  p_quantity,
    'available', v_available - p_quantity
  );
END;
$$;

-- Step 3: confirm_delivery — called on ORDER DELIVERED
-- Deducts total_stock, hostel_stock, and releases reservation atomically.
CREATE OR REPLACE FUNCTION public.confirm_delivery(
  p_product_id uuid,
  p_quantity   int,
  p_hostel     text DEFAULT NULL
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total       int;
  v_reserved    int;
  v_new_total   int;
  v_new_hostel  int;
  v_hostel_json jsonb;
BEGIN
  SELECT stock_quantity, COALESCE(reserved_stock, 0), hostel_stock
  INTO   v_total, v_reserved, v_hostel_json
  FROM   products
  WHERE  id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Product not found');
  END IF;

  v_new_total := GREATEST(0, v_total - p_quantity);

  IF p_hostel IS NOT NULL AND p_hostel <> 'Other' AND v_hostel_json IS NOT NULL THEN
    v_new_hostel  := GREATEST(0, COALESCE((v_hostel_json ->> p_hostel)::int, 0) - p_quantity);
    v_hostel_json := jsonb_set(v_hostel_json, ARRAY[p_hostel], to_jsonb(v_new_hostel));
  END IF;

  UPDATE products
  SET
    stock_quantity = v_new_total,
    reserved_stock = GREATEST(0, COALESCE(reserved_stock, 0) - p_quantity),
    hostel_stock   = CASE
                       WHEN p_hostel IS NOT NULL AND p_hostel <> 'Other'
                       THEN v_hostel_json
                       ELSE hostel_stock
                     END,
    is_available   = CASE WHEN v_new_total <= 0 THEN false ELSE is_available END,
    updated_at     = NOW()
  WHERE id = p_product_id;

  RETURN json_build_object('success', true, 'new_stock', v_new_total);
END;
$$;

-- Step 4: cancel_order_stock — called on ORDER CANCELLED
-- Releases reservation only. Does NOT touch actual stock_quantity.
CREATE OR REPLACE FUNCTION public.cancel_order_stock(
  p_product_id uuid,
  p_quantity   int
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE products
  SET
    reserved_stock = GREATEST(0, COALESCE(reserved_stock, 0) - p_quantity),
    is_available   = CASE WHEN stock_quantity > 0 THEN true ELSE is_available END,
    updated_at     = NOW()
  WHERE id = p_product_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Product not found');
  END IF;

  RETURN json_build_object('success', true, 'released', p_quantity);
END;
$$;

-- Step 5: Grants
GRANT EXECUTE ON FUNCTION public.reserve_stock(uuid, int, text)    TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.confirm_delivery(uuid, int, text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.cancel_order_stock(uuid, int)     TO authenticated, anon;

-- Step 6: Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- Step 7: Verify
SELECT routine_name, data_type
FROM   information_schema.routines
WHERE  routine_schema = 'public'
  AND  routine_name IN ('reserve_stock', 'confirm_delivery', 'cancel_order_stock');


-- ============================================================
-- FIX REVIEWS CASCADE DELETE
-- ============================================================
-- This allows products to be deleted even if they have reviews
-- The reviews will be automatically deleted when the product is deleted

-- Drop the existing foreign key constraints
ALTER TABLE public.reviews 
DROP CONSTRAINT IF EXISTS reviews_product_id_fkey;

ALTER TABLE public.reviews 
DROP CONSTRAINT IF EXISTS reviews_user_id_fkey;

-- Add the foreign key constraints with CASCADE delete
ALTER TABLE public.reviews 
ADD CONSTRAINT reviews_product_id_fkey 
FOREIGN KEY (product_id) 
REFERENCES public.products(id) 
ON DELETE CASCADE;

ALTER TABLE public.reviews 
ADD CONSTRAINT reviews_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES public.users(id) 
ON DELETE CASCADE;

-- Verify the constraints
SELECT 
  conname AS constraint_name,
  conrelid::regclass AS table_name,
  confrelid::regclass AS referenced_table,
  confdeltype AS on_delete_action
FROM pg_constraint
WHERE conname LIKE 'reviews_%_fkey';
