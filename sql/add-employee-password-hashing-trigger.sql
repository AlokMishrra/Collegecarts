-- Enable pgcrypto extension for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create function to hash employee passwords
CREATE OR REPLACE FUNCTION hash_employee_password()
RETURNS TRIGGER AS $$
BEGIN
  -- Only hash if password_hash is provided and doesn't look like it's already hashed
  -- bcrypt hashes start with $2a$, $2b$, or $2y$ and are 60 characters long
  IF NEW.password_hash IS NOT NULL AND 
     (NEW.password_hash !~ '^\$2[aby]\$' OR LENGTH(NEW.password_hash) != 60) THEN
    -- Hash the password using bcrypt (blowfish algorithm)
    NEW.password_hash := crypt(NEW.password_hash, gen_salt('bf', 10));
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for INSERT operations
DROP TRIGGER IF EXISTS hash_employee_password_on_insert ON employee_accounts;
CREATE TRIGGER hash_employee_password_on_insert
  BEFORE INSERT ON employee_accounts
  FOR EACH ROW
  EXECUTE FUNCTION hash_employee_password();

-- Create trigger for UPDATE operations
DROP TRIGGER IF EXISTS hash_employee_password_on_update ON employee_accounts;
CREATE TRIGGER hash_employee_password_on_update
  BEFORE UPDATE ON employee_accounts
  FOR EACH ROW
  WHEN (OLD.password_hash IS DISTINCT FROM NEW.password_hash)
  EXECUTE FUNCTION hash_employee_password();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION hash_employee_password() TO authenticated;
GRANT EXECUTE ON FUNCTION hash_employee_password() TO service_role;

-- Test the trigger (optional - comment out in production)
-- INSERT INTO employee_accounts (full_name, email, password_hash, employee_code, slug, role_id, status)
-- VALUES ('Test Employee', 'test@example.com', 'plaintext123', 'TEST001', 'test-employee-test001', 
--         (SELECT id FROM employee_roles LIMIT 1), 'active');
-- 
-- SELECT employee_code, password_hash FROM employee_accounts WHERE employee_code = 'TEST001';
-- Should show a hashed password starting with $2a$ or $2b$

COMMENT ON FUNCTION hash_employee_password() IS 'Automatically hashes employee passwords using bcrypt before insert/update';
