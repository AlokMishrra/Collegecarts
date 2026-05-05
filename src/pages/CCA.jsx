import React, { useState, useEffect, useCallback, useRef } from "react";
import { User } from "@/entities/User";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

import ProductManagement from "../components/admin/ProductManagement";
  import CategoryManagement from "../components/admin/CategoryManagement";
  import DeliveryPersonManagement from "../components/admin/DeliveryPersonManagement";
  import OrderManagement from "../components/admin/OrderManagement";
  import AdminStats from "../components/admin/AdminStats";
  import DailyOrderSummary from "../components/admin/DailyOrderSummary";
  import SettingsManagement from "../components/admin/SettingsManagement";
  import RoleManagement from "../components/admin/RoleManagement";
  import ReviewModeration from "../components/admin/ReviewModeration";
  import CampaignManagement from "../components/admin/CampaignManagement";
  import CRMModule from "../components/admin/CRMModule";
  import EnhancedDashboard from "../components/admin/EnhancedDashboard";
  import RecommendationConfig from "../components/admin/RecommendationConfig";
  import MarketingAutomation from "../components/admin/MarketingAutomation";
  import FeedbackAnalysis from "../components/admin/FeedbackAnalysis";
  import CustomerRetention from "../components/admin/CustomerRetention";
  import AIOrderManagement from "../components/admin/AIOrderManagement";
  import UnifiedAIDashboard from "../components/admin/UnifiedAIDashboard";
  import AIProductInsights from "../components/admin/AIProductInsights";
  import AIInventoryForecasting from "../components/admin/AIInventoryForecasting";
  import DynamicPricing from "../components/admin/DynamicPricing";
  import AISupportAssistant from "../components/admin/AISupportAssistant";
  import GamificationConfig from "../components/admin/GamificationConfig";
  import Leaderboard from "../components/gamification/Leaderboard";
  import AIKnowledgeBase from "../components/knowledge/AIKnowledgeBase";
  import OnboardingTour from "../components/onboarding/OnboardingTour";
  import BulkProductUpdate from "../components/admin/BulkProductUpdate";
  import NotificationConfigManager from "../components/admin/NotificationConfigManager";
  import ProductScheduler from "../components/admin/ProductScheduler";
  import CustomQRGenerator from "../components/admin/CustomQRGenerator";
  import DeliveryPerformance from "../components/admin/DeliveryPerformance";
  import BannerManagement from "../components/admin/BannerManagement";
  import DhabaMenuManagement from "../components/admin/DhabaMenuManagement";
  import ActivityLog from "../components/admin/ActivityLog";
  import DailyProfitCalculator from "../components/admin/DailyProfitCalculator";
  import HostelManagement from "../components/admin/HostelManagement";
  import HostelPerformanceMetrics from "../components/admin/HostelPerformanceMetrics";
  import SubscriptionManagement from "../components/admin/SubscriptionManagement";
  import ComboManagement from "../components/admin/ComboManagement";
  import BatchDeliveryManager from "../components/admin/BatchDeliveryManager";
  import AnalyticsDashboard from "../components/admin/AnalyticsDashboard";
  import ScheduledOrdersManager from "../components/admin/ScheduledOrdersManager";
  import AdminErrorPanel from "../components/admin/AdminErrorPanel";
import CODReconciliation from "../components/admin/CODReconciliation";
import SupportTicketManagement from "../components/admin/SupportTicketManagement";

