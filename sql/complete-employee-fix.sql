-- Complete Employee System Fix
-- This script will:
-- 1. Disable RLS temporarily
-- 2. Clear and re-insert data
-- 3. Set up proper RLS policies
-- 4. Verify everything works

-- Run this in Supabase SQL Editor

-- ============================================
-- STEP 1: Disable RLS temporarily
-- ============================================
ALTER TABLE employee_roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE employee_departments DISABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 2: Clear existing data (optional)
-- ============================================
-- Uncomment these lines if you want to start fresh
-- DELETE FROM employee_roles WHERE is_system_role = true;
-- DELETE FROM employee_departments;

-- ============================================
-- STEP 3: Create generate_employee_code function
-- ============================================
CREATE OR REPLACE FUNCTION generate_employee_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  LOOP
    new_code := 'CCEMP' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    SELECT EXISTS(
      SELECT 1 FROM employee_accounts WHERE employee_code = new_code
    ) INTO code_exists;
    IF NOT code_exists THEN
      RETURN new_code;
    END IF;
  END LOOP;
END;
$$;

-- ============================================
-- STEP 4: Insert Employee Roles
-- ============================================
INSERT INTO employee_roles (role_name, role_code, permissions, dashboard_type, hierarchy_level, is_system_role, description)
VALUES
  ('Super Admin', 'SUPER_ADMIN', '["all"]'::jsonb, 'super_admin', 100, true, 'Full system access with all permissions'),
  ('Store Manager', 'STORE_MANAGER', '["manage_employees", "manage_inventory", "manage_orders", "view_reports"]'::jsonb, 'manager', 90, true, 'Manages store operations and staff'),
  ('Stock Manager', 'STOCK_MANAGER', '["manage_inventory", "approve_stock_orders", "view_stock_reports"]'::jsonb, 'stock', 80, true, 'Manages inventory and stock orders'),
  ('Finance Manager', 'FINANCE_MANAGER', '["manage_finance", "process_salaries", "view_financial_reports", "view_prices"]'::jsonb, 'finance', 85, true, 'Manages financial operations and salaries'),
  ('Delivery Partner', 'DELIVERY_PARTNER', '["view_deliveries", "update_delivery_status", "view_earnings"]'::jsonb, 'delivery', 50, true, 'Handles delivery operations'),
  ('Sales Executive', 'SALES_EXECUTIVE', '["create_orders", "view_customers", "view_products"]'::jsonb, 'sales', 60, true, 'Manages sales and customer relations'),
  ('Support Agent', 'SUPPORT_AGENT', '["view_tickets", "respond_tickets", "view_customers"]'::jsonb, 'support', 55, true, 'Handles customer support tickets'),
  ('Inventory Clerk', 'INVENTORY_CLERK', '["view_inventory", "create_stock_orders", "update_stock"]'::jsonb, 'inventory', 40, true, 'Manages inventory tracking'),
  ('Cashier', 'CASHIER', '["process_payments", "view_orders"]'::jsonb, 'cashier', 45, true, 'Processes payments and transactions'),
  ('Security Guard', 'SECURITY_GUARD', '["view_attendance", "mark_attendance"]'::jsonb, 'security', 30, true, 'Monitors attendance and security')
ON CONFLICT (role_code) DO UPDATE SET
  role_name = EXCLUDED.role_name,
  permissions = EXCLUDED.permissions,
  dashboard_type = EXCLUDED.dashboard_type,
  hierarchy_level = EXCLUDED.hierarchy_level,
  description = EXCLUDED.description;

-- ============================================
-- STEP 5: Insert Employee Departments
-- ============================================
INSERT INTO employee_departments (department_name, department_code, description, is_active)
VALUES
  ('Operations', 'OPS', 'Store operations and management', true),
  ('Inventory', 'INV', 'Inventory and stock management', true),
  ('Finance', 'FIN', 'Financial operations and accounting', true),
  ('Delivery', 'DEL', 'Delivery and logistics', true),
  ('Sales', 'SAL', 'Sales and customer relations', true),
  ('Support', 'SUP', 'Customer support and service', true)
ON CONFLICT (department_code) DO UPDATE SET
  department_name = EXCLUDED.department_name,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active;

-- ============================================
-- STEP 6: Set up RLS Policies
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Allow public read access to employee_roles" ON employee_roles;
DROP POLICY IF EXISTS "Allow public read access to employee_departments" ON employee_departments;
DROP POLICY IF EXISTS "Allow authenticated read access to employee_roles" ON employee_roles;
DROP POLICY IF EXISTS "Allow authenticated read access to employee_departments" ON employee_departments;

-- Create new permissive policies for reading
CREATE POLICY "Allow public read access to employee_roles"
  ON employee_roles
  FOR SELECT
  USING (true);

CREATE POLICY "Allow public read access to employee_departments"
  ON employee_departments
  FOR SELECT
  USING (true);

-- ============================================
-- STEP 7: Enable RLS
-- ============================================
ALTER TABLE employee_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_departments ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 8: Verify Everything
-- ============================================
SELECT '✅ Setup Complete!' as status;
SELECT 'Roles Count:' as info, COUNT(*) as count FROM employee_roles;
SELECT 'Departments Count:' as info, COUNT(*) as count FROM employee_departments;

-- Show the data
SELECT 'All Roles:' as info;
SELECT id, role_name, role_code, dashboard_type, hierarchy_level FROM employee_roles ORDER BY hierarchy_level DESC;

SELECT 'All Departments:' as info;
SELECT id, department_name, department_code, is_active FROM employee_departments ORDER BY department_name;

SELECT '✅ You can now refresh your admin panel and the dropdowns should work!' as final_message;
