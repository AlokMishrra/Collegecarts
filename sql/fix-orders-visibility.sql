-- ═══════════════════════════════════════════════════════════════════════════════
-- FIX ORDERS VISIBILITY FOR ADMIN AND DELIVERY PERSONS
-- ═══════════════════════════════════════════════════════════════════════════════
-- This script ensures that:
-- 1. Users can see their own orders
-- 2. Admins can see ALL orders
-- 3. Delivery persons can see ALL orders (for delivery management)
-- 4. Anyone can create orders (for guest checkout)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Drop all existing policies on orders table
DROP POLICY IF EXISTS "Users can read own orders" ON public.orders;
DROP POLICY IF EXISTS "Anyone can create orders" ON public.orders;
DROP POLICY IF EXISTS "Users can create orders" ON public.orders;
DROP POLICY IF EXISTS "Users can update own orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can manage all orders" ON public.orders;
DROP POLICY IF EXISTS "Public can insert orders" ON public.orders;
DROP POLICY IF EXISTS "Public can read orders" ON public.orders;
DROP POLICY IF EXISTS "Public can update orders" ON public.orders;
DROP POLICY IF EXISTS "public_all_orders" ON public.orders;

-- ═══════════════════════════════════════════════════════════════════════════════
-- CREATE NEW COMPREHENSIVE POLICIES
-- ═══════════════════════════════════════════════════════════════════════════════

-- Policy 1: Anyone can INSERT orders (for guest checkout and authenticated users)
CREATE POLICY "orders_insert_policy" 
ON public.orders 
FOR INSERT 
WITH CHECK (true);

-- Policy 2: Users can SELECT their own orders
CREATE POLICY "orders_select_own" 
ON public.orders 
FOR SELECT 
USING (auth.uid() = user_id);

-- Policy 3: Admins can SELECT all orders
CREATE POLICY "orders_select_admin" 
ON public.orders 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE users.id = auth.uid() 
    AND users.role = 'admin'
  )
);

-- Policy 4: Users with delivery role can SELECT all orders
CREATE POLICY "orders_select_delivery" 
ON public.orders 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE users.id = auth.uid() 
    AND (
      users.role = 'delivery' 
      OR users.assigned_role_ids IS NOT NULL
    )
  )
);

-- Policy 5: Users can UPDATE their own orders (for cancellation, etc.)
CREATE POLICY "orders_update_own" 
ON public.orders 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Policy 6: Admins can UPDATE all orders
CREATE POLICY "orders_update_admin" 
ON public.orders 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE users.id = auth.uid() 
    AND users.role = 'admin'
  )
);

-- Policy 7: Delivery persons can UPDATE orders (for status updates)
CREATE POLICY "orders_update_delivery" 
ON public.orders 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE users.id = auth.uid() 
    AND (
      users.role = 'delivery' 
      OR users.assigned_role_ids IS NOT NULL
    )
  )
);

-- Policy 8: Admins can DELETE orders
CREATE POLICY "orders_delete_admin" 
ON public.orders 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE users.id = auth.uid() 
    AND users.role = 'admin'
  )
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- VERIFY POLICIES
-- ═══════════════════════════════════════════════════════════════════════════════

-- Check all policies on orders table
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'orders';

-- ═══════════════════════════════════════════════════════════════════════════════
-- GRANT PERMISSIONS
-- ═══════════════════════════════════════════════════════════════════════════════

-- Ensure authenticated users can access orders table
GRANT SELECT, INSERT, UPDATE ON public.orders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO service_role;

-- ═══════════════════════════════════════════════════════════════════════════════
-- TESTING
-- ═══════════════════════════════════════════════════════════════════════════════

-- Test as regular user (should see only own orders):
-- SELECT * FROM orders WHERE user_id = auth.uid();

-- Test as admin (should see all orders):
-- SELECT * FROM orders;

-- Test as delivery person (should see all orders):
-- SELECT * FROM orders;

-- ═══════════════════════════════════════════════════════════════════════════════
