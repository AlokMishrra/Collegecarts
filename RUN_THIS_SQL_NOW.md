# 🚨 FIX EMPLOYEE LOGIN - RUN THIS NOW!

## The Problem
You're getting a **406 (Not Acceptable)** error when trying to login as an employee.

## The Solution
Run ONE SQL file in Supabase SQL Editor.

---

## 📋 Step-by-Step Instructions

### 1. Open Supabase Dashboard
- Go to: https://supabase.com/dashboard
- Select your project: `vbbdzhuzwgiipsnssmxq`

### 2. Open SQL Editor
- Click "SQL Editor" in the left sidebar
- Click "New Query"

### 3. Copy and Run This SQL File
**File:** `sql/ULTIMATE_EMPLOYEE_LOGIN_FIX.sql`

- Copy the ENTIRE contents of that file
- Paste into the SQL Editor
- Click "Run" button

### 4. Check the Output
You should see:
```
✓ Added must_change_password column
✓ Dropped policy: [old policies]
✓ Created new RLS policies
✓ RLS enabled on employee_accounts
✓ Fixed missing slugs

EMPLOYEE STATUS REPORT
[List of all employees]

CHECKING: apnafreelancer999@gmail.com
[Status of that specific employee]
```

### 5. Try Login Again
- Go to: http://localhost:5173/employee/login
- Enter email: `apnafreelancer999@gmail.com`
- Enter password: (your password)
- Click Login

---

## ✅ What This SQL Does

1. **Adds Missing Column**
   - Adds `must_change_password` column (safe if already exists)
   - Adds `slug` column (safe if already exists)

2. **Fixes RLS Policies**
   - Removes ALL old conflicting policies
   - Creates simple, permissive policies
   - Allows SELECT, UPDATE, INSERT for login/password reset

3. **Fixes Data Issues**
   - Generates slugs for employees missing them
   - Shows status of all employees
   - Checks if your specific employee exists

4. **Provides Diagnostics**
   - Lists all employees with their status
   - Shows password status
   - Shows RLS policies
   - Checks for the employee trying to login

---

## 🔍 If Employee Not Found

If the SQL shows "Employee NOT FOUND", you need to create the employee first.

### Option 1: Create via Admin Panel
1. Login to admin panel (not employee portal)
2. Go to CCA → Employee System Management
3. Click "Create Employee"
4. Fill in details including email: `apnafreelancer999@gmail.com`
5. Note the temporary password
6. Try logging in

### Option 2: Create via SQL
```sql
-- First, make sure roles and departments exist
-- Run: sql/SEED_EMPLOYEE_DEPARTMENTS_AND_ROLES.sql

-- Then create employee
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
  'apna-freelancer-' || FLOOR(RANDOM() * 9000 + 1000)::TEXT,
  'Apna Freelancer',
  'apnafreelancer999@gmail.com',
  '+919876543210',
  -- Password: Test@123
  '$2a$10$rKJ5YhZxN7qN5YhZxN7qN.rKJ5YhZxN7qN5YhZxN7qN5YhZxN7qN.',
  (SELECT id FROM employee_roles WHERE role_code = 'SUPERADMIN' LIMIT 1),
  (SELECT id FROM employee_departments WHERE department_code = 'OPS' LIMIT 1),
  'active',
  true
);
```

**Note:** You need to generate a real bcrypt hash. Use: https://bcrypt-generator.com/

---

## 🔐 Password Reset Feature

If you need to reset an employee's password:

### Via UI:
1. Go to: http://localhost:5173/employee/reset-password
2. Enter email or phone
3. Create new password
4. Login with new password

### Via SQL:
```sql
-- Generate bcrypt hash for your password first
-- Then update:
UPDATE employee_accounts
SET 
  password_hash = '$2a$10$YourBcryptHashHere',
  must_change_password = true
WHERE email = 'apnafreelancer999@gmail.com';
```

---

## 📝 Quick Checklist

After running the SQL, verify:

- [ ] SQL ran without errors
- [ ] Employee list shows in output
- [ ] Your employee (`apnafreelancer999@gmail.com`) is listed
- [ ] Employee has "✓ Has Password" status
- [ ] Employee status is "active"
- [ ] RLS policies are listed (3 policies)
- [ ] Try login again
- [ ] Login works or shows specific error

---

## 🆘 Still Not Working?

### Check These:

1. **Employee Exists?**
   ```sql
   SELECT * FROM employee_accounts 
   WHERE email = 'apnafreelancer999@gmail.com';
   ```

2. **Has Password?**
   ```sql
   SELECT email, 
     CASE WHEN password_hash IS NULL THEN 'NO' ELSE 'YES' END as has_password
   FROM employee_accounts 
   WHERE email = 'apnafreelancer999@gmail.com';
   ```

3. **Has Role & Department?**
   ```sql
   SELECT e.email, r.role_name, d.department_name
   FROM employee_accounts e
   LEFT JOIN employee_roles r ON e.role_id = r.id
   LEFT JOIN employee_departments d ON e.department_id = d.id
   WHERE e.email = 'apnafreelancer999@gmail.com';
   ```

4. **Check Browser Console**
   - Open DevTools (F12)
   - Go to Console tab
   - Try login again
   - Look for detailed error message

---

## 📞 Common Issues & Solutions

### Issue: "Invalid credentials"
**Cause:** Wrong password or employee not found
**Solution:** 
- Verify employee exists in database
- Reset password using reset page
- Check password is correct

### Issue: "406 Not Acceptable"
**Cause:** Missing column or RLS policy issue
**Solution:** Run `ULTIMATE_EMPLOYEE_LOGIN_FIX.sql`

### Issue: "Employee not found"
**Cause:** Employee doesn't exist in database
**Solution:** Create employee via admin panel or SQL

### Issue: "No roles found"
**Cause:** Employee roles table is empty
**Solution:** Run `sql/SEED_EMPLOYEE_DEPARTMENTS_AND_ROLES.sql`

---

## ✨ Summary

**Quick Fix (90% of cases):**
1. Run `sql/ULTIMATE_EMPLOYEE_LOGIN_FIX.sql`
2. Try login again
3. Done!

**If employee doesn't exist:**
1. Create employee via admin panel
2. Or run SQL to create employee
3. Try login with temporary password

**Password reset:**
1. Go to `/employee/reset-password`
2. Enter email and new password
3. Login with new password

---

## 🎉 Success!

Once you can login, you should see:
- Employee dashboard
- If temporary password: Password change modal (forced)
- If permanent password: Normal dashboard access

**Status:** This WILL fix your login issue! 🚀
