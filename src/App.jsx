import './App.css'
import React, { lazy, Suspense } from 'react';
import { Toaster } from "@/components/ui/toaster"
import { Toaster as SonnerToaster } from "sonner"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import VisualEditAgent from '@/lib/VisualEditAgent'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import Login from './pages/Login';
import ProtectedRoute from './components/ProtectedRoute';
import RequireAuth from './components/RequireAuth';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { EmployeeAuthProvider } from '@/contexts/EmployeeAuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import { DialogProvider } from '@/components/ui/alert-dialog-custom';
import ErrorBoundary from '@/components/ErrorBoundary';
import { Analytics as VercelAnalytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import OfflineBanner from '@/components/shared/OfflineBanner';
import AdminErrorPanel from '@/components/admin/AdminErrorPanel';
import { lazyWithRetry } from '@/utils/lazyWithRetry';
import RouteErrorBoundary from '@/components/RouteErrorBoundary';

// Employee System - Lazy loaded with retry capability
const EmployeeLogin = lazyWithRetry(() => import('@/pages/employee/EmployeeLogin'));
const EmployeePasswordReset = lazyWithRetry(() => import('@/pages/employee/EmployeePasswordReset'));
const EmployeeLayout = lazyWithRetry(() => import('@/pages/employee/EmployeeLayout'));
const EmployeeDashboard = lazyWithRetry(() => import('@/pages/employee/EmployeeDashboard'));
const EmployeeProfile = lazyWithRetry(() => import('@/pages/employee/EmployeeProfile'));
const EmployeeSettings = lazyWithRetry(() => import('@/pages/employee/EmployeeSettings'));
const EmployeeAttendance = lazyWithRetry(() => import('@/pages/employee/EmployeeAttendance'));
const EmployeeSalary = lazyWithRetry(() => import('@/pages/employee/EmployeeSalary'));
const CreateStockOrder = lazyWithRetry(() => import('@/pages/employee/CreateStockOrder'));
const StockOrdersList = lazyWithRetry(() => import('@/pages/employee/StockOrdersList'));
const StockOrderDetails = lazyWithRetry(() => import('@/pages/employee/StockOrderDetails'));
const StockManager = lazyWithRetry(() => import('@/pages/employee/StockManager'));
const ManageEmployees = lazyWithRetry(() => import('@/pages/employee/ManageEmployees'));
const ManageDepartments = lazyWithRetry(() => import('@/pages/employee/ManageDepartments'));
const Deliveries = lazyWithRetry(() => import('@/pages/employee/Deliveries'));
const Finance = lazyWithRetry(() => import('@/pages/employee/Finance'));
const EmployeeAnalytics = lazyWithRetry(() => import('@/pages/employee/Analytics'));
const Support = lazyWithRetry(() => import('@/pages/employee/Support'));
const Inventory = lazyWithRetry(() => import('@/pages/employee/Inventory'));
const PayoutManagement = lazyWithRetry(() => import('@/pages/employee/PayoutManagement'));
import EmployeeAuthGuard from '@/components/EmployeeAuthGuard';

// Lazy load heavy pages with self-healing retry logic
const Referral = lazyWithRetry(() => import('./pages/Referral'));
const CCA = lazyWithRetry(() => import('./pages/CCA'));
const Cart = lazyWithRetry(() => import('./pages/Cart'));
const UserManagement = lazyWithRetry(() => import('./pages/UserManagement'));
const Delivery = lazyWithRetry(() => import('./pages/Delivery'));
const Subscription = lazyWithRetry(() => import('./pages/Subscription'));
const Wishlist = lazyWithRetry(() => import('./pages/Wishlist'));

// Policy & info pages (lightweight, no lazy needed)
import ContactUs from './pages/ContactUs';
import TermsConditions from './pages/TermsConditions';
import RefundsCancellations from './pages/RefundsCancellations';
import PrivacyPolicy from './pages/PrivacyPolicy';
import AboutUs from './pages/AboutUs';
import Meals from './pages/Meals';

import { NavigationProvider } from '@/navigation/NavigationProvider';
import { ModuleLayout } from '@/navigation';

// Premium Loading skeleton component mimicking dynamic page layout elements
const PageLoadingSkeleton = () => (
  <div className="w-full max-w-7xl mx-auto p-4 md:p-6 space-y-6 animate-pulse">
    {/* Banner/Header skeleton */}
    <div className="h-40 bg-gray-100 rounded-2xl w-full"></div>
    {/* Category buttons skeleton */}
    <div className="grid grid-cols-4 gap-4">
      <div className="h-10 bg-gray-100 rounded-xl"></div>
      <div className="h-10 bg-gray-100 rounded-xl"></div>
      <div className="h-10 bg-gray-100 rounded-xl"></div>
      <div className="h-10 bg-gray-100 rounded-xl"></div>
    </div>
    {/* Content mock rows */}
    <div className="space-y-4">
      <div className="h-6 bg-gray-100 rounded-md w-1/4"></div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="h-64 bg-gray-100 rounded-xl"></div>
        <div className="h-64 bg-gray-100 rounded-xl"></div>
        <div className="h-64 bg-gray-100 rounded-xl"></div>
        <div className="h-64 bg-gray-100 rounded-xl"></div>
      </div>
    </div>
  </div>
);

const { Pages, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

// Mapping of lazy pages to automatically override static imports
const LAZY_PAGES = {
  Cart,
  UserManagement,
  Delivery,
  Subscription,
  Wishlist,
};

const LayoutWrapper = ({ children }) => (
  <ModuleLayout>{children}</ModuleLayout>
);

// Wraps children with NavigationProvider, passing user context
const NavigationProviderWrapper = ({ children }) => {
  const { user } = useAuth();
  return (
    <NavigationProvider user={user} employee={null}>
      {children}
    </NavigationProvider>
  );
};

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, isAuthenticated, navigateToLogin } = useAuth();

  // Show loading spinner while checking session
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin" />
          <p className="text-sm text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Handle special auth errors
  if (authError?.type === 'user_not_registered') {
    return <UserNotRegisteredError />;
  }

  return (
    <Routes>
      {/* ── Public routes — no auth needed ── */}
      <Route path="/login" element={<Login />} />
      <Route path="/Login" element={<Login />} />
      <Route path="/ContactUs" element={<LayoutWrapper currentPageName="Contact Us"><ContactUs /></LayoutWrapper>} />
      <Route path="/contact" element={<LayoutWrapper currentPageName="Contact Us"><ContactUs /></LayoutWrapper>} />
      <Route path="/TermsConditions" element={<LayoutWrapper currentPageName="Terms & Conditions"><TermsConditions /></LayoutWrapper>} />
      <Route path="/terms" element={<LayoutWrapper currentPageName="Terms & Conditions"><TermsConditions /></LayoutWrapper>} />
      <Route path="/RefundsCancellations" element={<LayoutWrapper currentPageName="Refunds & Cancellations"><RefundsCancellations /></LayoutWrapper>} />
      <Route path="/refunds" element={<LayoutWrapper currentPageName="Refunds & Cancellations"><RefundsCancellations /></LayoutWrapper>} />
      <Route path="/PrivacyPolicy" element={<LayoutWrapper currentPageName="Privacy Policy"><PrivacyPolicy /></LayoutWrapper>} />
      <Route path="/privacy" element={<LayoutWrapper currentPageName="Privacy Policy"><PrivacyPolicy /></LayoutWrapper>} />
      <Route path="/AboutUs" element={<LayoutWrapper currentPageName="About Us"><AboutUs /></LayoutWrapper>} />
      <Route path="/about" element={<LayoutWrapper><AboutUs /></LayoutWrapper>} />

      {/* ── Meals Module ── */}
      <Route path="/meals" element={
        <RequireAuth>
          <LayoutWrapper>
            <RouteErrorBoundary>
              <Meals />
            </RouteErrorBoundary>
          </LayoutWrapper>
        </RequireAuth>
      } />

      {/* ── Root — redirect to /Shop (RequireAuth handles login redirect) ── */}
      <Route path="/" element={
        <RequireAuth>
          <LayoutWrapper >
            <RouteErrorBoundary>
              <MainPage />
            </RouteErrorBoundary>
          </LayoutWrapper>
        </RequireAuth>
      } />

      {/* ── All app pages — require login ── */}
      {Object.entries(Pages).map(([path, Page]) => {
        const LazyComponent = LAZY_PAGES[path];
        return (
          <Route
            key={path}
            path={`/${path}`}
            element={
              <RequireAuth>
                <LayoutWrapper >
                  <RouteErrorBoundary>
                    {LazyComponent ? (
                      <Suspense fallback={<PageLoadingSkeleton />}>
                        <LazyComponent />
                      </Suspense>
                    ) : (
                      <Page />
                    )}
                  </RouteErrorBoundary>
                </LayoutWrapper>
              </RequireAuth>
            }
          />
        );
      })}

      {/* ── Referral ── */}
      <Route path="/Referral" element={
        <RequireAuth>
          <LayoutWrapper currentPageName="Referral">
            <RouteErrorBoundary>
              <Suspense fallback={<PageLoadingSkeleton />}>
                <Referral />
              </Suspense>
            </RouteErrorBoundary>
          </LayoutWrapper>
        </RequireAuth>
      } />

      {/* ── Admin-only routes ── */}
      <Route path="/CCA" element={
        <ProtectedRoute requiredRole="admin">
          <LayoutWrapper currentPageName="CCA">
            <RouteErrorBoundary>
              <Suspense fallback={<PageLoadingSkeleton />}>
                <CCA />
              </Suspense>
            </RouteErrorBoundary>
          </LayoutWrapper>
        </ProtectedRoute>
      } />
      <Route path="/admin/errors" element={
        <ProtectedRoute requiredRole="admin">
          <LayoutWrapper currentPageName="AdminErrors">
            <RouteErrorBoundary>
              <Suspense fallback={<PageLoadingSkeleton />}>
                <AdminErrorPanel />
              </Suspense>
            </RouteErrorBoundary>
          </LayoutWrapper>
        </ProtectedRoute>
      } />

      {/* ── Employee System Routes ── */}
      <Route path="/employee/login" element={
        <RouteErrorBoundary>
          <Suspense fallback={<PageLoadingSkeleton />}>
            <EmployeeLogin />
          </Suspense>
        </RouteErrorBoundary>
      } />
      <Route path="/employee/reset-password" element={
        <RouteErrorBoundary>
          <Suspense fallback={<PageLoadingSkeleton />}>
            <EmployeePasswordReset />
          </Suspense>
        </RouteErrorBoundary>
      } />
      <Route path="/employee/forgot-password" element={
        <RouteErrorBoundary>
          <Suspense fallback={<PageLoadingSkeleton />}>
            <EmployeePasswordReset />
          </Suspense>
        </RouteErrorBoundary>
      } />
      <Route 
        path="/employee/:employeeSlug" 
        element={
          <EmployeeAuthGuard>
            <RouteErrorBoundary>
              <Suspense fallback={<PageLoadingSkeleton />}>
                <EmployeeLayout />
              </Suspense>
            </RouteErrorBoundary>
          </EmployeeAuthGuard>
        }
      >
        <Route path="dashboard" element={<EmployeeDashboard />} />
        <Route path="attendance" element={<EmployeeAttendance />} />
        <Route path="salary" element={<EmployeeSalary />} />
        <Route path="stock" element={<StockManager />} />
        <Route path="stock-orders" element={<StockOrdersList />} />
        <Route path="stock-orders/create" element={<CreateStockOrder />} />
        <Route path="stock-orders/:id" element={<StockOrderDetails />} />
        <Route path="manage/employees" element={<ManageEmployees />} />
        <Route path="manage/departments" element={<ManageDepartments />} />
        <Route path="deliveries" element={<Deliveries />} />
        <Route path="finance" element={<Finance />} />
        <Route path="payouts" element={<PayoutManagement />} />
        <Route path="analytics" element={<EmployeeAnalytics />} />
        <Route path="support" element={<Support />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="profile" element={<EmployeeProfile />} />
        <Route path="profile/:viewEmployeeSlug" element={<EmployeeProfile />} />
        <Route path="settings" element={<EmployeeSettings />} />
      </Route>

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};



function App() {
  return (
    <ErrorBoundary>
      <DialogProvider>
        <EmployeeAuthProvider>
          <AuthProvider>
            <QueryClientProvider client={queryClientInstance}>
              <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <NavigationProviderWrapper>
                  <OfflineBanner />
                  <NavigationTracker />
                  <AuthenticatedApp />
                </NavigationProviderWrapper>
              </Router>
              <Toaster />
              <SonnerToaster position="top-center" richColors />
              <VercelAnalytics />
              <SpeedInsights />
              <VisualEditAgent />
            </QueryClientProvider>
          </AuthProvider>
        </EmployeeAuthProvider>
      </DialogProvider>
    </ErrorBoundary>
  )
}

export default App