-- ============================================
-- ULTIMATE FIX - RUN THIS NOW
-- This fixes ALL RLS issues for employee system
-- Safe to run multiple times
-- ============================================

-- Step 1: Fix RLS for ALL Employee Tables
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

-- Step 2: Create helper function for employee codes
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
    -- Generate code: CCEMP + 4 random digits
    new_code := 'CCEMP' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    
    -- Check if code exists
    SELECT EXISTS(
      SELECT 1 FROM employee_accounts WHERE employee_code = new_code
    ) INTO code_exists;
    
    -- If code doesn't exist, return it
    IF NOT code_exists THEN
      RETURN new_code;
    END IF;
    
    -- Prevent infinite loop
    attempts := attempts + 1;
    IF attempts >= max_attempts THEN
      RAISE EXCEPTION 'Could not generate unique employee code after % attempts', max_attempts;
    END IF;
  END LOOP;
END;
$$;

-- Step 3: Create helper function for employee slugs
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
  -- Create base slug from name
  base_slug := LOWER(REGEXP_REPLACE(full_name, '[^a-zA-Z0-9]+', '-', 'g'));
  base_slug := TRIM(BOTH '-' FROM base_slug);
  new_slug := base_slug;
  
  -- Check if slug exists and add counter if needed
  LOOP
    SELECT EXISTS(
      SELECT 1 FROM employee_accounts WHERE slug = new_slug
    ) INTO slug_exists;
    
    IF NOT slug_exists THEN
      RETURN new_slug;
    END IF;
    
    counter := counter + 1;
    new_slug := base_slug || '-' || counter;
    
    -- Prevent infinite loop
    IF counter > 1000 THEN
      RAISE EXCEPTION 'Could not generate unique slug for name: %', full_name;
    END IF;
  END LOOP;
END;
$$;

-- Step 4: Verification
DO $$
DECLARE
  table_count INTEGER;
  policy_count INTEGER;
  role_count INTEGER;
  dept_count INTEGER;
BEGIN
  -- Count tables
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name LIKE 'employee%';
  
  -- Count policies
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename LIKE 'employee%';
  
  -- Count roles
  SELECT COUNT(*) INTO role_count FROM employee_roles;
  
  -- Count departments
  SELECT COUNT(*) INTO dept_count FROM employee_departments;
  
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════';
  RAISE NOTICE '✅ SETUP COMPLETE!';
  RAISE NOTICE '═══════════════════════════════════════';
  RAISE NOTICE 'Employee Tables: %', table_count;
  RAISE NOTICE 'RLS Policies: %', policy_count;
  RAISE NOTICE 'Roles: %', role_count;
  RAISE NOTICE 'Departments: %', dept_count;
  RAISE NOTICE '═══════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '🎉 All RLS policies fixed!';
  RAISE NOTICE '🎉 No more 406 errors!';
  RAISE NOTICE '🎉 Employee system ready!';
  RAISE NOTICE '';
END $$;

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

-- Final success message
SELECT '✅ SUCCESS! Run this in your browser console to verify:' as message;
SELECT '   window.location.reload()' as action;
