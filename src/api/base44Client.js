/**
 * base44Client.js — Supabase compatibility shim
 *
 * This replaces the Base44 SDK client.
 * All existing code that uses:
 *   base44.entities.Product.filter(...)
 *   base44.auth.me()
 *   base44.integrations.Core.InvokeLLM(...)
 *   base44.integrations.Core.SendEmail(...)
 * will continue to work without changes.
 */

import { supabase } from '@/lib/supabase';
import { Entity } from '@/lib/entity';
import { User } from '@/entities/User';

// ---- Entity registry ----
// All entities accessible via base44.entities.EntityName
const entities = {
  Product: new Entity('products'),
  Category: new Entity('categories'),
  CartItem: new Entity('cart_items'),
  Order: new Entity('orders'),
  Notification: new Entity('notifications'),
  DeliveryPerson: new Entity('delivery_persons'),
  LoyaltyTransaction: new Entity('loyalty_transactions'),
  Campaign: new Entity('campaigns'),
  CampaignUsage: new Entity('campaign_usage'),
  Subscription: new Entity('subscriptions'),
  Refund: new Entity('refunds'),
  Role: new Entity('roles'),
  Banner: new Entity('banners'),
  Review: new Entity('reviews'),
  Combo: new Entity('combos'),
  Settings: new Entity('settings'),
  Referral: new Entity('referrals'),
  WalletTransaction: new Entity('wallet_transactions'),
  ChatMessage: new Entity('chat_messages'),
  KnowledgeArticle: new Entity('knowledge_articles'),
  Gamification: new Entity('gamification'),
  OnboardingProgress: new Entity('onboarding_progress'),
  AdminActivityLog: new Entity('admin_activity_log'),
  Shift: new Entity('shifts'),
  DeliveryShift: new Entity('shifts'), // Alias for Shift - same table
  WithdrawalRequest: new Entity('withdrawal_requests'),
  Hostel: new Entity('hostels'),
  DeliveryQuery: new Entity('delivery_queries'),
  Wishlist: new Entity('wishlists'),
  // Support entities
  SupportTicket: new Entity('support_tickets'),
  SupportTicketComment: new Entity('support_ticket_comments'),
  // AI/ML entities
  ChurnPrediction: new Entity('churn_predictions'),
  MarketingCampaign: new Entity('marketing_campaigns'),
  FeedbackAnalysis: new Entity('feedback_analyses'),
  // Dhaba/Menu entities
  DhabaMenuItem: new Entity('dhaba_menu_items'),
  Dhaba: new Entity('dhabas'),
  // Config entities
  RecommendationSettings: new Entity('settings'), // Use settings table
  NotificationConfig: new Entity('settings'), // Use settings table
  // Performance entities
  DeliveryPerformance: new Entity('delivery_persons'), // Use delivery_persons for performance data
  User: {
    filter: User.filter.bind(User),
    list: User.list.bind(User),
    update: User.update.bind(User),
  },
};

// ---- Auth shim ----
const auth = {
  me: () => User.me(),
  logout: (redirectUrl) => {
    supabase.auth.signOut().then(() => {
      if (redirectUrl) window.location.href = redirectUrl;
      else window.location.href = '/';
    });
  },
  redirectToLogin: (returnUrl) => {
    if (returnUrl) sessionStorage.setItem('returnUrl', returnUrl);
    window.location.href = '/login';
  },
  // Update current user's profile data (used by Profile page)
  updateMe: async (data) => {
    return User.updateMyUserData(data);
  },
};

// ---- AI / Integrations shim ----
// Routes to Supabase Edge Functions
const EDGE_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

async function callEdgeFunction(fnName, payload) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token || ANON_KEY;

  const res = await fetch(`${EDGE_BASE}/${fnName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Edge function ${fnName} failed: ${err}`);
  }
  return res.json();
}

const integrations = {
  Core: {
    // AI text generation — routes to invoke-llm edge function
    InvokeLLM: (payload) => callEdgeFunction('invoke-llm', payload),

    // Email — routes to send-email edge function
    SendEmail: (payload) => callEdgeFunction('send-email', payload),

    // SMS — routes to send-sms edge function
    SendSMS: (payload) => callEdgeFunction('send-sms', payload),

    // File upload — uses Supabase Storage directly
    UploadFile: async ({ file, fileName, bucket = 'uploads' }) => {
      const path = fileName || `${Date.now()}-${file.name}`;
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(path);
      return { url: publicUrl, path: data.path };
    },

    // Image generation — routes to generate-image edge function
    GenerateImage: (payload) => callEdgeFunction('generate-image', payload),

    // Data extraction — routes to extract-data edge function
    ExtractDataFromUploadedFile: (payload) => callEdgeFunction('extract-data', payload),
  }
};

// ---- Main export ----
export const base44 = {
  entities,
  auth,
  integrations,
  // no-op shim for any legacy appLogs calls
  appLogs: {
    logUserInApp: () => Promise.resolve(),
  },
};
