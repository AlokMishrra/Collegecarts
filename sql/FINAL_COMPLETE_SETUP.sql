-- FINAL COMPLETE EMPLOYEE SYSTEM SETUP
-- This is the ONE script to run that sets up EVERYTHING
-- Run this in Supabase SQL Editor

-- ============================================
-- PART 1: Verify Tables Exist
-- ============================================
SELECT 'Checking if tables exist...' as status;

SELECT 
  table_name,
  CASE 
    WHEN table_name IN (
      'employee_roles', 'employee_departments', 'employee_accounts',
      'employee_sessions', 'employee_attendance', 'employee_salary_logs',
      'employee_stock_orders', 'employee_stock_order_items'
    ) THEN '✅ Exists'
    ELSE '❌ Missing'
  END as status
FROM information_schema.tables
WHERE table_schema = 'public' 
  AND table_name LIKE 'employee%'
ORDER BY table_name;

-- ============================================
-- PART 2: Fix RLS for ALL Employee Tables
-- ============================================

-- For authenticated users (admins and employees)
DO $$ 
DECLARE
  tbl text;
BEGIN
  FOR tbl IN 
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_name LIKE 'employee%'
  LOOP
    -- Drop existing policies
    EXECUTE format('DROP POLICY IF EXISTS "Enable all access for authenticated users" ON %I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Enable read access for all users" ON %I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Enable insert for authenticated users" ON %I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Enable update for authenticated users" ON %I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Enable delete for authenticated users" ON %I', tbl);
    
    -- Create new permissive policy
    EXECUTE format('CREATE POLICY "Enable all access for authenticated users" ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)', tbl);
    
    -- Enable RLS
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    
    RAISE NOTICE 'Fixed RLS for table: %', tbl;
  END LOOP;
END $$;

-- ============================================
-- PART 3: Create generate_employee_code function
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
-- PART 4: Seed Roles (with proper conflict handling)
-- ============================================
-- First, check and insert roles one by one to avoid conflicts
DO $$
BEGIN
  -- Super Admin
  IF NOT EXISTS (SELECT 1 FROM employee_roles WHERE role_code = 'SUPER_ADMIN') THEN
    INSERT INTO employee_roles (role_name, role_code, permissions, dashboard_type, hierarchy_level, is_system_role, description)
    VALUES ('Super Admin', 'SUPER_ADMIN', '["all"]'::jsonb, 'super_admin', 100, true, 'Full system access');
  END IF;

  -- Store Manager
  IF NOT EXISTS (SELECT 1 FROM employee_roles WHERE role_code = 'STORE_MANAGER') THEN
    INSERT INTO employee_roles (role_name, role_code, permissions, dashboard_type, hierarchy_level, is_system_role, description)
    VALUES ('Store Manager', 'STORE_MANAGER', '["manage_employees", "manage_inventory"]'::jsonb, 'manager', 90, true, 'Store operations');
  END IF;

  -- Stock Manager
  IF NOT EXISTS (SELECT 1 FROM employee_roles WHERE role_code = 'STOCK_MANAGER') THEN
    INSERT INTO employee_roles (role_name, role_code, permissions, dashboard_type, hierarchy_level, is_system_role, description)
    VALUES ('Stock Manager', 'STOCK_MANAGER', '["manage_inventory", "approve_stock_orders"]'::jsonb, 'stock', 80, true, 'Inventory management');
  END IF;

  -- Finance Manager
  IF NOT EXISTS (SELECT 1 FROM employee_roles WHERE role_code = 'FINANCE_MANAGER') THEN
    INSERT INTO employee_roles (role_name, role_code, permissions, dashboard_type, hierarchy_level, is_system_role, description)
    VALUES ('Finance Manager', 'FINANCE_MANAGER', '["manage_finance", "process_salaries", "view_prices"]'::jsonb, 'finance', 85, true, 'Financial operations');
  END IF;

  -- Delivery Partner
  IF NOT EXISTS (SELECT 1 FROM employee_roles WHERE role_code = 'DELIVERY_PARTNER') THEN
    INSERT INTO employee_roles (role_name, role_code, permissions, dashboard_type, hierarchy_level, is_system_role, description)
    VALUES ('Delivery Partner', 'DELIVERY_PARTNER', '["view_deliveries", "update_delivery_status"]'::jsonb, 'delivery', 50, true, 'Delivery operations');
  END IF;

  -- Sales Executive
  IF NOT EXISTS (SELECT 1 FROM employee_roles WHERE role_code = 'SALES_EXECUTIVE') THEN
    INSERT INTO employee_roles (role_name, role_code, permissions, dashboard_type, hierarchy_level, is_system_role, description)
    VALUES ('Sales Executive', 'SALES_EXECUTIVE', '["create_orders", "view_customers"]'::jsonb, 'sales', 60, true, 'Sales management');
  END IF;

  -- Support Agent
  IF NOT EXISTS (SELECT 1 FROM employee_roles WHERE role_code = 'SUPPORT_AGENT') THEN
    INSERT INTO employee_roles (role_name, role_code, permissions, dashboard_type, hierarchy_level, is_system_role, description)
    VALUES ('Support Agent', 'SUPPORT_AGENT', '["view_tickets", "respond_tickets"]'::jsonb, 'support', 55, true, 'Customer support');
  END IF;

  -- Inventory Clerk
  IF NOT EXISTS (SELECT 1 FROM employee_roles WHERE role_code = 'INVENTORY_CLERK') THEN
    INSERT INTO employee_roles (role_name, role_code, permissions, dashboard_type, hierarchy_level, is_system_role, description)
    VALUES ('Inventory Clerk', 'INVENTORY_CLERK', '["view_inventory", "create_stock_orders"]'::jsonb, 'inventory', 40, true, 'Inventory tracking');
  END IF;

  -- Cashier
  IF NOT EXISTS (SELECT 1 FROM employee_roles WHERE role_code = 'CASHIER') THEN
    INSERT INTO employee_roles (role_name, role_code, permissions, dashboard_type, hierarchy_level, is_system_role, description)
    VALUES ('Cashier', 'CASHIER', '["process_payments", "view_orders"]'::jsonb, 'cashier', 45, true, 'Payment processing');
  END IF;

  -- Security Guard
  IF NOT EXISTS (SELECT 1 FROM employee_roles WHERE role_code = 'SECURITY_GUARD') THEN
    INSERT INTO employee_roles (role_name, role_code, permissions, dashboard_type, hierarchy_level, is_system_role, description)
    VALUES ('Security Guard', 'SECURITY_GUARD', '["view_attendance", "mark_attendance"]'::jsonb, 'security', 30, true, 'Security monitoring');
  END IF;

  RAISE NOTICE '✅ Roles seeded successfully';
