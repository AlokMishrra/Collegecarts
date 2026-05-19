-- ============================================
-- FIX RLS POLICIES ONLY (NO DATA SEEDING)
-- Run this if you already have roles/departments
-- ============================================

-- Fix RLS for ALL Employee Tables
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

-- Create generate_employee_code function if not exists
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

-- Verification
SELECT '✅ RLS FIXED!' as status;
SELECT 'RLS Policies:' as info, COUNT(*) as count FROM pg_policies WHERE tablename LIKE 'employee%';
SELECT 'Roles:' as info, COUNT(*) as count FROM employee_roles;
SELECT 'Departments:' as info, COUNT(*) as count FROM employee_departments;
