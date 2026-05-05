-- ═══════════════════════════════════════════════════════════════════════════════
-- CollegeCart - Complete Database Setup
-- ═══════════════════════════════════════════════════════════════════════════════
-- Run this entire file in Supabase SQL Editor to set up the complete database
-- This includes: schema, tables, functions, triggers, RLS policies, and cron jobs
-- ═══════════════════════════════════════════════════════════════════════════════

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ═══════════════════════════════════════════════════════════════════════════════
-- HELPER FUNCTIONS
-- ═══════════════════════════════════════════════════════════════════════════════

-- Helper function to check admin role (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- CORE TABLES
-- ═══════════════════════════════════════════════════════════════════════════════

-- Users table
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE,
  phone TEXT UNIQUE,
  full_name TEXT,
  phone_number TEXT,
  role TEXT DEFAULT 'customer',
  selected_hostel TEXT,
  loyalty_tier TEXT DEFAULT 'Bronze',
  loyalty_points INTEGER DEFAULT 0,
  assigned_role_ids TEXT[] DEFAULT '{}',
  avatar_url TEXT,
  profile_photo TEXT,
  saved_addresses JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own data" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own data" ON public.users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can read all users" ON public.users FOR SELECT USING (public.is_admin());

-- Categories table
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read categories" ON public.categories FOR SELECT USING (TRUE);
CREATE POLICY "Admins can manage categories" ON public.categories FOR ALL USING (public.is_admin());

-- Products table
CREATE TABLE IF NOT EXISTS public.products (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL,
  original_price NUMERIC,
  image_url TEXT,
  category_id TEXT,
  is_available BOOLEAN DEFAULT TRUE,
  stock_quantity INTEGER DEFAULT 0,
  hostel_stock JSONB DEFAULT '{}',
  average_rating NUMERIC DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  available_from TEXT,
  available_to TEXT,
  delivery_time TEXT,
  delivery_charge NUMERIC DEFAULT 0,
  dhaba_options JSONB DEFAULT '[]',
  source_dhaba TEXT,
  has_variations BOOLEAN DEFAULT FALSE,
  variations JSONB DEFAULT '[]',
  tags JSONB DEFAULT '[]',
  unit TEXT DEFAULT 'piece',
  low_stock_threshold INTEGER DEFAULT 10,
  profit_margin NUMERIC DEFAULT 0,
  scheduled_available_date TEXT,
  scheduled_unavailable_date TEXT,
  is_sample BOOLEAN DEFAULT FALSE,
  created_by_id TEXT,
  created_by TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_date TIMESTAMPTZ,
  updated_date TIMESTAMPTZ
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read available products" ON public.products FOR SELECT USING (TRUE);
CREATE POLICY "Admins can manage products" ON public.products FOR ALL USING (public.is_admin());

-- Orders table
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id),
  order_number TEXT UNIQUE NOT NULL,
  customer_name TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]',
  total_amount NUMERIC NOT NULL,
  delivery_address TEXT NOT NULL,
  phone_number TEXT,
  delivery_notes TEXT,
  status TEXT DEFAULT 'pending',
  payment_method TEXT DEFAULT 'cash',
  is_paid BOOLEAN DEFAULT FALSE,
  payment_id TEXT,
  delivery_otp TEXT,
  delivery_person_id UUID,
  is_scheduled BOOLEAN DEFAULT FALSE,
  scheduled_time TIMESTAMPTZ,
  cod_collection_method TEXT CHECK (cod_collection_method IN ('cash', 'online', NULL)),
  cod_payment_id TEXT,
  cod_payment_status TEXT CHECK (cod_payment_status IN ('pending', 'initiated', 'completed', 'failed', NULL)),
  cod_payment_link TEXT,
  cod_link_id TEXT,
  cod_collected BOOLEAN DEFAULT FALSE,
  cod_collected_at TIMESTAMPTZ,
  cod_collected_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own orders" ON public.orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Anyone can create orders" ON public.orders FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "Users can update own orders" ON public.orders FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all orders" ON public.orders FOR ALL USING (public.is_admin());

-- Cart items table
CREATE TABLE IF NOT EXISTS public.cart_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, product_id)
);

ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can manage cart items" ON public.cart_items FOR ALL USING (TRUE) WITH CHECK (TRUE);

