-- ============================================================
-- SEED EMPLOYEE DEPARTMENTS AND ROLES
-- ============================================================
-- Run this in Supabase SQL Editor to populate departments and roles
-- This will fix the "No departments found" error

-- ============================================================
-- 1. SEED EMPLOYEE DEPARTMENTS
-- ============================================================

INSERT INTO employee_departments (department_name, department_code, description, is_active)
VALUES
  ('Operations', 'OPS', 'Store operations and management', true),
  ('Inventory', 'INV', 'Inventory and stock management', true),
  ('Finance', 'FIN', 'Financial operations and accounting', true),
  ('Delivery', 'DEL', 'Delivery and logistics', true),
  ('Sales', 'SAL', 'Sales and customer relations', true),
  ('Support', 'SUP', 'Customer support and service', true)
ON CONFLICT (department_code) DO NOTHING;

-- ============================================================
-- 2. SEED EMPLOYEE ROLES
-- ============================================================

INSERT INTO employee_roles (role_name, role_code, description, hierarchy_level, permissions)
VALUES
  ('Super Admin', 'SUPERADMIN', 'Full system access', 1, '{"all": true}'::jsonb),
  ('Manager', 'MANAGER', 'Department manager with elevated permissions', 2, '{"manage_team": true, "view_reports": true, "approve_orders": true}'::jsonb),
  ('Supervisor', 'SUPERVISOR', 'Team supervisor', 3, '{"manage_team": true, "view_reports": true}'::jsonb),
  ('Stock Manager', 'STOCK_MGR', 'Manages inventory and stock orders', 4, '{"manage_stock": true, "create_orders": true, "view_inventory": true}'::jsonb),
  ('Delivery Partner', 'DELIVERY', 'Handles deliveries', 5, '{"view_orders": true, "update_delivery_status": true}'::jsonb),
  ('Sales Associate', 'SALES', 'Sales and customer service', 5, '{"view_products": true, "create_orders": true}'::jsonb),
  ('Support Staff', 'SUPPORT', 'Customer support', 6, '{"view_orders": true, "view_customers": true}'::jsonb)
ON CONFLICT (role_code) DO NOTHING;

-- ============================================================
-- 3. VERIFY DATA
-- ============================================================

-- Check departments
SELECT 
  department_name, 
  department_code, 
  is_active,
  created_at
FROM employee_departments
ORDER BY department_name;

-- Check roles
SELECT 
  role_name, 
  role_code, 
  hierarchy_level,
  created_at
FROM employee_roles
ORDER BY hierarchy_level;

-- ============================================================
-- SUCCESS MESSAGE
-- ============================================================

DO $$
DECLARE
  dept_count INTEGER;
  role_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO dept_count FROM employee_departments WHERE is_active = true;
  SELECT COUNT(*) INTO role_count FROM employee_roles;
  
  RAISE NOTICE '✓ Seeding complete!';
  RAISE NOTICE '  - Departments: %', dept_count;
  RAISE NOTICE '  - Roles: %', role_count;
  RAISE NOTICE '';
  RAISE NOTICE 'You can now use the Employee System Management panel in CCA.';
END $$;
