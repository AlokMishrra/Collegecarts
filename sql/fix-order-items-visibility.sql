-- ═══════════════════════════════════════════════════════════════════════════════
-- FIX ORDER_ITEMS VISIBILITY FOR ADMIN AND DELIVERY PERSONS
-- ═══════════════════════════════════════════════════════════════════════════════

-- Drop all existing policies on order_items table
DROP POLICY IF EXISTS "Users can read own order items" ON public.order_items;
DROP POLICY IF EXISTS "Anyone can create order items" ON public.order_items;
DROP POLICY IF EXISTS "Users can create order items" ON public.order_items;
DROP POLICY IF EXISTS "Users can update own order items" ON public.order_items;
DROP POLICY IF EXISTS "Admins can manage all order items" ON public.order_items;
DROP POLICY IF EXISTS "Public can insert order_items" ON public.order_items;
DROP POLICY IF EXISTS "Public can read order_items" ON public.order_items;
DROP POLICY IF EXISTS "Public can update order_items" ON public.order_items;
DROP POLICY IF EXISTS "public_all_order_items" ON public.order_items;

-- ═══════════════════════════════════════════════════════════════════════════════
-- CREATE NEW COMPREHENSIVE POLICIES
-- ═══════════════════════════════════════════════════════════════════════════════

-- Policy 1: Anyone can INSERT order_items
CREATE POLICY "order_items_insert_policy" 
ON public.order_items 
FOR INSERT 
WITH CHECK (true);

-- Policy 2: Users can SELECT their own order items
CREATE POLICY "order_items_select_own" 
ON public.order_items 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.orders 
    WHERE orders.id = order_items.order_id 
    AND orders.user_id = auth.uid()
  )
);

-- Policy 3: Admins can SELECT all order items
CREATE POLICY "order_items_select_admin" 
ON public.order_items 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE users.id = auth.uid() 
    AND users.role = 'admin'
  )
);

-- Policy 4: Delivery persons can SELECT all order items
CREATE POLICY "order_items_select_delivery" 
ON public.order_items 
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

-- Policy 5: Admins can UPDATE all order items
CREATE POLICY "order_items_update_admin" 
ON public.order_items 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE users.id = auth.uid() 
    AND users.role = 'admin'
  )
);

-- Policy 6: Admins can DELETE order items
CREATE POLICY "order_items_delete_admin" 
ON public.order_items 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE users.id = auth.uid() 
    AND users.role = 'admin'
  )
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- GRANT PERMISSIONS
-- ═══════════════════════════════════════════════════════════════════════════════

GRANT SELECT, INSERT, UPDATE ON public.order_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO service_role;

-- ═══════════════════════════════════════════════════════════════════════════════