-- Delivery persons table
CREATE TABLE IF NOT EXISTS public.delivery_persons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  phone_number TEXT,
  vehicle_type TEXT,
  assigned_hostel TEXT DEFAULT 'All',
  is_available BOOLEAN DEFAULT TRUE,
  is_blocked BOOLEAN DEFAULT FALSE,
  current_orders TEXT[] DEFAULT '{}',
  total_deliveries INTEGER DEFAULT 0,
  total_earnings NUMERIC DEFAULT 0,
  lifetime_earnings NUMERIC DEFAULT 0,
  current_shift TEXT,
  wallet_balance NUMERIC DEFAULT 0,
  today_earnings NUMERIC DEFAULT 0,
  cod_held NUMERIC DEFAULT 0,
  cod_held_since TIMESTAMPTZ,
  shift_end_time TIMESTAMPTZ,
  last_cod_submitted_at TIMESTAMPTZ,
  pending_topup_link_id TEXT,
  cod_balance NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.delivery_persons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read delivery persons" ON public.delivery_persons FOR SELECT USING (TRUE);
CREATE POLICY "Admins can manage delivery persons" ON public.delivery_persons FOR ALL USING (public.is_admin());

-- Support tickets table
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  priority TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'open',
  assigned_to UUID REFERENCES auth.users(id),
  order_id UUID REFERENCES orders(id),
  product_id TEXT REFERENCES products(id),
  resolution_notes TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW(),
  resolved_date TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_category ON support_tickets(category);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_date ON support_tickets(created_date DESC);

ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own tickets" ON support_tickets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create tickets" ON support_tickets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own open tickets" ON support_tickets FOR UPDATE USING (auth.uid() = user_id AND status = 'open');
CREATE POLICY "Admins can view all tickets" ON support_tickets FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE public.users.id = auth.uid() AND public.users.role = 'admin')
);
CREATE POLICY "Admins can update all tickets" ON support_tickets FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE public.users.id = auth.uid() AND public.users.role = 'admin')
);

-- Support ticket comments table
CREATE TABLE IF NOT EXISTS public.support_ticket_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES support_tickets(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  comment TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT FALSE,
  created_date TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_ticket_comments_ticket_id ON support_ticket_comments(ticket_id);

ALTER TABLE support_ticket_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view comments on own tickets" ON support_ticket_comments FOR SELECT USING (
  EXISTS (SELECT 1 FROM support_tickets WHERE support_tickets.id = ticket_id AND support_tickets.user_id = auth.uid() AND is_internal = FALSE)
);
CREATE POLICY "Users can add comments to own tickets" ON support_ticket_comments FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM support_tickets WHERE support_tickets.id = ticket_id AND support_tickets.user_id = auth.uid())
);
CREATE POLICY "Admins can view all comments" ON support_ticket_comments FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE public.users.id = auth.uid() AND public.users.role = 'admin')
);
CREATE POLICY "Admins can add comments" ON support_ticket_comments FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE public.users.id = auth.uid() AND public.users.role = 'admin')
);

-- Error logs table
CREATE TABLE IF NOT EXISTS public.error_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  error_type TEXT NOT NULL,
  message TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  page TEXT,
  stack_trace TEXT,
  resolved BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_error_logs_created_at ON error_logs(created_at DESC);
CREATE INDEX idx_error_logs_resolved ON error_logs(resolved);
CREATE INDEX idx_error_logs_type ON error_logs(error_type);

ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin can view all errors" ON error_logs FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
);
CREATE POLICY "Admin can update errors" ON error_logs FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
);
CREATE POLICY "Admin can delete errors" ON error_logs FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
);
CREATE POLICY "Anyone can insert errors" ON error_logs FOR INSERT WITH CHECK (TRUE);

-- COD submissions table
CREATE TABLE IF NOT EXISTS public.cod_submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  approved_by UUID,
  method TEXT CHECK (method IN ('physical', 'wallet')),
  notes TEXT
);

ALTER TABLE cod_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access on cod_submissions" ON cod_submissions USING (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin'));
CREATE POLICY "Service role insert cod_submissions" ON cod_submissions FOR INSERT WITH CHECK (TRUE);

