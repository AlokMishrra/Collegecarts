-- Seed Employee Roles and Departments
-- Run this in Supabase SQL Editor if roles and departments are not showing

-- Create generate_employee_code function if it doesn't exist
CREATE OR REPLACE FUNCTION generate_employee_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate code: CCEMP + 4 random digits
    new_code := 'CCEMP' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    
    -- Check if code already exists
    SELECT EXISTS(
      SELECT 1 FROM employee_accounts WHERE employee_code = new_code
    ) INTO code_exists;
    
    -- If code doesn't exist, return it
    IF NOT code_exists THEN
      RETURN new_code;
    END IF;
  END LOOP;
END;
$$;

-- Insert Employee Roles (if not exists)
-- Note: If you get a duplicate key error, the data is already inserted - that's good!
-- You can skip this section if roles already exist
DO $$
BEGIN
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
  ON CONFLICT (role_code) DO NOTHING;
EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE 'Some roles already exist - skipping duplicates';
END $$;

-- Insert Employee Departments (if not exists)
INSERT INTO employee_departments (department_name, department_code, description, is_active)
VALUES
  ('Operations', 'OPS', 'Store operations and management', true),
  ('Inventory', 'INV', 'Inventory and stock management', true),
  ('Finance', 'FIN', 'Financial operations and accounting', true),
  ('Delivery', 'DEL', 'Delivery and logistics', true),
  ('Sales', 'SAL', 'Sales and customer relations', true),
  ('Support', 'SUP', 'Customer support and service', true)
ON CONFLICT (department_code) DO NOTHING;

-- Verify data was inserted
SELECT 'Roles inserted:' as info, COUNT(*) as count FROM employee_roles;
SELECT 'Departments inserted:' as info, COUNT(*) as count FROM employee_departments;

-- Show all roles
SELECT role_name, role_code, dashboard_type FROM employee_roles ORDER BY hierarchy_level DESC;

-- Show all departments  
SELECT department_name, department_code, is_active FROM employee_departments ORDER BY department_name;
