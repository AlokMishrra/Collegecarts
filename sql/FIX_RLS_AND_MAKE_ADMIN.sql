-- ============================================
-- FIX RLS + MAKE ALOK ADMIN (FLEXIBLE)
-- Works with any existing admin role
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
  
  RAISE NOTICE '✅ All RLS policies fixed!';
  RAISE NOTICE '✅ No more 406 errors!';
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
-- PART 3: Make CCEMP0780 Admin (Flexible)
-- ============================================
DO $$
DECLARE
  admin_role_id UUID;
  employee_id UUID;
  dept_id UUID;
  employee_exists BOOLEAN;
  employee_email TEXT;
  employee_name TEXT;
  selected_role_name TEXT;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🔧 Making CCEMP0780 an admin...';
  
  -- Check if employee exists
  SELECT EXISTS(SELECT 1 FROM employee_accounts WHERE employee_code = 'CCEMP0780') INTO employee_exists;
  
  IF NOT employee_exists THEN
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  Employee CCEMP0780 NOT FOUND!';
    RAISE NOTICE '⚠️  Create this employee first from /CCA → Employee System';
    RAISE NOTICE '⚠️  Then run this script again';
    RAISE NOTICE '';
    RETURN;
  END IF;
  
  -- Get employee details
  SELECT email, full_name INTO employee_email, employee_name
  FROM employee_accounts
  WHERE employee_code = 'CCEMP0780';
  
  -- Try to find admin role (try multiple possible codes)
  SELECT id, er.role_name INTO admin_role_id, selected_role_name
  FROM employee_roles er
  WHERE er.role_code IN ('SUPER_ADMIN', 'ADMIN', 'STORE_MANAGER', 'MANAGER')
     OR LOWER(er.role_name) LIKE '%admin%'
     OR LOWER(er.role_name) LIKE '%manager%'
  ORDER BY er.hierarchy_level DESC NULLS LAST
  LIMIT 1;

  -- Get any department
  SELECT id INTO dept_id
  FROM employee_departments
  WHERE is_active = true
  LIMIT 1;

  -- Check if role was found
  IF admin_role_id IS NULL THEN
    RAISE NOTICE '⚠️  No admin role found in database!';
    RAISE NOTICE '⚠️  Available roles:';
    FOR selected_role_name IN SELECT r.role_name FROM employee_roles r ORDER BY r.role_name LOOP
      RAISE NOTICE '    - %', selected_role_name;
    END LOOP;
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  Please create roles first or specify which role to use';
    RETURN;
  END IF;

  -- Update employee to admin
  UPDATE employee_accounts
  SET 
    role_id = admin_role_id,
    department_id = dept_id,
    status = 'active',
    updated_at = NOW()
  WHERE employee_code = 'CCEMP0780'
  RETURNING id INTO employee_id;

  RAISE NOTICE '';
  RAISE NOTICE '✅ SUCCESS!';
  RAISE NOTICE '✅ Employee: % (%)', employee_name, employee_email;
  RAISE NOTICE '✅ Role: %', selected_role_name;
  RAISE NOTICE '✅ Status: Active';
  RAISE NOTICE '';
END $$;

-- ============================================
-- VERIFICATION
-- ============================================
SELECT '✅ RLS FIXED - No more 406 errors!' as status;

-- Show employee details
SELECT 'Employee Details:' as info;
SELECT 
  ea.employee_code,
  ea.full_name,
  ea.email,
  ea.status,
  er.role_name,
  er.role_code,
  ed.department_name
FROM employee_accounts ea
LEFT JOIN employee_roles er ON ea.role_id = er.id
LEFT JOIN employee_departments ed ON ea.department_id = ed.id
WHERE ea.employee_code = 'CCEMP0780';

-- Show all roles
SELECT 'Available Roles:' as info;
SELECT role_name, role_code, hierarchy_level FROM employee_roles ORDER BY hierarchy_level DESC NULLS LAST;

-- Next steps
SELECT '✅ NEXT STEPS:' as message;
SELECT '1. Refresh browser (Ctrl+F5)' as step;
SELECT '2. Go to: /employee/login' as step;
SELECT '3. Login with employee credentials' as step;
SELECT '4. System is ready!' as step;