-- Admin alerts table
CREATE TABLE IF NOT EXISTS public.admin_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  type TEXT NOT NULL,
  message TEXT,
  data TEXT,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ
);

ALTER TABLE admin_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access" ON admin_alerts USING (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin'));
CREATE POLICY "Service role insert" ON admin_alerts FOR INSERT WITH CHECK (TRUE);

CREATE INDEX IF NOT EXISTS idx_admin_alerts_type_resolved ON admin_alerts(type, resolved);

-- Loyalty transactions table
CREATE TABLE IF NOT EXISTS public.loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id),
  points INTEGER NOT NULL,
  transaction_type TEXT,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  description TEXT,
  balance_after INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.loyalty_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own loyalty" ON public.loyalty_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Anyone can create loyalty transactions" ON public.loyalty_transactions FOR INSERT WITH CHECK (TRUE);

-- Notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  type TEXT DEFAULT 'info',
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own notifications" ON public.notifications FOR SELECT USING (auth.uid()::TEXT = user_id);
CREATE POLICY "Public can insert notifications" ON public.notifications FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (auth.uid()::TEXT = user_id);

-- Settings table
CREATE TABLE IF NOT EXISTS public.settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shipping_charge NUMERIC DEFAULT 0,
  free_delivery_above NUMERIC DEFAULT 500,
  first_order_threshold NUMERIC DEFAULT 100,
  store_name TEXT,
  store_description TEXT,
  store_upi_id TEXT,
  is_online BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read settings" ON public.settings FOR SELECT USING (TRUE);
CREATE POLICY "Admins can manage settings" ON public.settings FOR ALL USING (public.is_admin());

-- Insert default settings
INSERT INTO public.settings (shipping_charge, free_delivery_above, first_order_threshold, store_name, is_online)
VALUES (30, 500, 100, 'CollegeCart', TRUE)
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════════
-- FUNCTIONS & TRIGGERS
-- ═══════════════════════════════════════════════════════════════════════════════

-- Stock decrement function
CREATE OR REPLACE FUNCTION decrement_stock(
  p_product_id TEXT,
  p_quantity INT
) RETURNS JSON AS $$
DECLARE
  current_stock INT;
  remaining_stock INT;
