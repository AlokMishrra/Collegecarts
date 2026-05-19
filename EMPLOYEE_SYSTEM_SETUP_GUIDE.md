# Employee System - Quick Setup Guide

## Step 1: Install Dependencies

```bash
npm install
```

This will install the newly added dependencies:
- `bcryptjs` - Password hashing
- `qrcode` - QR code generation
- `jspdf-autotable` - PDF table generation

## Step 2: Run Database Migration

1. Open Supabase Dashboard
2. Go to SQL Editor
3. Open the file: `supabase/migrations/20260513000003_employee_system_complete.sql`
4. Copy all content
5. Paste in SQL Editor
6. Click "Run"
7. Verify all tables created successfully

## Step 3: Integrate with Main App

### 3.1 Add Employee Auth Provider

In `src/App.jsx`, add the import:

```javascript
import { EmployeeAuthProvider } from '@/contexts/EmployeeAuthContext';
```

Wrap your app (add BEFORE AuthProvider):

```javascript
<EmployeeAuthProvider>
  <AuthProvider>
    {/* existing app content */}
  </AuthProvider>
</EmployeeAuthProvider>
```

### 3.2 Add Employee Routes

In `src/App.jsx`, add imports:

```javascript
import EmployeeLogin from '@/pages/employee/EmployeeLogin';
import EmployeeLayout from '@/pages/employee/EmployeeLayout';
import EmployeeDashboard from '@/pages/employee/EmployeeDashboard';
import EmployeeProfile from '@/pages/employee/EmployeeProfile';
import CreateStockOrder from '@/pages/employee/CreateStockOrder';
import EmployeeAuthGuard from '@/components/EmployeeAuthGuard';
```

Add routes (inside `<Routes>`):

```javascript
{/* Employee System Routes */}
<Route path="/employee/login" element={<EmployeeLogin />} />
<Route 
  path="/employee" 
  element={
    <EmployeeAuthGuard>
      <EmployeeLayout />
    </EmployeeAuthGuard>
  }
>
  <Route path="dashboard" element={<EmployeeDashboard />} />
  <Route path=":slug" element={<EmployeeProfile />} />
  <Route path="stock-orders/create" element={<CreateStockOrder />} />
</Route>
```

### 3.3 Add Employee System Tab to Admin Panel

In `src/pages/CCA.jsx`, add import:

```javascript
import EmployeeSystemManagement from '@/components/admin/EmployeeSystemManagement';
import { Briefcase } from 'lucide-react';
```

Add to tabs array:

```javascript
{
  value: "employee-system",
  label: "Employee System",
  icon: Briefcase,
  component: EmployeeSystemManagement
}
```

## Step 4: Test the System

### 4.1 Create First Employee (Super Admin)

1. Login to admin panel
2. Go to "Employee System" tab
3. Click "Add Employee"
4. Fill in details:
   - Full Name: Your Name
   - Email: your@email.com
   - Phone: +91 9876543210
   - Password: (choose a strong password)
   - Role: Employee Super Admin
   - Department: Management
   - Status: Active
5. Click "Create Employee"
6. Note the generated employee code (e.g., CCEMP0001)

### 4.2 Test Employee Login

1. Navigate to: `http://localhost:5173/employee/login`
2. Enter email or phone
3. Enter password
4. Check "Remember this device" (optional)
5. Click "Login to Dashboard"
6. You should be redirected to employee dashboard

### 4.3 Test Attendance

1. On dashboard, click "Check In"
2. Allow location access if prompted
3. Verify check-in time displayed
4. Later, click "Check Out"
5. Verify work hours calculated

### 4.4 Test Stock Order Creation

1. Navigate to "Create Order" (from sidebar or quick actions)
2. Search for products
3. Add items to order
4. Set priority and notes
5. Click "Create Stock Order"
6. Verify order created successfully

### 4.5 Test Profile Page

1. Click on your name in top right
2. Click "My Profile"
3. Verify profile information displayed
4. Verify QR code generated
5. Test "Download ID Card" button (when implemented)

## Step 5: Create Additional Employees

Create employees for different roles to test role-based access:

1. **Delivery Partner**
   - Role: Delivery Partner
   - Department: Delivery
   - Test delivery dashboard

