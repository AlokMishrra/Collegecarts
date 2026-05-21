-- ============================================================
-- MEAL SYSTEM PHASE 4 & 5 - Coupons, Reviews, Settings, Nutrition
-- ============================================================

-- 1. Meal Coupons & Offers
CREATE TABLE IF NOT EXISTS public.meal_coupons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  discount_type TEXT NOT NULL DEFAULT 'percentage', -- percentage, flat
  discount_value NUMERIC(10,2) NOT NULL,
  min_order_amount NUMERIC(10,2) DEFAULT 0,
  max_discount NUMERIC(10,2) DEFAULT 0,
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ,
  usage_limit INTEGER DEFAULT 100,
  used_count INTEGER DEFAULT 0,
  applicable_plans JSONB DEFAULT '[]', -- empty = all plans
  applicable_hostels JSONB DEFAULT '[]', -- empty = all hostels
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meal_coupons_code ON public.meal_coupons(code);
CREATE INDEX IF NOT EXISTS idx_meal_coupons_active ON public.meal_coupons(is_active);

-- 2. Meal Reviews
CREATE TABLE IF NOT EXISTS public.meal_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.meal_orders(id) ON DELETE SET NULL,
  meal_item_name TEXT,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  is_approved BOOLEAN DEFAULT false,
  admin_reply TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meal_reviews_user ON public.meal_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_meal_reviews_rating ON public.meal_reviews(rating);

-- 3. Meal Settings
CREATE TABLE IF NOT EXISTS public.meal_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT NOT NULL UNIQUE,
  value TEXT,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Nutrition tracking per menu item (extend meal_menu_items)
ALTER TABLE public.meal_menu_items 
ADD COLUMN IF NOT EXISTS protein NUMERIC(5,1) DEFAULT 0,
ADD COLUMN IF NOT EXISTS carbs NUMERIC(5,1) DEFAULT 0,
ADD COLUMN IF NOT EXISTS fats NUMERIC(5,1) DEFAULT 0,
ADD COLUMN IF NOT EXISTS fiber NUMERIC(5,1) DEFAULT 0,
ADD COLUMN IF NOT EXISTS allergens JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS dietary_labels JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS ingredients TEXT;

-- Grant access
GRANT ALL ON public.meal_coupons TO anon, authenticated;
GRANT ALL ON public.meal_reviews TO anon, authenticated;
GRANT ALL ON public.meal_settings TO anon, authenticated;

ALTER TABLE public.meal_coupons DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_reviews DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_settings DISABLE ROW LEVEL SECURITY;

-- Seed default settings
INSERT INTO public.meal_settings (key, value, description) VALUES
  ('min_order_amount', '0', 'Minimum order amount for meals'),
  ('handling_charge', '5', 'Handling charge per meal order'),
  ('delivery_fee', '0', 'Default delivery fee'),
  ('subscription_tax_percent', '0', 'Tax on subscriptions'),
  ('cancellation_cutoff_minutes', '30', 'Minutes before delivery to allow cancellation'),
  ('max_orders_per_slot', '100', 'Maximum orders per delivery slot'),
  ('breakfast_start', '07:30', 'Breakfast delivery start time'),
  ('breakfast_end', '09:30', 'Breakfast delivery end time'),
  ('lunch_start', '12:00', 'Lunch delivery start time'),
  ('lunch_end', '14:00', 'Lunch delivery end time'),
  ('dinner_start', '19:00', 'Dinner delivery start time'),
  ('dinner_end', '21:30', 'Dinner delivery end time'),
  ('refund_policy', 'Full refund if cancelled 30 mins before delivery', 'Refund policy text'),
  ('auto_renew_default', 'false', 'Default auto-renew for new subscriptions')
ON CONFLICT (key) DO NOTHING;

-- Seed sample coupons
INSERT INTO public.meal_coupons (code, title, description, discount_type, discount_value, min_order_amount, max_discount, usage_limit)
VALUES
  ('FIRSTMEAL', 'First Meal Free', 'Get your first meal absolutely free', 'flat', 100, 0, 100, 500),
  ('MEAL20', '20% Off Subscription', '20% off on any meal plan subscription', 'percentage', 20, 500, 200, 200),
  ('HOSTEL50', 'Hostel Special', 'Flat Rs.50 off on meal orders', 'flat', 50, 150, 50, 300)
ON CONFLICT DO NOTHING;
