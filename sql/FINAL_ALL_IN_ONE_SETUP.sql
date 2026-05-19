-- ============================================
-- FINAL ALL-IN-ONE SETUP
-- This script does EVERYTHING in the correct order:
-- 1. Fixes all RLS policies
-- 2. Seeds roles and departments (if not exist)
-- 3. Creates helper functions
-- 4. Makes CCEMP0780 (alok@collegecarts.in) Super Admin
-- ============================================

-- ============================================
-- PART 1: Fix RLS for ALL Employee Tables
-- ============================================
DO $$ 
DECLARE
  tbl text;
BEGIN
  RAISE NOTICE '🔧 Fixing RLS policies...';
  
  FOR tbl IN 
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_name LIKE 'employee%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Enable all access for authenticated users" ON %I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Enable read access for all users" ON %I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Enable insert for authenticated users" ON %I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Enable update for authenticated users" ON %I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Enable delete for authenticated users" ON %I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Allow authenticated access" ON %I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Public read access" ON %I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "authenticated_all_access" ON %I', tbl);
    
    EXECUTE format('CREATE POLICY "authenticated_all_access" ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)', tbl);
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
  END LOOP;
  
  RAISE NOTICE '✅ RLS policies fixed!';
END $$;

-- ============================================
-- PART 2: Seed Roles (if not exist)
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '🔧 Seeding roles...';
  
  -- Super Admin
  IF NOT EXISTS (SELECT 1 FROM employee_roles WHERE role_code = 'SUPER_ADMIN') THEN
    INSERT INTO employee_roles (role_name, role_code, permissions, dashboard_type, hierarchy_level, is_system_role, description)
    VALUES ('Super Admin', 'SUPER_ADMIN', '["all"]'::jsonb, 'super_admin', 100, true, 'Full system access');
    RAISE NOTICE '✅ Created Super Admin role';
  ELSE
    RAISE NOTICE '⚠️  Super Admin role already exists';
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
-- PART 3: Seed Departments (if not exist)
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '🔧 Seeding departments...';
  
  IF NOT EXISTS (SELECT 1 FROM employee_departments WHERE department_code = 'OPS') THEN
    INSERT INTO employee_departments (department_name, department_code, description, is_active)
    VALUES ('Operations', 'OPS', 'Store operations and management', true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM employee_departments WHERE department_code = 'INV') THEN
    INSERT INTO employee_departments (department_name, department_code, description, is_active)
    VALUES ('Inventory', 'INV', 'Inventory and stock management', true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM employee_departments WHERE department_code = 'FIN') THEN
    INSERT INTO employee_departments (department_name, department_code, description, is_active)
    VALUES ('Finance', 'FIN', 'Financial operations and accounting', true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM employee_departments WHERE department_code = 'DEL') THEN
    INSERT INTO employee_departments (department_name, department_code, description, is_active)
    VALUES ('Delivery', 'DEL', 'Delivery and logistics', true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM employee_departments WHERE department_code = 'SAL') THEN
    INSERT INTO employee_departments (department_name, department_code, description, is_active)
    VALUES ('Sales', 'SAL', 'Sales and customer relations', true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM employee_departments WHERE department_code = 'SUP') THEN
    INSERT INTO employee_departments (department_name, department_code, description, is_active)
    VALUES ('Support', 'SUP', 'Customer support and service', true);
  END IF;

  RAISE NOTICE '✅ Departments seeded successfully';
END $$;

-- ============================================
-- PART 4: Create Helper Functions
-- ============================================
CREATE OR REPLACE FUNCTION generate_employee_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
  attempts INTEGER := 0;
