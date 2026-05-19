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
import BottomTabBar from '@/components/layout/BottomTabBar';
import ErrorBoundary from '@/components/ErrorBoundary';
import { Analytics as VercelAnalytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import OfflineBanner from '@/components/shared/OfflineBanner';
import AdminErrorPanel from '@/components/admin/AdminErrorPanel';

// Employee System - Lazy loaded (not needed on initial page load)
const EmployeeLogin = lazy(() => import('@/pages/employee/EmployeeLogin'));
const EmployeePasswordReset = lazy(() => import('@/pages/employee/EmployeePasswordReset'));
const EmployeeLayout = lazy(() => import('@/pages/employee/EmployeeLayout'));
const EmployeeDashboard = lazy(() => import('@/pages/employee/EmployeeDashboard'));
const EmployeeProfile = lazy(() => import('@/pages/employee/EmployeeProfile'));
const EmployeeSettings = lazy(() => import('@/pages/employee/EmployeeSettings'));
const EmployeeAttendance = lazy(() => import('@/pages/employee/EmployeeAttendance'));
const EmployeeSalary = lazy(() => import('@/pages/employee/EmployeeSalary'));
const CreateStockOrder = lazy(() => import('@/pages/employee/CreateStockOrder'));
const StockOrdersList = lazy(() => import('@/pages/employee/StockOrdersList'));
const StockOrderDetails = lazy(() => import('@/pages/employee/StockOrderDetails'));
const StockManager = lazy(() => import('@/pages/employee/StockManager'));
const ManageEmployees = lazy(() => import('@/pages/employee/ManageEmployees'));
const ManageDepartments = lazy(() => import('@/pages/employee/ManageDepartments'));
const Deliveries = lazy(() => import('@/pages/employee/Deliveries'));
const Finance = lazy(() => import('@/pages/employee/Finance'));
const EmployeeAnalytics = lazy(() => import('@/pages/employee/Analytics'));
const Support = lazy(() => import('@/pages/employee/Support'));
const Inventory = lazy(() => import('@/pages/employee/Inventory'));
const PayoutManagement = lazy(() => import('@/pages/employee/PayoutManagement'));
import EmployeeAuthGuard from '@/components/EmployeeAuthGuard';

// Lazy load heavy pages for better performance
const Referral = lazy(() => import('./pages/Referral'));
const CCA = lazy(() => import('./pages/CCA'));
const Cart = lazy(() => import('./pages/Cart'));
const UserManagement = lazy(() => import('./pages/UserManagement'));
const Delivery = lazy(() => import('./pages/Delivery'));
const Subscription = lazy(() => import('./pages/Subscription'));
const Wishlist = lazy(() => import('./pages/Wishlist'));

// Policy & info pages (lightweight, no lazy needed)
import ContactUs from './pages/ContactUs';
import TermsConditions from './pages/TermsConditions';
import RefundsCancellations from './pages/RefundsCancellations';
import PrivacyPolicy from './pages/PrivacyPolicy';
import AboutUs from './pages/AboutUs';

// Loading skeleton component
const PageLoadingSkeleton = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
  </div>
);

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

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
      <Route path="/about" element={<LayoutWrapper currentPageName="About Us"><AboutUs /></LayoutWrapper>} />

      {/* ── Root — redirect to /Shop (RequireAuth handles login redirect) ── */}
      <Route path="/" element={
        <RequireAuth>
          <LayoutWrapper currentPageName={mainPageKey}>
            <MainPage />
          </LayoutWrapper>
        </RequireAuth>
      } />

      {/* ── All app pages — require login ── */}
      {Object.entries(Pages).map(([path, Page]) => {
        const isLazyPage = ['Cart', 'UserManagement', 'Delivery', 'Subscription', 'Wishlist'].includes(path);
        return (
          <Route
            key={path}
            path={`/${path}`}
            element={
              <RequireAuth>
                <LayoutWrapper currentPageName={path}>
                  {isLazyPage ? (
                    <Suspense fallback={<PageLoadingSkeleton />}>
                      <Page />
                    </Suspense>
                  ) : (
                    <Page />
                  )}
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
            <Suspense fallback={<PageLoadingSkeleton />}>
              <Referral />
            </Suspense>
          </LayoutWrapper>
        </RequireAuth>
      } />

      {/* ── Admin-only routes ── */}
      <Route path="/CCA" element={
        <ProtectedRoute requiredRole="admin">
          <LayoutWrapper currentPageName="CCA">
            <Suspense fallback={<PageLoadingSkeleton />}>
              <CCA />
            </Suspense>
          </LayoutWrapper>
        </ProtectedRoute>
      } />
      <Route path="/admin/errors" element={
        <ProtectedRoute requiredRole="admin">
          <LayoutWrapper currentPageName="AdminErrors">
            <Suspense fallback={<PageLoadingSkeleton />}>
              <AdminErrorPanel />
            </Suspense>
          </LayoutWrapper>
        </ProtectedRoute>
      } />

      {/* ── Employee System Routes ── */}
      <Route path="/employee/login" element={<EmployeeLogin />} />
      <Route path="/employee/reset-password" element={<EmployeePasswordReset />} />
      <Route path="/employee/forgot-password" element={<EmployeePasswordReset />} />
      <Route 
        path="/employee/:employeeSlug" 
        element={
          <EmployeeAuthGuard>
            <EmployeeLayout />
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


// Only show BottomTabBar when authenticated and not on login/policy pages
const HIDE_TABBAR_PATHS = ['/login', '/Login', '/contact', '/ContactUs', '/terms', '/TermsConditions', '/refunds', '/RefundsCancellations', '/privacy', '/PrivacyPolicy', '/about', '/AboutUs'];

const ConditionalBottomTabBar = () => {
  const { isAuthenticated, isLoadingAuth } = useAuth();
  const location = useLocation();
  const hide = isLoadingAuth || !isAuthenticated || HIDE_TABBAR_PATHS.includes(location.pathname);
  if (hide) return null;
  return <BottomTabBar />;
};

function App() {
  return (
    <ErrorBoundary>
      <DialogProvider>
        <EmployeeAuthProvider>
          <AuthProvider>
            <QueryClientProvider client={queryClientInstance}>
              <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <OfflineBanner />
                <NavigationTracker />
                <AuthenticatedApp />
                <ConditionalBottomTabBar />
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