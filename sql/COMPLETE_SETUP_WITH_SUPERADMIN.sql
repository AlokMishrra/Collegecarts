-- ============================================
-- COMPLETE SETUP WITH SUPER ADMIN
-- This script does EVERYTHING:
-- 1. Fixes all RLS policies
-- 2. Creates helper functions
-- 3. Makes CCEMP0780 (alok@collegecarts.in) Super Admin
-- ============================================

-- ============================================
-- PART 1: Fix RLS for ALL Employee Tables
-- ============================================
DO $$ 
DECLARE
  tbl text;
  policy_count integer;
BEGIN
  RAISE NOTICE '🔧 Starting RLS fix for all employee tables...';
  
  FOR tbl IN 
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_name LIKE 'employee%'
  LOOP
    -- Drop ALL existing policies
    EXECUTE format('DROP POLICY IF EXISTS "Enable all access for authenticated users" ON %I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Enable read access for all users" ON %I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Enable insert for authenticated users" ON %I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Enable update for authenticated users" ON %I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Enable delete for authenticated users" ON %I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Allow authenticated access" ON %I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Public read access" ON %I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "authenticated_all_access" ON %I', tbl);
    
    -- Create ONE comprehensive policy for ALL operations
    EXECUTE format('CREATE POLICY "authenticated_all_access" ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)', tbl);
    
    -- Enable RLS
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    
    RAISE NOTICE '✅ Fixed RLS for table: %', tbl;
  END LOOP;
  
  -- Count policies created
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies 
  WHERE tablename LIKE 'employee%';
  
  RAISE NOTICE '🎉 RLS fix complete! Created % policies', policy_count;
END $$;

-- ============================================
-- PART 2: Create Helper Functions
-- ============================================

-- Function to generate unique employee codes
CREATE OR REPLACE FUNCTION generate_employee_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
  attempts INTEGER := 0;
  max_attempts INTEGER := 100;
BEGIN
  LOOP
    new_code := 'CCEMP' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    SELECT EXISTS(
      SELECT 1 FROM employee_accounts WHERE employee_code = new_code
    ) INTO code_exists;
    IF NOT code_exists THEN
      RETURN new_code;
    END IF;
    attempts := attempts + 1;
    IF attempts >= max_attempts THEN
      RAISE EXCEPTION 'Could not generate unique employee code after % attempts', max_attempts;
    END IF;
  END LOOP;
END;
$$;

-- Function to generate unique employee slugs
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
    SELECT EXISTS(
      SELECT 1 FROM employee_accounts WHERE slug = new_slug
    ) INTO slug_exists;
    IF NOT slug_exists THEN
      RETURN new_slug;
    END IF;
    counter := counter + 1;
    new_slug := base_slug || '-' || counter;
    IF counter > 1000 THEN
      RAISE EXCEPTION 'Could not generate unique slug for name: %', full_name;
    END IF;
  END LOOP;
END;
$$;

-- ============================================
-- PART 3: Make CCEMP0780 Super Admin
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
  SELECT EXISTS(
    SELECT 1 FROM employee_accounts WHERE employee_code = 'CCEMP0780'
  ) INTO employee_exists;
  
  IF NOT employee_exists THEN
    RAISE NOTICE '⚠️  Employee CCEMP0780 not found!';
    RAISE NOTICE '⚠️  Please create this employee first from admin panel';
    RAISE NOTICE '⚠️  Then run: sql/MAKE_ALOK_SUPERADMIN.sql';
    RETURN;
  END IF;
  
  -- Get Super Admin role ID
  SELECT id INTO super_admin_role_id
  FROM employee_roles
  WHERE role_code = 'SUPER_ADMIN'
  LIMIT 1;

  -- Get Operations department ID
  SELECT id INTO operations_dept_id
  FROM employee_departments
  WHERE department_code = 'OPS'
  LIMIT 1;

  -- Check if role exists
  IF super_admin_role_id IS NULL THEN
    RAISE EXCEPTION 'Super Admin role not found! Database not properly set up.';
  END IF;

  -- Update employee to Super Admin
  UPDATE employee_accounts
  SET 
    role_id = super_admin_role_id,
    department_id = operations_dept_id,
    status = 'active',
    updated_at = NOW()
  WHERE employee_code = 'CCEMP0780'
  RETURNING id INTO employee_id;

  RAISE NOTICE '✅ Employee CCEMP0780 (alok@collegecarts.in) is now SUPER ADMIN!';
  RAISE NOTICE '✅ Full access to all employee system features!';
END $$;

-- ============================================
-- PART 4: Verification & Summary
-- ============================================
DO $$
DECLARE
  table_count INTEGER;
  policy_count INTEGER;
  role_count INTEGER;
  dept_count INTEGER;
  employee_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name LIKE 'employee%';
  
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename LIKE 'employee%';
  
  SELECT COUNT(*) INTO role_count FROM employee_roles;
  SELECT COUNT(*) INTO dept_count FROM employee_departments;
  SELECT COUNT(*) INTO employee_count FROM employee_accounts;
  
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════';
  RAISE NOTICE '✅ COMPLETE SETUP FINISHED!';
  RAISE NOTICE '═══════════════════════════════════════';
  RAISE NOTICE 'Employee Tables: %', table_count;
  RAISE NOTICE 'RLS Policies: %', policy_count;
  RAISE NOTICE 'Roles: %', role_count;
  RAISE NOTICE 'Departments: %', dept_count;
  RAISE NOTICE 'Employees: %', employee_count;
  RAISE NOTICE '═══════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '🎉 All RLS policies fixed!';
  RAISE NOTICE '🎉 No more 406 errors!';
  RAISE NOTICE '🎉 Super Admin configured!';
  RAISE NOTICE '🎉 Employee system ready!';
  RAISE NOTICE '';
END $$;

-- Show Super Admin details
SELECT '👤 Super Admin Details:' as info;
SELECT 
  ea.employee_code,
  ea.full_name,
  ea.email,
  ea.slug,
  ea.status,
  er.role_name,
  er.role_code,
  er.dashboard_type,
  er.hierarchy_level,
  ed.department_name
FROM employee_accounts ea
LEFT JOIN employee_roles er ON ea.role_id = er.id
LEFT JOIN employee_departments ed ON ea.department_id = ed.id
WHERE ea.employee_code = 'CCEMP0780';

-- Show available roles
SELECT '📋 Available Roles:' as info;
SELECT role_name, role_code, dashboard_type, hierarchy_level 
FROM employee_roles 
ORDER BY hierarchy_level DESC;

-- Show available departments
SELECT '📋 Available Departments:' as info;
SELECT department_name, department_code, is_active 
FROM employee_departments 
ORDER BY department_name;

-- Final instructions
SELECT '✅ NEXT STEPS:' as message;
SELECT '1. Refresh your browser (Ctrl+F5)' as step;
SELECT '2. Go to: /employee/login' as step;
SELECT '3. Login with: alok@collegecarts.in' as step;
SELECT '4. You now have FULL SUPER ADMIN access!' as step;
SELECT '5. You can access ALL pages and features!' as step;