2. **Stock Manager**
   - Role: Stock Manager
   - Department: Stock Management
   - Test stock order approval

3. **Finance Manager**
   - Role: Finance Manager
   - Department: Finance
   - Test salary management

## Step 6: Verify Database

Check that data is being created:

```sql
-- Check employees
SELECT * FROM employee_accounts;

-- Check sessions
SELECT * FROM employee_sessions WHERE is_active = true;

-- Check attendance
SELECT * FROM employee_attendance WHERE attendance_date = CURRENT_DATE;

-- Check stock orders
SELECT * FROM employee_stock_orders;

-- Check activity logs
SELECT * FROM employee_activity_logs ORDER BY created_at DESC LIMIT 10;
```

## Troubleshooting

### Issue: Cannot login

**Solution:**
1. Check if employee exists in database
2. Verify status is 'active'
3. Check password was hashed correctly
4. Check browser console for errors

### Issue: Session expires immediately

**Solution:**
1. Check `employee_sessions` table
2. Verify `expires_at` is in future
3. Check `is_active` is true
4. Clear browser localStorage and try again

### Issue: Stock order not syncing with main inventory

**Solution:**
1. Check if trigger exists: `sync_stock_on_fulfillment`
2. Verify order status is 'fulfilled'
3. Check `employee_inventory_transactions` table
4. Manually run trigger function if needed

### Issue: Permission denied errors

**Solution:**
1. Check RLS policies are enabled
2. Verify employee role has correct permissions
3. Check `employee_roles` table for role permissions
4. Check `employee_permissions_override` for custom permissions

### Issue: QR code not generating

**Solution:**
1. Verify `qrcode` package installed
2. Check browser console for errors
3. Verify employee data is loaded
4. Check network tab for any failed requests

## Next Steps

After basic setup is working:

1. ✅ Create remaining pages (see EMPLOYEE_SYSTEM_IMPLEMENTATION_REPORT.md)
2. ✅ Implement PDF generation for stock orders
3. ✅ Build salary calculation engine
4. ✅ Create delivery management interface
5. ✅ Build finance dashboard
6. ✅ Implement analytics dashboard
7. ✅ Create support ticket system
8. ✅ Add email notifications
9. ✅ Implement internal chat
10. ✅ Add performance metrics

## Security Checklist

- [ ] All passwords are hashed with bcrypt
- [ ] RLS policies are enabled on all tables
- [ ] Session tokens are secure random strings
- [ ] Sensitive data (prices) hidden from normal employees
- [ ] Activity logging is working
- [ ] Audit trail is capturing all actions
- [ ] Session expiration is working
- [ ] Device tracking is enabled
- [ ] IP addresses are being logged
- [ ] Permission checks are in place

## Performance Checklist

- [ ] Database indexes are created
- [ ] Queries are optimized
- [ ] React Query caching is configured
- [ ] Components are memoized where needed
- [ ] Images are optimized
- [ ] Lazy loading is implemented
- [ ] Bundle size is reasonable
- [ ] No memory leaks
- [ ] No unnecessary re-renders
- [ ] API calls are debounced/throttled

## Production Deployment Checklist

- [ ] All environment variables set
- [ ] Database migration run on production
- [ ] SSL certificates configured
- [ ] CORS settings configured
- [ ] Rate limiting enabled
- [ ] Error tracking configured (Sentry)
- [ ] Analytics configured
- [ ] Backup strategy in place
- [ ] Monitoring configured
- [ ] Load testing completed

## Support

For issues or questions:
1. Check EMPLOYEE_SYSTEM_IMPLEMENTATION_REPORT.md
2. Review database logs
3. Check browser console
4. Review activity logs in database
5. Check RLS policies

## Resources

- Database Schema: `supabase/migrations/20260513000003_employee_system_complete.sql`
- Implementation Report: `EMPLOYEE_SYSTEM_IMPLEMENTATION_REPORT.md`
- Entity Classes: `src/entities/Employee*.js`
- Auth Context: `src/contexts/EmployeeAuthContext.jsx`
- Pages: `src/pages/employee/`
- Components: `src/components/admin/EmployeeSystemManagement.jsx`

---

**Setup Guide Version**: 1.0.0
**Last Updated**: May 13, 2026
