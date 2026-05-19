# Employee Password Security Setup

## Problem
The `EmployeeSystemManagement` component cannot use `bcryptjs` in the frontend because:
1. **bcryptjs is a Node.js library** - it doesn't work in browsers
2. **Vercel build fails** when trying to import Node.js-only packages
3. **Security risk** - password hashing should NEVER be done in the frontend (client can see the code)

## Solution: Database-Level Password Hashing

We've implemented **automatic password hashing at the database level** using PostgreSQL triggers.

### How It Works

1. **Frontend sends plain text password** to database
2. **Database trigger automatically hashes it** before storing
3. **Hashed password is stored** in `password_hash` column
4. **Frontend never handles hashing** - more secure!

### Setup Instructions

#### Step 1: Run the SQL Migration

Run this SQL in your Supabase SQL Editor:

```bash
sql/add-employee-password-hashing-trigger.sql
```

This will:
- Enable `pgcrypto` extension (PostgreSQL's crypto functions)
- Create a trigger function that hashes passwords using bcrypt
- Attach triggers to `employee_accounts` table for INSERT and UPDATE
- Only hash passwords that aren't already hashed (prevents double-hashing)

#### Step 2: Verify It's Working

After running the migration, test it:

```sql
-- Insert a test employee with plain text password
INSERT INTO employee_accounts (
  full_name, 
  email, 
  password_hash, 
  employee_code, 
  slug, 
  role_id, 
  status
)
VALUES (
  'Test Employee', 
  'test@example.com', 
  'mypassword123',  -- Plain text password
  'TEST001', 
  'test-employee-test001', 
  (SELECT id FROM employee_roles LIMIT 1), 
  'active'
);

-- Check if password was hashed
SELECT employee_code, password_hash 
FROM employee_accounts 
WHERE employee_code = 'TEST001';

-- You should see something like:
-- $2a$10$abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNO
```

If the password starts with `$2a$` or `$2b$` and is 60 characters long, **it's working!**

#### Step 3: Clean Up Test Data

```sql
DELETE FROM employee_accounts WHERE employee_code = 'TEST001';
```

## How to Use in Frontend

The frontend code in `EmployeeSystemManagement.jsx` now works like this:

```javascript
// When creating an employee
const employeeData = {
  full_name: 'John Doe',
  email: 'john@example.com',
  password_hash: 'plaintext_password',  // Send plain text
  employee_code: 'EMP001',
  slug: 'john-doe-emp001',
  role_id: 'role-uuid',
  status: 'active'
};

// Database trigger will automatically hash it before storing
await supabase.from('employee_accounts').insert(employeeData);
```

## Password Verification (Login)

When an employee logs in, you need to verify their password:

```sql
-- Create a function to verify passwords
CREATE OR REPLACE FUNCTION verify_employee_password(
  p_email TEXT,
  p_password TEXT
)
RETURNS TABLE (
  employee_id UUID,
  is_valid BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    id,
    (password_hash = crypt(p_password, password_hash)) as is_valid
  FROM employee_accounts
  WHERE email = p_email AND status = 'active';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

Then in your frontend login:

```javascript
const { data, error } = await supabase
  .rpc('verify_employee_password', {
    p_email: email,
    p_password: password
  });

if (data && data[0]?.is_valid) {
  // Login successful
} else {
  // Invalid credentials
}
```

## Security Benefits

✅ **Passwords hashed server-side** - client never sees hashing logic  
✅ **Bcrypt algorithm** - industry standard, resistant to brute force  
✅ **Automatic** - developers can't forget to hash passwords  
✅ **No frontend dependencies** - Vercel builds succeed  
✅ **Prevents double-hashing** - checks if already hashed before hashing again  

## Migration Status

- [x] SQL trigger created
- [x] Frontend updated to send plain text passwords
- [x] Documentation created
- [ ] **YOU NEED TO RUN**: `sql/add-employee-password-hashing-trigger.sql` in Supabase
- [ ] Test employee creation
- [ ] Implement login verification function

## Important Notes

⚠️ **BEFORE PRODUCTION**: Make sure you've run the SQL migration!  
⚠️ **Existing passwords**: If you have existing employees with plain text passwords, they'll be hashed on next update  
⚠️ **Password verification**: You need to implement the verification function for login  

## Alternative: Supabase Auth

For a more complete solution, consider using **Supabase Auth** for employee accounts:

```javascript
// Create employee auth account
const { data, error } = await supabase.auth.admin.createUser({
  email: 'employee@example.com',
  password: 'secure_password',
  email_confirm: true,
  user_metadata: {
    employee_code: 'EMP001',
    role: 'manager'
  }
});
```

This gives you:
- Automatic password hashing
- Session management
- Password reset flows
- Email verification
- Multi-factor authentication
- JWT tokens

## Questions?

If you have issues:
1. Check Supabase logs for trigger errors
2. Verify `pgcrypto` extension is enabled
3. Ensure RLS policies allow the operations
4. Test with the SQL commands above
