# Employee System - Quick Fix for Roles & Departments

## Problem
Roles and Departments not showing in the employee creation form dropdown.

## Solution
Run the seed SQL file to populate default data.

---

## Step-by-Step Fix

### 1. Open Supabase SQL Editor
- Go to your Supabase project
- Click on "SQL Editor" in the left sidebar

### 2. Run the Seed File
Copy and paste the contents of `sql/seed-employee-data.sql` into the SQL editor and click "Run".

Or manually run this SQL:

```sql
-- Create generate_employee_code function
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

-- Insert Employee Roles
INSERT INTO employee_roles (role_name, role_code, permissions, dashboard_type, hierarchy_level, is_system_role, description)
VALUES
  ('Super Admin', 'SUPER_ADMIN', '["all"]'::jsonb, 'super_admin', 100, true, 'Full system access'),
  ('Store Manager', 'STORE_MANAGER', '["manage_employees", "manage_inventory"]'::jsonb, 'manager', 90, true, 'Manages store operations'),
  ('Stock Manager', 'STOCK_MANAGER', '["manage_inventory", "approve_stock_orders"]'::jsonb, 'stock', 80, true, 'Manages inventory'),
  ('Finance Manager', 'FINANCE_MANAGER', '["manage_finance", "process_salaries", "view_prices"]'::jsonb, 'finance', 85, true, 'Manages finances'),
  ('Delivery Partner', 'DELIVERY_PARTNER', '["view_deliveries", "update_delivery_status"]'::jsonb, 'delivery', 50, true, 'Handles deliveries'),
  ('Sales Executive', 'SALES_EXECUTIVE', '["create_orders", "view_customers"]'::jsonb, 'sales', 60, true, 'Manages sales'),
  ('Support Agent', 'SUPPORT_AGENT', '["view_tickets", "respond_tickets"]'::jsonb, 'support', 55, true, 'Handles support'),
  ('Inventory Clerk', 'INVENTORY_CLERK', '["view_inventory", "create_stock_orders"]'::jsonb, 'inventory', 40, true, 'Manages inventory'),
  ('Cashier', 'CASHIER', '["process_payments", "view_orders"]'::jsonb, 'cashier', 45, true, 'Processes payments'),
  ('Security Guard', 'SECURITY_GUARD', '["view_attendance", "mark_attendance"]'::jsonb, 'security', 30, true, 'Monitors security')
ON CONFLICT (role_code) DO NOTHING;

-- Insert Employee Departments
INSERT INTO employee_departments (department_name, department_code, description, is_active)
VALUES
  ('Operations', 'OPS', 'Store operations and management', true),
  ('Inventory', 'INV', 'Inventory and stock management', true),
  ('Finance', 'FIN', 'Financial operations and accounting', true),
  ('Delivery', 'DEL', 'Delivery and logistics', true),
  ('Sales', 'SAL', 'Sales and customer relations', true),
  ('Support', 'SUP', 'Customer support and service', true)
ON CONFLICT (department_code) DO NOTHING;
```

### 3. Verify Data Inserted
Run this query to verify:

```sql
SELECT 'Roles:' as type, COUNT(*) as count FROM employee_roles
UNION ALL
SELECT 'Departments:' as type, COUNT(*) as count FROM employee_departments;
```

You should see:
- Roles: 10
- Departments: 6

### 4. Refresh Admin Panel
- Go to `/CCA` admin panel
- Click "Employee System" tab
- Click "Add Employee"
- Roles and departments should now appear in dropdowns!

---

## What This Does

### Creates 10 Employee Roles:
1. Super Admin - Full system access
2. Store Manager - Manages store operations
3. Stock Manager - Manages inventory
4. Finance Manager - Manages finances (can see prices)
5. Delivery Partner - Handles deliveries
6. Sales Executive - Manages sales
7. Support Agent - Handles support tickets
8. Inventory Clerk - Manages inventory tracking
9. Cashier - Processes payments
10. Security Guard - Monitors security

### Creates 6 Departments:
1. Operations
2. Inventory
3. Finance
4. Delivery
5. Sales
6. Support

### Creates Helper Function:
- `generate_employee_code()` - Auto-generates unique employee codes (CCEMP####)

---

## Testing

After running the seed file:

1. **Test Employee Creation**:
   - Go to admin panel
   - Click "Add Employee"
   - Fill in details
   - Select role from dropdown (should show 10 roles)
   - Select department from dropdown (should show 6 departments)
   - Click "Create Employee"

2. **Test Employee Login**:
   - Go to `/employee/login`
   - Enter employee email/code and password
   - Should login successfully

3. **Test Dashboard**:
   - After login, should see role-based dashboard
   - Different roles see different features

---

## Troubleshooting

### Issue: Still not showing roles/departments
**Solution**: 
1. Check browser console for errors
2. Verify tables exist: `SELECT * FROM employee_roles LIMIT 1;`
3. Clear browser cache and reload
4. Check if migration was run: `SELECT * FROM employee_accounts LIMIT 1;`

### Issue: "generate_employee_code does not exist"
**Solution**: Run the function creation part of the seed file again

### Issue: "duplicate key value violates unique constraint"
**Solution**: Data already exists, you're good! Just refresh the page.

---

## Quick Commands

### Check if tables exist:
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'employee%';
```

### Check roles count:
```sql
SELECT COUNT(*) FROM employee_roles;
```

### Check departments count:
```sql
SELECT COUNT(*) FROM employee_departments;
```

### Check if function exists:
```sql
SELECT routine_name FROM information_schema.routines 
WHERE routine_name = 'generate_employee_code';
```

---

## Done!

After running the seed file, your employee system will be fully functional with roles and departments populated. You can now create employees and they can login and use all features!

---

**File**: `sql/seed-employee-data.sql`
**Time to Fix**: 2 minutes
**Status**: ✅ READY TO USE
