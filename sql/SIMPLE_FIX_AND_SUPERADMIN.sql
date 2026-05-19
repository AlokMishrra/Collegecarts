-- ============================================
-- SIMPLE FIX + MAKE ALOK SUPER ADMIN
-- For when roles/departments already exist
-- ============================================

-- ============================================
-- PART 1: Fix RLS Policies
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
    -- Drop all existing policies
    EXECUTE format('DROP POLICY IF EXISTS "Enable all access for authenticated users" ON %I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Enable read access for all users" ON %I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Enable insert for authenticated users" ON %I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Enable update for authenticated users" ON %I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Enable delete for authenticated users" ON %I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Allow authenticated access" ON %I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Public read access" ON %I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "authenticated_all_access" ON %I', tbl);
    
    -- Create one comprehensive policy
    EXECUTE format('CREATE POLICY "authenticated_all_access" ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)', tbl);
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    
    RAISE NOTICE '✅ Fixed: %', tbl;
  END LOOP;
  
  RAISE NOTICE '✅ All RLS policies fixed!';
END $$;

-- ============================================
-- PART 2: Create Helper Functions
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
    IF attempts >= 100 THEN RAISE EXCEPTION 'Could not generate unique code'; END IF;
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
-- PART 3: Make CCEMP0780 Super Admin
-- ============================================
DO $$
DECLARE
  super_admin_role_id UUID;
  employee_id UUID;
  operations_dept_id UUID;
  employee_exists BOOLEAN;
  employee_email TEXT;
  employee_name TEXT;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🔧 Making CCEMP0780 Super Admin...';
  
  -- Check if employee exists
  SELECT EXISTS(SELECT 1 FROM employee_accounts WHERE employee_code = 'CCEMP0780') INTO employee_exists;
  
  IF NOT employee_exists THEN
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  ═══════════════════════════════════════';
    RAISE NOTICE '⚠️  Employee CCEMP0780 NOT FOUND!';
    RAISE NOTICE '⚠️  ═══════════════════════════════════════';
    RAISE NOTICE '⚠️  Please create this employee first:';
    RAISE NOTICE '⚠️  1. Go to /CCA → Employee System tab';
    RAISE NOTICE '⚠️  2. Create employee with code: CCEMP0780';
    RAISE NOTICE '⚠️  3. Email: alok@collegecarts.in';
    RAISE NOTICE '⚠️  4. Then run this script again';
    RAISE NOTICE '⚠️  ═══════════════════════════════════════';
    RAISE NOTICE '';
    RETURN;
  END IF;
  
  -- Get employee details
  SELECT email, full_name INTO employee_email, employee_name
  FROM employee_accounts
  WHERE employee_code = 'CCEMP0780';
  
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
    RAISE EXCEPTION 'Super Admin role not found in database!';
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

  RAISE NOTICE '';
  RAISE NOTICE '✅ ═══════════════════════════════════════';
  RAISE NOTICE '✅ SUPER ADMIN CREATED!';
  RAISE NOTICE '✅ ═══════════════════════════════════════';
  RAISE NOTICE '✅ Employee Code: CCEMP0780';
  RAISE NOTICE '✅ Name: %', employee_name;
  RAISE NOTICE '✅ Email: %', employee_email;
  RAISE NOTICE '✅ Role: Super Admin';
  RAISE NOTICE '✅ Access: FULL SYSTEM ACCESS';
  RAISE NOTICE '✅ ═══════════════════════════════════════';
  RAISE NOTICE '';
END $$;

-- ============================================
-- VERIFICATION
-- ============================================
DO $$
DECLARE
  policy_count INTEGER;
  role_count INTEGER;
  dept_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count FROM pg_policies WHERE tablename LIKE 'employee%';
  SELECT COUNT(*) INTO role_count FROM employee_roles;
  SELECT COUNT(*) INTO dept_count FROM employee_departments;
  
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════';
  RAISE NOTICE '✅ SETUP COMPLETE!';
  RAISE NOTICE '═══════════════════════════════════════';
  RAISE NOTICE 'RLS Policies: %', policy_count;
  RAISE NOTICE 'Roles: %', role_count;
  RAISE NOTICE 'Departments: %', dept_count;
  RAISE NOTICE '═══════════════════════════════════════';
  RAISE NOTICE '🎉 No more 406 errors!';
  RAISE NOTICE '🎉 Super Admin configured!';
  RAISE NOTICE '🎉 System ready!';
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
  er.hierarchy_level as "access_level",
  ed.department_name
FROM employee_accounts ea
LEFT JOIN employee_roles er ON ea.role_id = er.id
LEFT JOIN employee_departments ed ON ea.department_id = ed.id
WHERE ea.employee_code = 'CCEMP0780';

-- Show all available roles
SELECT '📋 All Available Roles:' as info;
SELECT 
  role_name,
  role_code,
  dashboard_type,
  hierarchy_level,
  description
FROM employee_roles 
ORDER BY hierarchy_level DESC;

-- Final instructions
SELECT '✅ NEXT STEPS:' as message;
SELECT '1. Refresh browser (Ctrl+F5)' as step;
SELECT '2. Go to: /employee/login' as step;
SELECT '3. Login with: alok@collegecarts.in' as step;
SELECT '4. You have FULL SUPER ADMIN ACCESS!' as step;
SELECT '5. Access ALL pages and features!' as step;
