# Employee Payout System - Quick Start Guide

## 🚀 Get Started in 3 Steps

### Step 1: Run SQL Setup (2 minutes)
Open **Supabase SQL Editor** and run:
```
sql/COMPLETE_PAYOUT_SYSTEM_SETUP.sql
```

This creates the payout table, foreign keys, and security policies.

### Step 2: Login as Super Admin
1. Go to `/employee/login`
2. Login with Super Admin credentials
3. Email: `apnafreelancer999@gmail.com`
4. Password: `Test@123` (or your Super Admin password)

### Step 3: Access Payout Management
1. Click **"Payouts"** in the sidebar
2. Or navigate to: `/employee/{your-slug}/payouts`
3. Click **"Create Payout"** to start

---

## ✅ What You Get

### For Super Admins
- Create monthly salary payouts
- Auto-fill from employee salary structure
- Track payment status (Pending → Completed)
- View all employee payouts
- Filter by employee, status, month
- See stats: Total Paid, Pending, This Month

### For Regular Employees
- View their own payout history
- See salary breakdown
- Track payment status

---

## 🎯 Creating Your First Payout

1. Click **"Create Payout"** button
2. Select an employee from dropdown
3. Choose month and year
4. Salary details auto-fill from their structure
5. Add bonus/penalty if needed (optional)
6. Review the **Net Salary** (auto-calculated)
7. Select payment method (Bank Transfer, Cash, etc.)
8. Set status (Pending or Completed)
9. Add notes (optional)
10. Click **"Create Payout"**

Done! The payout is now created and visible in the list.

---

## 🔧 Troubleshooting

### Error: "Could not embed because more than one relationship"
**Fix**: Run `sql/COMPLETE_PAYOUT_SYSTEM_SETUP.sql` in Supabase SQL Editor

### Can't see Payouts menu
**Fix**: Ensure you're logged in as Super Admin (role_code: 'employee_super_admin')

### Salary not auto-filling
**Fix**: Ensure the employee has a salary structure assigned in their profile

---

## 📊 Features Overview

| Feature | Super Admin | Regular Employee |
|---------|-------------|------------------|
| Create Payouts | ✅ | ❌ |
| View All Payouts | ✅ | ❌ |
| View Own Payouts | ✅ | ✅ |
| Process Payouts | ✅ | ❌ |
| Mark as Paid | ✅ | ❌ |
| Export Reports | ✅ | ❌ |

---

## 💡 Pro Tips

1. **Auto-fill**: Employee salary structures automatically populate the payout form
2. **Unique Constraint**: Can't create duplicate payouts for same employee + month + year
3. **Real-time Calculation**: Net salary updates automatically as you change values
4. **Status Tracking**: Use "Pending" when creating, "Completed" when paid
5. **Search**: Quickly find payouts by employee name, code, or email

---

## 📁 Key Files

- **Frontend**: `src/pages/employee/PayoutManagement.jsx`
- **Modal**: `src/components/employee/CreatePayoutModal.jsx`
- **Database**: `sql/COMPLETE_PAYOUT_SYSTEM_SETUP.sql`
- **Docs**: `EMPLOYEE_PAYOUT_SYSTEM_COMPLETE.md`

---

## 🎉 You're Ready!

The payout system is fully set up and ready to use. Start creating payouts for your employees!

**Need Help?** Check `EMPLOYEE_PAYOUT_SYSTEM_COMPLETE.md` for detailed documentation.
