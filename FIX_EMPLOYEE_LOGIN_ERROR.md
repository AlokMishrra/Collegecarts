# Fix Employee Login 406 Error

## Problem
Getting "406 (Not Acceptable)" error when trying to login as employee with email `apnafreelancer999@gmail.com`.

## Root Cause
The `must_change_password` column doesn't exist in the `employee_accounts` table, causing the SELECT query to fail.

---

## 🔧 Solution - Run These SQL Files in Order

### Step 1: Check Current State
Run this in Supabase SQL Editor to see what's wrong:

**File:** `sql/CHECK_EMPLOYEE_LOGIN_ISSUE.sql`

This will show:
- If the employee exists
- If password hash is set
- If must_change_password column exists
- Current RLS policies

### Step 2: Fix the Database
Run this in Supabase SQL Editor:

**File:** `sql/FIX_EMPLOYEE_LOGIN_AND_PASSWORD.sql`

This will:
- ✅ Add `must_change_password` column
- ✅ Fix RLS policies to allow login
- ✅ Verify employee data
- ✅ List all employees

### Step 3: Verify the Fix
After running the SQL, you should see output like:

```
✓ Added must_change_password column
✓ All employees have password hashes
✓ Found X employee roles
✓ Found X employee departments

Employee List:
employee_code | full_name | email | password_status | password_change_status
```

---

## 🧪 Test Login Again

1. Go to `/employee/login`
2. Enter email: `apnafreelancer999@gmail.com`
3. Enter password: (your password)
4. Click Login

**Expected Result:**
- If password is temporary → Forced password change modal appears
- If password is permanent → Redirects to dashboard

---

## 🔍 Troubleshooting

### Issue: Employee Not Found
**Check:**
```sql
SELECT * FROM employee_accounts WHERE email = 'apnafreelancer999@gmail.com';
```

**Solution:** Create the employee first using the admin panel or run:
```sql
-- See: sql/seed-employee-data.sql for example
```

### Issue: Password Hash Missing
**Check:**
```sql
SELECT employee_code, email, 
  CASE WHEN password_hash IS NULL THEN 'Missing' ELSE 'Set' END as pwd_status
FROM employee_accounts;
```

**Solution:** Reset password for that employee:
```sql
-- You'll need to hash a password with bcrypt first
-- Or create a new employee through the UI
```

### Issue: RLS Policy Blocking
**Check:**
```sql
SELECT * FROM pg_policies WHERE tablename = 'employee_accounts';
```

**Solution:** The fix SQL already handles this, but if needed:
```sql
-- Allow public read for login
CREATE POLICY "Allow public read for employee login"
ON employee_accounts FOR SELECT TO public USING (true);

-- Allow password updates
CREATE POLICY "Allow employees to update their own password"
ON employee_accounts FOR UPDATE TO public USING (true) WITH CHECK (true);
```

### Issue: Role or Department Missing
**Check:**
```sql
SELECT 
  e.employee_code,
  e.email,
  r.role_name,
  d.department_name
FROM employee_accounts e
LEFT JOIN employee_roles r ON e.role_id = r.id
LEFT JOIN employee_departments d ON e.department_id = d.id
WHERE e.email = 'apnafreelancer999@gmail.com';
```

**Solution:** Run the seed file:
```sql
-- File: sql/SEED_EMPLOYEE_DEPARTMENTS_AND_ROLES.sql
```

---

## 📝 Quick Reference

### Employee Login Credentials Format
- **Email:** Valid email address
- **Phone:** 10-digit number (can also be used to login)
- **Password:** Bcrypt hashed string

### Temporary Password Format
When creating employees, temporary passwords are generated as:
- Format: `CC` + 8 random alphanumeric characters
- Example: `CCAB12CD34`
- Flag: `must_change_password = true`

### Check Employee Password
```sql
SELECT 
  employee_code,
  email,
  LEFT(password_hash, 20) as hash_preview,
  must_change_password,
  status
FROM employee_accounts
WHERE email = 'apnafreelancer999@gmail.com';
```

---

## ✅ Verification Checklist

After running the fix SQL, verify:

- [ ] `must_change_password` column exists
- [ ] RLS policies allow SELECT and UPDATE
- [ ] Employee exists in database
- [ ] Employee has password_hash set
- [ ] Employee has valid role_id
- [ ] Employee has valid department_id
- [ ] Employee status is 'active'
- [ ] Can login successfully
- [ ] Password change modal appears if needed
- [ ] Can access dashboard after login

---

## 🚀 If All Else Fails

### Option 1: Create New Employee via UI
1. Login to admin panel (not employee portal)
2. Go to CCA → Employee System Management
3. Click "Create Employee"
4. Fill in details
5. Note the temporary password
6. Try logging in with new employee

### Option 2: Create Employee via SQL
```sql
-- Generate a bcrypt hash for password "Test@123"
-- You can use: https://bcrypt-generator.com/
-- Or use the UI to create employee

INSERT INTO employee_accounts (
  employee_code,
  slug,
  full_name,
  email,
  phone,
  password_hash,
  role_id,
  department_id,
  status,
  must_change_password
) VALUES (
  'CCEMP' || FLOOR(RANDOM() * 9000 + 1000)::TEXT,
  'test-employee-' || FLOOR(RANDOM() * 9000 + 1000)::TEXT,
  'Test Employee',
  'test@example.com',
  '+919876543210',
  '$2a$10$YourBcryptHashHere', -- Replace with actual bcrypt hash
  (SELECT id FROM employee_roles WHERE role_code = 'SUPERADMIN' LIMIT 1),
  (SELECT id FROM employee_departments WHERE department_code = 'OPS' LIMIT 1),
  'active',
  true
);
```

---

## 📞 Need More Help?

1. Run `CHECK_EMPLOYEE_LOGIN_ISSUE.sql` and share the output
2. Check browser console for full error message
3. Check Supabase logs for detailed error
4. Verify .env file has correct Supabase credentials

---

## Summary

**Quick Fix:**
1. Run `sql/FIX_EMPLOYEE_LOGIN_AND_PASSWORD.sql` in Supabase
2. Try login again
3. If still fails, run `sql/CHECK_EMPLOYEE_LOGIN_ISSUE.sql` to diagnose

**Status:** This should fix the 406 error! 🎉