// ─── Inline Deployment Status Component ───────────────────────────────────────
function DeploymentStatus() {
  const edgeFunctions = [
    {
      name: 'rate-limit-orders',
      description: 'Prevents more than 5 orders per 60 seconds per user',
      deployCommand: 'supabase functions deploy rate-limit-orders'
    },
    {
      name: 'release-scheduled-orders',
      description: 'Releases scheduled orders at their set time (runs every minute via cron)',
      deployCommand: 'supabase functions deploy release-scheduled-orders'
    },
    {
      name: 'auto-batch-orders',
      description: 'Auto-assigns unassigned orders to delivery partners (runs every 4 minutes)',
      deployCommand: 'supabase functions deploy auto-batch-orders'
    },
    {
      name: 'create-cod-payment-link',
      description: 'Creates Cashfree payment link for COD online collection at door',
      deployCommand: 'supabase functions deploy create-cod-payment-link'
    },
    {
      name: 'verify-cod-payment',
      description: 'Verifies Cashfree COD payment status for a given order',
      deployCommand: 'supabase functions deploy verify-cod-payment'
    },
    {
      name: 'create-wallet-topup-payment',
      description: 'Creates Cashfree payment link for partner to clear COD liability',
      deployCommand: 'supabase functions deploy create-wallet-topup-payment'
    },
    {
      name: 'verify-wallet-topup',
      description: 'Verifies wallet top-up payment and clears cod_held balance',
      deployCommand: 'supabase functions deploy verify-wallet-topup'
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">🚀 Deployment Status</h2>
        <p className="text-sm text-gray-600 mt-1">Edge Functions and automation setup for production</p>
      </div>

      {/* Edge Functions Card */}
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: '20px',
        border: '1px solid #E2E8F0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <h3 style={{ color: '#1E1B4B', marginBottom: '16px', fontWeight: 700, fontSize: '16px' }}>
          Edge Functions — Deploy These 3 Functions
        </h3>
        {edgeFunctions.map(fn => (
          <div key={fn.name} style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px',
            border: '1px solid #E2E8F0',
            borderRadius: '8px',
            marginBottom: '8px',
            flexWrap: 'wrap',
            gap: '8px'
          }}>
            <div>
              <p style={{ fontWeight: 600, margin: 0, fontSize: '14px' }}>{fn.name}</p>
              <p style={{ color: '#64748B', fontSize: '12px', margin: '2px 0 0' }}>{fn.description}</p>
            </div>
            <code style={{
              background: '#1E1B4B',
              color: '#A5B4FC',
              padding: '4px 10px',
              borderRadius: '4px',
              fontSize: '11px',
              userSelect: 'all',
              whiteSpace: 'nowrap'
            }}>
              {fn.deployCommand}
            </code>
          </div>
        ))}
        <p style={{ color: '#64748B', fontSize: '12px', marginTop: '12px' }}>
          Run these commands in your terminal after installing Supabase CLI (<code>npm i -g supabase</code>).
        </p>
      </div>

      {/* Cron Jobs Card */}
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: '20px',
        border: '1px solid #E2E8F0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <h3 style={{ color: '#1E1B4B', marginBottom: '12px', fontWeight: 700, fontSize: '16px' }}>
          Cron Jobs — Run SQL in Supabase Editor
        </h3>
        <div style={{ background: '#FEF9C3', border: '1px solid #CA8A04', borderRadius: '8px', padding: '12px' }}>
          <p style={{ color: '#92400E', fontWeight: 600, fontSize: '13px', margin: '0 0 6px' }}>
            ⚠️ One-Time Setup Required
          </p>
          <p style={{ color: '#78350F', fontSize: '12px', margin: 0 }}>
            Open your Supabase project → SQL Editor → paste and run the contents of{' '}
            <code style={{ background: '#FDE68A', padding: '1px 4px', borderRadius: '3px' }}>supabase/cron_jobs.sql</code>
          </p>
        </div>
        <div style={{ marginTop: '12px' }}>
          {[
            { job: 'release-scheduled-orders', schedule: 'Every 1 minute', purpose: 'Moves due scheduled orders to confirmed' },
            { job: 'auto-batch-orders', schedule: 'Every 4 minutes', purpose: 'Assigns unassigned orders to delivery partners' }
          ].map(job => (
            <div key={job.job} style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '8px 12px',
              border: '1px solid #E2E8F0',
              borderRadius: '6px',
              marginBottom: '6px',
              fontSize: '13px'
            }}>
              <span style={{ fontWeight: 600 }}>{job.job}</span>
              <span style={{ color: '#64748B' }}>{job.schedule} — {job.purpose}</span>
            </div>
          ))}
        </div>
      </div>

      {/* SQL Files Card */}
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: '20px',
        border: '1px solid #E2E8F0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <h3 style={{ color: '#1E1B4B', marginBottom: '12px', fontWeight: 700, fontSize: '16px' }}>
          SQL Files — Run in Supabase SQL Editor
        </h3>
        {[
          { file: 'supabase/error_logs_table.sql', purpose: 'Error logging table + RLS policies' },
          { file: 'supabase/decrement_stock_function.sql', purpose: 'Atomic stock decrement RPC' },
          { file: 'supabase/cod_flow_setup.sql', purpose: 'COD columns, RPCs (collect_cod_cash, clear_cod_via_wallet, submit_cod_cash, force_partner_offline)' },
          { file: 'supabase/cron_jobs.sql', purpose: 'All cron schedules + admin_alerts table + increment_cod_balance RPC' }
        ].map(item => (
          <div key={item.file} style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '8px 12px',
            border: '1px solid #E2E8F0',
            borderRadius: '6px',
            marginBottom: '6px',
            fontSize: '13px',
            flexWrap: 'wrap',
            gap: '4px'
          }}>
            <code style={{ background: '#F1F5F9', padding: '2px 6px', borderRadius: '3px', fontSize: '11px' }}>
              {item.file}
            </code>
            <span style={{ color: '#64748B' }}>{item.purpose}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CCA() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userPermissions, setUserPermissions] = useState([]);
  const tabsScrollRef = useRef(null);

  const checkAdminAccess = useCallback(async () => {
    try {
      const currentUser = await User.me();
      
      // RULE 1: Check if user is logged in as delivery person (localStorage check)
      // If they are logged in as delivery, they CANNOT access CCA even if they have admin role
      // They must logout from delivery first
      const deliveryPerson = localStorage.getItem('deliveryPerson');
      if (deliveryPerson) {
        // User is currently logged in as delivery person
        // Redirect to delivery portal - they must logout to access admin
        navigate(createPageUrl('Delivery'));
        return;
      }
      
      // RULE 2: Only users with 'admin' role can access CCA
      // Normal users and delivery-only users are blocked
      if (currentUser.role !== 'admin') {
        // Not an admin - check if they have any admin role assignments
        if (!currentUser.assigned_role_ids || currentUser.assigned_role_ids.length === 0) {
          // No role assignments at all - redirect to shop
          navigate(createPageUrl('Shop'));
          return;
        }
        
        // Check if user only has delivery-related permissions
        const rolePromises = currentUser.assigned_role_ids.map(roleId => 
          base44.entities.Role.filter({ id: roleId })
        );
        const roleResults = await Promise.all(rolePromises);
        const roles = roleResults.flat();
        
        // Check if ALL roles are delivery-only
        const isDeliveryOnly = roles.every(role => 
          role.permissions && 
          role.permissions.length > 0 && 
          role.permissions.every(perm => 
            perm.includes('delivery') || 
            perm === 'view_delivery_portal' ||
            perm === 'manage_delivery'
          )
        );
        
        if (isDeliveryOnly) {
          // User only has delivery permissions - cannot access admin
          navigate(createPageUrl('Shop'));
          return;
        }
      }
      
      // User passed all checks - they can access admin
      setUser(currentUser);
      setUserPermissions(['all']);
    } catch (error) {
      // Error loading user - redirect to shop
      navigate(createPageUrl('Shop'));
    }
    setIsLoading(false);
  }, [navigate]);

  useEffect(() => {
    const timer = setTimeout(() => {
      checkAdminAccess();
    }, 300);
    return () => clearTimeout(timer);
  }, [checkAdminAccess]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  if (!user) return null;

  const hasPermission = (permission) => {
    return userPermissions.includes('all') || userPermissions.includes(permission);
  };

  // Define tabs with their required permissions
  const adminTabs = [
    { value: "dashboard", label: "Dashboard", permission: "view_summary", component: <EnhancedDashboard /> },
    { value: "analytics", label: "Analytics", permission: "view_summary", component: <AnalyticsDashboard /> },
    { value: "ai-insights", label: "AI Intelligence", permission: "view_summary", component: <UnifiedAIDashboard /> },
    { value: "summary", label: "Daily Summary", permission: "view_summary", component: <DailyOrderSummary /> },
    { value: "profit", label: "Profit Analytics", permission: "view_summary", component: <DailyProfitCalculator /> },
    { value: "crm", label: "CRM", permission: "manage_crm", component: <CRMModule /> },
    { value: "retention", label: "Customer Retention", permission: "manage_crm", component: <CustomerRetention /> },
    { value: "marketing", label: "Marketing Automation", permission: "manage_campaigns", component: <MarketingAutomation /> },
    { value: "feedback", label: "Feedback Analysis", permission: "manage_reviews", component: <FeedbackAnalysis /> },
    { value: "ai-orders", label: "AI Order Management", permission: "manage_orders", component: <AIOrderManagement /> },
    { value: "support-ai", label: "AI Support Assistant", permission: "manage_orders", component: <AISupportAssistant /> },
    { value: "products", label: "Products", permission: "manage_products", component: <ProductManagement /> },
    { value: "combos", label: "Combos", permission: "manage_products", component: <ComboManagement /> },
    { value: "bulk-update", label: "Bulk Update", permission: "manage_products", component: <BulkProductUpdate /> },
    { value: "scheduler", label: "Product Scheduler", permission: "manage_products", component: <ProductScheduler /> },
    { value: "product-insights", label: "AI Product Insights", permission: "manage_products", component: <AIProductInsights /> },
    { value: "inventory-forecast", label: "Inventory Forecasting", permission: "manage_products", component: <AIInventoryForecasting /> },
    { value: "dynamic-pricing", label: "Dynamic Pricing", permission: "manage_products", component: <DynamicPricing /> },
    { value: "categories", label: "Categories", permission: "manage_categories", component: <CategoryManagement /> },
    { value: "banners", label: "Banners", permission: "manage_settings", component: <BannerManagement /> },
    { value: "dhaba-menu", label: "Dhaba Menu", permission: "manage_products", component: <DhabaMenuManagement /> },
    { value: "campaigns", label: "Campaigns", permission: "manage_campaigns", component: <CampaignManagement /> },
    { value: "recommendations", label: "AI Recommendations", permission: "manage_settings", component: <RecommendationConfig /> },
    { value: "reviews", label: "Reviews", permission: "manage_reviews", component: <ReviewModeration /> },
    { value: "hostels", label: "Hostels", permission: "manage_delivery", component: <HostelManagement /> },
    { value: "hostel-performance", label: "Hostel Performance", permission: "manage_delivery", component: <HostelPerformanceMetrics /> },
    { value: "delivery", label: "Delivery", permission: "manage_delivery", component: <DeliveryPersonManagement /> },
    { value: "batch-delivery", label: "Batch Dispatch", permission: "manage_delivery", component: <BatchDeliveryManager /> },
    { value: "delivery-performance", label: "Performance", permission: "manage_delivery", component: <DeliveryPerformance /> },
    { value: "orders", label: "Orders", permission: "manage_orders", component: <OrderManagement /> },
    { value: "scheduled-orders", label: "Scheduled Orders", permission: "manage_orders", component: <ScheduledOrdersManager /> },
    { value: "support-tickets", label: "Support Tickets", permission: "manage_orders", component: <SupportTicketManagement /> },
    { value: "notifications", label: "Notification Config", permission: "manage_settings", component: <NotificationConfigManager /> },
    { value: "gamification", label: "Gamification", permission: "manage_settings", component: <GamificationConfig /> },
    { value: "qr-generator", label: "QR Generator", permission: "manage_orders", component: <CustomQRGenerator /> },
    { value: "settings", label: "Settings", permission: "manage_settings", component: <SettingsManagement /> },
    { value: "roles", label: "Roles", permission: "manage_roles", component: <RoleManagement /> },
    { value: "activity-log", label: "Activity Log", permission: "manage_settings", component: <ActivityLog /> },
    { value: "subscriptions", label: "Subscriptions", permission: "manage_settings", component: <SubscriptionManagement /> }
  ];

  // Filter tabs based on permissions
  const allowedTabs = adminTabs.filter(tab => hasPermission(tab.permission));

  // Set default tab to first allowed tab
  const defaultTab = allowedTabs.length > 0 ? allowedTabs[0].value : "summary";

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-tab-bar">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Admin Panel</h1>
          <p className="text-gray-600">Manage your CollegeCart store</p>
        </div>
      </div>

      <AdminStats />

      {/* Onboarding Tour */}
      <OnboardingTour user={user} />

      {/* Leaderboard & Knowledge Base */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <Leaderboard />
        <AIKnowledgeBase currentContext={allowedTabs[0]?.value} />
      </div>

      {allowedTabs.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-gray-600">You don't have permission to access any admin features.</p>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue={defaultTab} className="space-y-6">
          <div className="border-b border-gray-200">
            {/* Tabs container with visible scrollbar */}
            <div 
              ref={tabsScrollRef} 
              className="overflow-x-auto overflow-y-hidden admin-tabs-scroll"
              style={{ 
                scrollbarWidth: 'thin',
                scrollbarColor: '#10b981 #f3f4f6'
              }}
            >
              <TabsList className="inline-flex h-auto bg-transparent border-0 p-0 gap-0">
                {allowedTabs.map(tab => (
                  <TabsTrigger 
                    key={tab.value} 
                    value={tab.value}
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-600 data-[state=active]:bg-transparent data-[state=active]:text-emerald-600 bg-transparent px-6 py-3 text-gray-600 hover:text-gray-900 whitespace-nowrap"
                  >
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
          </div>

          {allowedTabs.map(tab => (
            <TabsContent key={tab.value} value={tab.value}>
              {tab.component}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}