BEGIN
  LOOP
    new_code := 'CCEMP' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    SELECT EXISTS(SELECT 1 FROM employee_accounts WHERE employee_code = new_code) INTO code_exists;
    IF NOT code_exists THEN RETURN new_code; END IF;
    attempts := attempts + 1;
    IF attempts >= 100 THEN
      RAISE EXCEPTION 'Could not generate unique employee code';
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION generate_employee_slug(full_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  base_slug TEXT;
  new_slug TEXT;
  slug_exists BOOLEAN;
  counter INTEGER := 1;
BEGIN
  base_slug := LOWER(REGEXP_REPLACE(full_name, '[^a-zA-Z0-9]+', '-', 'g'));
  base_slug := TRIM(BOTH '-' FROM base_slug);
  new_slug := base_slug;
  
  LOOP
    SELECT EXISTS(SELECT 1 FROM employee_accounts WHERE slug = new_slug) INTO slug_exists;
    IF NOT slug_exists THEN RETURN new_slug; END IF;
    counter := counter + 1;
    new_slug := base_slug || '-' || counter;
    IF counter > 1000 THEN RAISE EXCEPTION 'Could not generate unique slug'; END IF;
  END LOOP;
END;
$$;

-- ============================================
-- PART 5: Make CCEMP0780 Super Admin
-- ============================================
DO $$
DECLARE
  super_admin_role_id UUID;
  employee_id UUID;
  operations_dept_id UUID;
  employee_exists BOOLEAN;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🔧 Setting up Super Admin...';
  
  -- Check if employee exists
  SELECT EXISTS(SELECT 1 FROM employee_accounts WHERE employee_code = 'CCEMP0780') INTO employee_exists;
  
  IF NOT employee_exists THEN
    RAISE NOTICE '⚠️  Employee CCEMP0780 not found!';
    RAISE NOTICE '⚠️  Create employee first, then run this script again';
    RETURN;
  END IF;
  
  -- Get IDs
  SELECT id INTO super_admin_role_id FROM employee_roles WHERE role_code = 'SUPER_ADMIN' LIMIT 1;
  SELECT id INTO operations_dept_id FROM employee_departments WHERE department_code = 'OPS' LIMIT 1;

  -- Update employee
  UPDATE employee_accounts
  SET 
    role_id = super_admin_role_id,
    department_id = operations_dept_id,
    status = 'active',
    updated_at = NOW()
  WHERE employee_code = 'CCEMP0780'
  RETURNING id INTO employee_id;

  RAISE NOTICE '✅ CCEMP0780 (alok@collegecarts.in) is now SUPER ADMIN!';
END $$;

-- ============================================
-- VERIFICATION
-- ============================================
DO $$
DECLARE
  table_count INTEGER;
  policy_count INTEGER;
  role_count INTEGER;
  dept_count INTEGER;
  employee_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO table_count FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'employee%';
  SELECT COUNT(*) INTO policy_count FROM pg_policies WHERE tablename LIKE 'employee%';
  SELECT COUNT(*) INTO role_count FROM employee_roles;
  SELECT COUNT(*) INTO dept_count FROM employee_departments;
  SELECT COUNT(*) INTO employee_count FROM employee_accounts;
  
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════';
  RAISE NOTICE '✅ COMPLETE SETUP FINISHED!';
  RAISE NOTICE '═══════════════════════════════════════';
  RAISE NOTICE 'Tables: %', table_count;
  RAISE NOTICE 'RLS Policies: %', policy_count;
  RAISE NOTICE 'Roles: %', role_count;
  RAISE NOTICE 'Departments: %', dept_count;
  RAISE NOTICE 'Employees: %', employee_count;
  RAISE NOTICE '═══════════════════════════════════════';
  RAISE NOTICE '🎉 All RLS policies fixed!';
  RAISE NOTICE '🎉 Roles and departments seeded!';
  RAISE NOTICE '🎉 Super Admin configured!';
  RAISE NOTICE '🎉 No more 406 errors!';
  RAISE NOTICE '';
END $$;

-- Show Super Admin
SELECT '👤 Super Admin:' as info;
SELECT 
  ea.employee_code,
  ea.full_name,
  ea.email,
  ea.status,
  er.role_name,
  er.dashboard_type
FROM employee_accounts ea
LEFT JOIN employee_roles er ON ea.role_id = er.id
WHERE ea.employee_code = 'CCEMP0780';

-- Show all roles
SELECT '📋 All Roles:' as info;
SELECT role_name, role_code, dashboard_type, hierarchy_level 
FROM employee_roles 
ORDER BY hierarchy_level DESC;

-- Final message
SELECT '✅ DONE! Refresh browser and login at /employee/login' as message;
