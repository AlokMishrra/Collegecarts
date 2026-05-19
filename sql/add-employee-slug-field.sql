-- ============================================================================
-- ADD SLUG FIELD TO EMPLOYEE ACCOUNTS AND POPULATE IT
-- ============================================================================
-- This script adds the slug field to employee_accounts table if it doesn't exist
-- and populates it for all existing employees
-- ============================================================================

-- Step 1: Add slug column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'employee_accounts' 
        AND column_name = 'slug'
    ) THEN
        ALTER TABLE employee_accounts 
        ADD COLUMN slug TEXT UNIQUE;
        
        RAISE NOTICE 'Added slug column to employee_accounts';
    ELSE
        RAISE NOTICE 'Slug column already exists';
    END IF;
END $$;

-- Step 2: Create function to generate slug
CREATE OR REPLACE FUNCTION generate_employee_slug(
    p_full_name TEXT,
    p_employee_code TEXT
) RETURNS TEXT AS $$
DECLARE
    v_slug TEXT;
    v_base_slug TEXT;
    v_counter INTEGER := 0;
BEGIN
    -- Generate base slug from name
    v_base_slug := lower(
        regexp_replace(
            regexp_replace(p_full_name, '[^a-zA-Z0-9\s]', '', 'g'),
            '\s+', '-', 'g'
        )
    );
    
    -- Remove leading/trailing hyphens
    v_base_slug := trim(both '-' from v_base_slug);
    
    -- Combine with employee code
    v_slug := v_base_slug || '-' || p_employee_code;
    
    -- Ensure uniqueness (in case of duplicates)
    WHILE EXISTS (SELECT 1 FROM employee_accounts WHERE slug = v_slug) LOOP
        v_counter := v_counter + 1;
        v_slug := v_base_slug || '-' || p_employee_code || '-' || v_counter;
    END LOOP;
    
    RETURN v_slug;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Populate slug for all existing employees that don't have one
UPDATE employee_accounts
SET slug = generate_employee_slug(full_name, employee_code)
WHERE slug IS NULL OR slug = '';

-- Step 4: Create index on slug for performance
CREATE INDEX IF NOT EXISTS idx_employee_accounts_slug 
ON employee_accounts(slug);

-- Step 5: Add constraint to ensure slug is not null for new records
ALTER TABLE employee_accounts 
ALTER COLUMN slug SET NOT NULL;

-- Step 6: Create trigger to auto-generate slug on insert
CREATE OR REPLACE FUNCTION auto_generate_employee_slug()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.slug IS NULL OR NEW.slug = '' THEN
        NEW.slug := generate_employee_slug(NEW.full_name, NEW.employee_code);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_generate_employee_slug ON employee_accounts;
CREATE TRIGGER trigger_auto_generate_employee_slug
    BEFORE INSERT OR UPDATE ON employee_accounts
    FOR EACH ROW
    EXECUTE FUNCTION auto_generate_employee_slug();

-- Step 7: Verify results
DO $$
DECLARE
    v_total_employees INTEGER;
    v_employees_with_slug INTEGER;
    v_employees_without_slug INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_total_employees FROM employee_accounts;
    SELECT COUNT(*) INTO v_employees_with_slug FROM employee_accounts WHERE slug IS NOT NULL AND slug != '';
    SELECT COUNT(*) INTO v_employees_without_slug FROM employee_accounts WHERE slug IS NULL OR slug = '';
    
    RAISE NOTICE '===========================================';
    RAISE NOTICE 'EMPLOYEE SLUG FIELD SETUP COMPLETE';
    RAISE NOTICE '===========================================';
    RAISE NOTICE 'Total Employees: %', v_total_employees;
    RAISE NOTICE 'Employees with Slug: %', v_employees_with_slug;
    RAISE NOTICE 'Employees without Slug: %', v_employees_without_slug;
    RAISE NOTICE '===========================================';
    
    IF v_employees_without_slug > 0 THEN
        RAISE WARNING 'Some employees still do not have slugs!';
    ELSE
        RAISE NOTICE 'All employees have slugs! ✓';
    END IF;
END $$;

-- Step 8: Show sample employee slugs
SELECT 
    employee_code,
    full_name,
    slug,
    email,
    status
FROM employee_accounts
ORDER BY created_at DESC
LIMIT 10;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check if slug column exists
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'employee_accounts' 
AND column_name = 'slug';

-- Check for duplicate slugs (should return 0 rows)
SELECT slug, COUNT(*) as count
FROM employee_accounts
GROUP BY slug
HAVING COUNT(*) > 1;

-- Check employees without slugs (should return 0 rows)
SELECT employee_code, full_name, email
FROM employee_accounts
WHERE slug IS NULL OR slug = '';

-- ============================================================================
-- NOTES
-- ============================================================================
-- 1. This script is SAFE to run multiple times
-- 2. It will only add the slug column if it doesn't exist
-- 3. It will only populate slugs for employees that don't have one
-- 4. The trigger ensures all new employees automatically get a slug
-- 5. Slugs are unique and indexed for fast lookups
-- ============================================================================
