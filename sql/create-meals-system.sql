-- ============================================================
-- MEAL SUBSCRIPTION SYSTEM - Complete Database Schema
-- ============================================================

-- 1. Meal Plans (admin configurable)
CREATE TABLE IF NOT EXISTS public.meal_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  price_per_day NUMERIC(10,2) NOT NULL,
  meals_per_day INTEGER NOT NULL DEFAULT 3,
  features JSONB DEFAULT '[]',
  is_popular BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  icon TEXT DEFAULT '🍱',
  color TEXT DEFAULT '#10b981',
  student_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Meal Menu Items (daily menu managed by admin/kitchen)
CREATE TABLE IF NOT EXISTS public.meal_menu_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  meal_type TEXT NOT NULL, -- breakfast, lunch, snacks, dinner
  calories INTEGER DEFAULT 0,
  image_url TEXT,
  price NUMERIC(10,2) DEFAULT 0,
  is_available BOOLEAN DEFAULT true,
  day_of_week INTEGER, -- 0=Sunday, 1=Monday... NULL=everyday
  tags JSONB DEFAULT '[]', -- veg, non-veg, spicy, healthy etc
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meal_menu_type ON public.meal_menu_items(meal_type);
CREATE INDEX IF NOT EXISTS idx_meal_menu_available ON public.meal_menu_items(is_available);

-- 3. User Meal Subscriptions
CREATE TABLE IF NOT EXISTS public.meal_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.meal_plans(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active', -- active, paused, cancelled, expired
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE NOT NULL,
  hostel TEXT,
  room_number TEXT,
  payment_method TEXT DEFAULT 'razorpay',
  total_amount NUMERIC(10,2) NOT NULL,
  amount_paid NUMERIC(10,2) DEFAULT 0,
  auto_renew BOOLEAN DEFAULT false,
  preferences JSONB DEFAULT '{}', -- spice level, veg/non-veg, allergies
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meal_sub_user ON public.meal_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_meal_sub_status ON public.meal_subscriptions(status);

-- 4. Meal Orders (individual meal orders or from subscription)
CREATE TABLE IF NOT EXISTS public.meal_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.meal_subscriptions(id) ON DELETE SET NULL,
  meal_type TEXT NOT NULL, -- breakfast, lunch, snacks, dinner
  items JSONB NOT NULL DEFAULT '[]', -- [{name, qty, calories}]
  total_calories INTEGER DEFAULT 0,
  total_price NUMERIC(10,2) DEFAULT 0,
  status TEXT DEFAULT 'pending', -- pending, preparing, ready, delivered, cancelled
  delivery_date DATE NOT NULL DEFAULT CURRENT_DATE,
  delivery_time TEXT, -- "7:30 AM", "12:30 PM" etc
  hostel TEXT,
  room_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meal_orders_user ON public.meal_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_meal_orders_date ON public.meal_orders(delivery_date);
CREATE INDEX IF NOT EXISTS idx_meal_orders_status ON public.meal_orders(status);

-- Grant access (using custom auth like employee system)
GRANT ALL ON public.meal_plans TO anon, authenticated;
GRANT ALL ON public.meal_menu_items TO anon, authenticated;
GRANT ALL ON public.meal_subscriptions TO anon, authenticated;
GRANT ALL ON public.meal_orders TO anon, authenticated;

-- Disable RLS (using app-level auth)
ALTER TABLE public.meal_plans DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_menu_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_subscriptions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_orders DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- SEED DATA - Default Meal Plans
-- ============================================================
INSERT INTO public.meal_plans (name, description, price_per_day, meals_per_day, features, is_popular, icon, color, student_count)
VALUES 
  ('Standard Plan', 'Breakfast, Lunch, Dinner', 149, 3, '["Balanced nutrition", "Hostel delivery", "Weekly menu rotation"]', false, '🍱', '#10b981', 500),
  ('Healthy Plan', 'Low Oil, High Protein', 189, 3, '["High protein meals", "Low oil cooking", "Nutrition tracking", "Custom portions"]', true, '🥗', '#10b981', 420),
  ('Premium Plan', 'Special & Variety Meals', 219, 3, '["Premium ingredients", "Chef special dishes", "Priority delivery", "Dessert included"]', false, '⭐', '#a855f7', 300),
  ('Student Saver', 'Budget Friendly Meals', 99, 2, '["Lunch + Dinner", "Budget friendly", "Filling portions"]', false, '💰', '#f97316', 620)
ON CONFLICT DO NOTHING;

-- Seed Menu Items
INSERT INTO public.meal_menu_items (name, meal_type, calories, image_url, price, is_available)
VALUES
  ('Poha with Peanuts', 'breakfast', 300, 'https://images.unsplash.com/photo-1645177628172-a94c1f96e6db?w=120&h=120&fit=crop&q=80', 40, true),
  ('Masala Dosa', 'breakfast', 450, 'https://images.unsplash.com/photo-1630383249896-424e482df921?w=120&h=120&fit=crop&q=80', 50, true),
  ('Veg Pulao', 'breakfast', 500, 'https://images.unsplash.com/photo-1596797038530-2c107229654b?w=120&h=120&fit=crop&q=80', 45, true),
  ('Oats Upma', 'breakfast', 320, 'https://images.unsplash.com/photo-1517673400267-0251440c45dc?w=120&h=120&fit=crop&q=80', 35, true),
  ('Banana Milkshake', 'breakfast', 180, 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=120&h=120&fit=crop&q=80', 30, true),
  ('Dal Tadka + Rice', 'lunch', 550, 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=120&h=120&fit=crop&q=80', 60, true),
  ('Chole Bhature', 'lunch', 650, 'https://images.unsplash.com/photo-1626132647523-66f5bf380027?w=120&h=120&fit=crop&q=80', 70, true),
  ('Veg Thali', 'lunch', 700, 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=120&h=120&fit=crop&q=80', 80, true),
  ('Rajma Chawal', 'lunch', 580, 'https://images.unsplash.com/photo-1574484284002-952d92456975?w=120&h=120&fit=crop&q=80', 55, true),
  ('Samosa + Chai', 'snacks', 250, 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=120&h=120&fit=crop&q=80', 25, true),
  ('Bread Pakora', 'snacks', 300, 'https://images.unsplash.com/photo-1567337710282-00832b415979?w=120&h=120&fit=crop&q=80', 20, true),
  ('Vada Pav', 'snacks', 350, 'https://images.unsplash.com/photo-1606491956689-2ea866880049?w=120&h=120&fit=crop&q=80', 25, true),
  ('Paneer Butter Masala', 'dinner', 600, 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=120&h=120&fit=crop&q=80', 80, true),
  ('Naan + Dal Makhani', 'dinner', 700, 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=120&h=120&fit=crop&q=80', 75, true),
  ('Veg Biryani', 'dinner', 750, 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=120&h=120&fit=crop&q=80', 85, true),
  ('Roti + Sabzi', 'dinner', 450, 'https://images.unsplash.com/photo-1574484284002-952d92456975?w=120&h=120&fit=crop&q=80', 50, true)
ON CONFLICT DO NOTHING;