BEGIN
  SELECT stock_quantity INTO current_stock
  FROM products
  WHERE id = p_product_id
  FOR UPDATE;

  IF current_stock IS NULL THEN
    RETURN json_build_object('success', FALSE, 'error', 'Product not found', 'remaining_stock', 0);
  END IF;

  IF current_stock < p_quantity THEN
    RETURN json_build_object('success', FALSE, 'error', 'Insufficient stock', 'remaining_stock', current_stock);
  END IF;

  remaining_stock := current_stock - p_quantity;

  UPDATE products
  SET 
    stock_quantity = remaining_stock,
    is_available = CASE WHEN remaining_stock <= 0 THEN FALSE ELSE is_available END,
    updated_at = NOW()
  WHERE id = p_product_id;

  RETURN json_build_object('success', TRUE, 'remaining_stock', remaining_stock, 'message', 'Stock updated successfully');
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION decrement_stock(TEXT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION decrement_stock(TEXT, INT) TO anon;

-- Support ticket number generation
CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS TEXT AS $$
DECLARE
  new_ticket_number TEXT;
  ticket_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO ticket_count
  FROM support_tickets
  WHERE DATE(created_date) = CURRENT_DATE;
  
  new_ticket_number := 'TICKET-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD((ticket_count + 1)::TEXT, 4, '0');
  
  RETURN new_ticket_number;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION set_ticket_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ticket_number IS NULL THEN
    NEW.ticket_number := generate_ticket_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_ticket_number
BEFORE INSERT ON support_tickets
FOR EACH ROW
EXECUTE FUNCTION set_ticket_number();

-- Support ticket timestamp update
CREATE OR REPLACE FUNCTION update_support_ticket_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_date := NOW();
  IF NEW.status IN ('resolved', 'closed') AND OLD.status NOT IN ('resolved', 'closed') THEN
    NEW.resolved_date := NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_support_ticket_timestamp
BEFORE UPDATE ON support_tickets
FOR EACH ROW
EXECUTE FUNCTION update_support_ticket_timestamp();

-- COD collection functions
CREATE OR REPLACE FUNCTION collect_cod_cash(
  p_partner_id UUID,
  p_order_id UUID,
  p_amount NUMERIC
) RETURNS JSON AS $$
DECLARE
  current_held NUMERIC;
BEGIN
  SELECT cod_held INTO current_held FROM delivery_persons WHERE id = p_partner_id FOR UPDATE;

  UPDATE delivery_persons SET
    wallet_balance = COALESCE(wallet_balance, 0) - p_amount,
    cod_held = COALESCE(cod_held, 0) + p_amount,
    cod_held_since = CASE WHEN COALESCE(current_held, 0) = 0 THEN NOW() ELSE cod_held_since END
  WHERE id = p_partner_id;

  UPDATE orders SET
    cod_collected = TRUE,
    cod_collected_at = NOW(),
    cod_collected_by = p_partner_id,
    cod_collection_method = 'cash'
  WHERE id = p_order_id;

  RETURN json_build_object('success', TRUE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION collect_cod_online_complete(
  p_partner_id UUID,
  p_order_id UUID,
  p_payment_id TEXT
) RETURNS JSON AS $$
BEGIN
  UPDATE orders SET
    cod_collected = TRUE,
    cod_collected_at = NOW(),
    cod_collected_by = p_partner_id,
    cod_collection_method = 'online',
    cod_payment_id = p_payment_id,
    cod_payment_status = 'completed'
  WHERE id = p_order_id;

  RETURN json_build_object('success', TRUE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION increment_cod_balance(
  p_partner_id UUID,
  p_amount NUMERIC
) RETURNS VOID AS $$
BEGIN
  UPDATE delivery_persons
  SET cod_balance = COALESCE(cod_balance, 0) + p_amount
  WHERE id = p_partner_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══════════════════════════════════════════════════════════════════════════════
-- CRON JOBS (Replace placeholders before running)
-- ═══════════════════════════════════════════════════════════════════════════════
-- ⚠️ SECURITY: Replace YOUR_SUPABASE_URL and YOUR_SERVICE_ROLE_KEY with actual values
-- Get from: Supabase Dashboard → Settings → API
-- NEVER commit actual secrets to git
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. Release scheduled orders every minute
SELECT cron.schedule(
  'release-scheduled-orders',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'YOUR_SUPABASE_URL/functions/v1/release-scheduled-orders',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- 2. Auto-batch orders every 4 minutes
SELECT cron.schedule(
  'auto-batch-orders',
  '*/4 * * * *',
  $$
  SELECT net.http_post(
    url := 'YOUR_SUPABASE_URL/functions/v1/auto-batch-orders',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- 3. Auto-force partners offline when shift ends
SELECT cron.schedule(
  'auto-offline-after-shift',
  '* * * * *',
  $$
  UPDATE delivery_persons
  SET is_available = FALSE, shift_end_time = NULL
  WHERE is_available = TRUE AND shift_end_time IS NOT NULL AND shift_end_time <= NOW();
  $$
);

-- 4. COD submission warnings
SELECT cron.schedule(
  'cod-submission-warning',
  '0 * * * *',
  $$
  INSERT INTO admin_alerts (type, message, data, resolved)
  SELECT
    'cod_overdue',
    dp.name || ' has unsubmitted cash for over 20 hours',
    json_build_object('partnerId', dp.id, 'amount', dp.cod_held)::TEXT,
    FALSE
  FROM delivery_persons dp
  WHERE
    dp.cod_held > 0
    AND dp.cod_held_since < NOW() - INTERVAL '20 hours'
    AND NOT EXISTS (
      SELECT 1 FROM admin_alerts aa
      WHERE aa.type = 'cod_overdue'
        AND aa.data::json->>'partnerId' = dp.id::TEXT
        AND aa.resolved = FALSE
        AND aa.created_at > NOW() - INTERVAL '4 hours'
    );
  $$
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- REALTIME SUBSCRIPTIONS
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
ALTER PUBLICATION supabase_realtime ADD TABLE public.cart_items;

-- ═══════════════════════════════════════════════════════════════════════════════
-- SETUP COMPLETE
-- ═══════════════════════════════════════════════════════════════════════════════

SELECT 'Database setup completed successfully!' AS status;
