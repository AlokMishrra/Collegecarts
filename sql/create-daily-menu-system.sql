-- ============================================================
-- DAILY MENU SYSTEM
-- Admin creates day-wise menus, users see today's menu
-- ============================================================

CREATE TABLE IF NOT EXISTS public.meal_daily_menus (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  menu_date DATE NOT NULL,
  meal_type TEXT NOT NULL, -- breakfast, lunch, snacks, dinner
  menu_item_ids UUID[] DEFAULT '{}',
  notes TEXT,
  is_published BOOLEAN DEFAULT true,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(menu_date, meal_type)
);

CREATE INDEX IF NOT EXISTS idx_daily_menus_date ON public.meal_daily_menus(menu_date);
CREATE INDEX IF NOT EXISTS idx_daily_menus_type ON public.meal_daily_menus(meal_type);

GRANT ALL ON public.meal_daily_menus TO anon, authenticated;
ALTER TABLE public.meal_daily_menus DISABLE ROW LEVEL SECURITY;
