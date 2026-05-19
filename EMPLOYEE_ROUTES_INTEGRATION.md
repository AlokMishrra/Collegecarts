# Employee Routes Integration Guide

## Step 1: Add Employee Auth Provider to App.jsx

At the top of `src/App.jsx`, add the import:

```javascript
import { EmployeeAuthProvider } from '@/contexts/EmployeeAuthContext';
```

Then wrap the entire app with EmployeeAuthProvider (add it BEFORE AuthProvider):

```javascript
function App() {
  return (
    <ErrorBoundary>
      <DialogProvider>
        <EmployeeAuthProvider>  {/* ADD THIS */}
          <AuthProvider>
            <QueryClientProvider client={queryClientInstance}>
              {/* existing app content */}
            </QueryClientProvider>
          </AuthProvider>
        </EmployeeAuthProvider>  {/* ADD THIS */}
      </DialogProvider>
    </ErrorBoundary>
  )
}
```

## Step 2: Add Employee Route Imports

Add these imports at the top of `src/App.jsx`:

```javascript
// Employee System Imports
import EmployeeLogin from '@/pages/employee/EmployeeLogin';
import EmployeeLayout from '@/pages/employee/EmployeeLayout';
import EmployeeDashboard from '@/pages/employee/EmployeeDashboard';
import EmployeeProfile from '@/pages/employee/EmployeeProfile';
import EmployeeAttendance from '@/pages/employee/EmployeeAttendance';
import EmployeeSalary from '@/pages/employee/EmployeeSalary';
import CreateStockOrder from '@/pages/employee/CreateStockOrder';
import StockOrdersList from '@/pages/employee/StockOrdersList';
import StockOrderDetails from '@/pages/employee/StockOrderDetails';
import EmployeeAuthGuard from '@/components/EmployeeAuthGuard';
```

## Step 3: Add Employee Routes

Inside the `<Routes>` component in `src/App.jsx`, add these routes:

```javascript
<Routes>
  {/* Existing routes... */}
  
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
    <Route path="attendance" element={<EmployeeAttendance />} />
    <Route path="salary" element={<EmployeeSalary />} />
    <Route path="stock-orders" element={<StockOrdersList />} />
    <Route path="stock-orders/create" element={<CreateStockOrder />} />
    <Route path="stock-orders/:id" element={<StockOrderDetails />} />
    <Route path=":slug" element={<EmployeeProfile />} />
  </Route>
  
  {/* Existing routes... */}
</Routes>
```

## Step 4: Add Employee System Tab to Admin Panel

In `src/pages/CCA.jsx`, add the import:

```javascript
import EmployeeSystemManagement from '@/components/admin/EmployeeSystemManagement';
import { Briefcase } from 'lucide-react';
```

Then add to the tabs array (around line 50-100 where tabs are defined):

```javascript
{
  value: "employee-system",
  label: "Employee System",
  icon: Briefcase,
  component: EmployeeSystemManagement
}
```

## Complete Example of App.jsx Structure

```javascript
import './App.css'
import React, { lazy, Suspense } from 'react';
import { Toaster } from "@/components/ui/toaster"
import { Toaster as SonnerToaster } from "sonner"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/lib/AuthContext';
import { EmployeeAuthProvider } from '@/contexts/EmployeeAuthContext';  // ADD THIS
import { DialogProvider } from '@/components/ui/alert-dialog-custom';
import ErrorBoundary from '@/components/ErrorBoundary';

// Employee System Imports - ADD THESE
import EmployeeLogin from '@/pages/employee/EmployeeLogin';
import EmployeeLayout from '@/pages/employee/EmployeeLayout';
import EmployeeDashboard from '@/pages/employee/EmployeeDashboard';
import EmployeeProfile from '@/pages/employee/EmployeeProfile';
import EmployeeAttendance from '@/pages/employee/EmployeeAttendance';
import EmployeeSalary from '@/pages/employee/EmployeeSalary';
import CreateStockOrder from '@/pages/employee/CreateStockOrder';
import StockOrdersList from '@/pages/employee/StockOrdersList';
import StockOrderDetails from '@/pages/employee/StockOrderDetails';
import EmployeeAuthGuard from '@/components/EmployeeAuthGuard';

// ... other imports

function App() {
  return (
    <ErrorBoundary>
      <DialogProvider>
        <EmployeeAuthProvider>  {/* ADD THIS */}
          <AuthProvider>
            <QueryClientProvider client={queryClientInstance}>
              <Router>
                <OfflineBanner />
                <NavigationTracker />
                
                <Routes>
                  {/* Customer routes */}
                  <Route path="/" element={<MainPage />} />
                  <Route path="/login" element={<Login />} />
                  {/* ... other customer routes */}
                  
                  {/* Employee System Routes - ADD THESE */}
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
                    <Route path="attendance" element={<EmployeeAttendance />} />
                    <Route path="salary" element={<EmployeeSalary />} />
                    <Route path="stock-orders" element={<StockOrdersList />} />
                    <Route path="stock-orders/create" element={<CreateStockOrder />} />
                    <Route path="stock-orders/:id" element={<StockOrderDetails />} />
                    <Route path=":slug" element={<EmployeeProfile />} />
                  </Route>
                  
                  {/* 404 */}
                  <Route path="*" element={<PageNotFound />} />
                </Routes>
                
                <Toaster />
                <SonnerToaster position="top-center" richColors />
              </Router>
            </QueryClientProvider>
          </AuthProvider>
        </EmployeeAuthProvider>  {/* ADD THIS */}
      </DialogProvider>
    </ErrorBoundary>
  )
}

export default App
```

## Verification Steps

After integration:

1. Navigate to `http://localhost:5173/employee/login`
2. You should see the employee login page
3. Try logging in (after creating an employee from admin panel)
4. Verify you're redirected to employee dashboard
5. Test navigation between employee pages
6. Verify customer/admin routes still work independently

## Troubleshooting

### Issue: "Cannot find module '@/contexts/EmployeeAuthContext'"
**Solution**: Verify the file exists at `src/contexts/EmployeeAuthContext.jsx`

### Issue: "Cannot find module '@/pages/employee/EmployeeLogin'"
**Solution**: Verify all employee page files exist in `src/pages/employee/` directory

### Issue: Employee routes not working
**Solution**: 
1. Check that EmployeeAuthProvider is wrapping the app
2. Verify routes are inside `<Routes>` component
3. Check browser console for errors

### Issue: Employee login redirects to customer login
**Solution**: Verify EmployeeAuthGuard is properly implemented and imported

## Testing Checklist

- [ ] Employee login page loads
- [ ] Can create employee from admin panel
- [ ] Can login with employee credentials
- [ ] Dashboard loads with correct data
- [ ] Attendance check-in/out works
- [ ] Stock order creation works
- [ ] Stock orders list displays
- [ ] Stock order details page works
- [ ] Salary history displays
- [ ] PDF downloads work
- [ ] Profile page displays with QR code
- [ ] Logout works correctly
- [ ] Customer/admin routes unaffected