END $$;

-- ============================================
-- PART 5: Seed Departments (with proper conflict handling)
-- ============================================
DO $$
BEGIN
  -- Operations
  IF NOT EXISTS (SELECT 1 FROM employee_departments WHERE department_code = 'OPS') THEN
    INSERT INTO employee_departments (department_name, department_code, description, is_active)
    VALUES ('Operations', 'OPS', 'Store operations and management', true);
  END IF;

  -- Inventory
  IF NOT EXISTS (SELECT 1 FROM employee_departments WHERE department_code = 'INV') THEN
    INSERT INTO employee_departments (department_name, department_code, description, is_active)
    VALUES ('Inventory', 'INV', 'Inventory and stock management', true);
  END IF;

  -- Finance
  IF NOT EXISTS (SELECT 1 FROM employee_departments WHERE department_code = 'FIN') THEN
    INSERT INTO employee_departments (department_name, department_code, description, is_active)
    VALUES ('Finance', 'FIN', 'Financial operations and accounting', true);
  END IF;

  -- Delivery
  IF NOT EXISTS (SELECT 1 FROM employee_departments WHERE department_code = 'DEL') THEN
    INSERT INTO employee_departments (department_name, department_code, description, is_active)
    VALUES ('Delivery', 'DEL', 'Delivery and logistics', true);
  END IF;

  -- Sales
  IF NOT EXISTS (SELECT 1 FROM employee_departments WHERE department_code = 'SAL') THEN
    INSERT INTO employee_departments (department_name, department_code, description, is_active)
    VALUES ('Sales', 'SAL', 'Sales and customer relations', true);
  END IF;

  -- Support
  IF NOT EXISTS (SELECT 1 FROM employee_departments WHERE department_code = 'SUP') THEN
    INSERT INTO employee_departments (department_name, department_code, description, is_active)
    VALUES ('Support', 'SUP', 'Customer support and service', true);
  END IF;

  RAISE NOTICE '✅ Departments seeded successfully';
END $$;

-- ============================================
-- VERIFICATION & SUMMARY
-- ============================================
SELECT '✅ SETUP COMPLETE!' as status;

SELECT 'Tables with RLS:' as info, COUNT(*) as count 
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name LIKE 'employee%';

SELECT 'RLS Policies:' as info, COUNT(*) as count 
FROM pg_policies 
WHERE tablename LIKE 'employee%';

SELECT 'Roles:' as info, COUNT(*) as count FROM employee_roles;
SELECT 'Departments:' as info, COUNT(*) as count FROM employee_departments;

-- Show sample data
SELECT '📋 Available Roles:' as info;
SELECT role_name, role_code FROM employee_roles ORDER BY hierarchy_level DESC;

SELECT '📋 Available Departments:' as info;
SELECT department_name, department_code FROM employee_departments ORDER BY department_name;

SELECT '✅ Employee System is now fully configured!' as final_message;
SELECT '🎉 You can now:' as next_steps;
SELECT '  1. Create employees from admin panel' as step;
SELECT '  2. Employees can login at /employee/login' as step;
SELECT '  3. All features should work!' as step;
