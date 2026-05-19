-- ============================================================
-- ADD PASSWORD CHANGE TRACKING TO EMPLOYEE ACCOUNTS
-- ============================================================
-- This adds a field to track if employee must change password on next login

-- Add must_change_password column
ALTER TABLE employee_accounts 
ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT false;

-- Add comment
COMMENT ON COLUMN employee_accounts.must_change_password IS 'Flag to force password change on next login (for temporary passwords)';

-- Update existing employees with temporary passwords (if any)
-- This is optional - only if you want to force existing employees to change passwords
-- UPDATE employee_accounts SET must_change_password = true WHERE created_at > NOW() - INTERVAL '7 days';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✓ Password change tracking added to employee_accounts table';
  RAISE NOTICE '  - Column: must_change_password (boolean)';
  RAISE NOTICE '  - Default: false';
  RAISE NOTICE '';
  RAISE NOTICE 'When creating employees with temporary passwords, set must_change_password = true';
END $$;
