-- ============================================================
-- MEAL SYSTEM PHASE 2 - Kitchens, Delivery Slots, Hostel Assignment
-- ============================================================

-- 1. Kitchens
CREATE TABLE IF NOT EXISTS public.meal_kitchens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  location TEXT,
  capacity INTEGER DEFAULT 100, -- max orders per slot
  status TEXT DEFAULT 'available', -- available, busy, overloaded, closed
  assigned_hostels JSONB DEFAULT '[]', -- ["Mithali", "Gavaskar"]
  contact_phone TEXT,
  manager_name TEXT,
  operating_hours JSONB DEFAULT '{"start": "06:00", "end": "22:00"}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Kitchen Staff
CREATE TABLE IF NOT EXISTS public.meal_kitchen_staff (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  kitchen_id UUID REFERENCES public.meal_kitchens(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES public.employee_accounts(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  role TEXT DEFAULT 'chef', -- chef, helper, packing, manager
  phone TEXT,
  shift TEXT DEFAULT 'morning', -- morning, evening, full
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kitchen_staff_kitchen ON public.meal_kitchen_staff(kitchen_id);

-- 3. Delivery Slots
CREATE TABLE IF NOT EXISTS public.meal_delivery_slots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meal_type TEXT NOT NULL, -- breakfast, lunch, snacks, dinner
  start_time TEXT NOT NULL, -- "07:30"
  end_time TEXT NOT NULL, -- "09:30"
  cutoff_time TEXT NOT NULL, -- "07:00" (order before this)
  max_orders INTEGER DEFAULT 50,
  current_orders INTEGER DEFAULT 0,
  delivery_fee NUMERIC(10,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  hostels JSONB DEFAULT '[]', -- empty = all hostels
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_slots_type ON public.meal_delivery_slots(meal_type);

-- 4. Hostel Meal Assignment
CREATE TABLE IF NOT EXISTS public.meal_hostel_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hostel_name TEXT NOT NULL,
  kitchen_id UUID REFERENCES public.meal_kitchens(id) ON DELETE SET NULL,
  available_meal_types JSONB DEFAULT '["breakfast", "lunch", "snacks", "dinner"]',
  delivery_priority INTEGER DEFAULT 1, -- 1=first, 2=second etc
  special_menu JSONB DEFAULT '[]', -- hostel-exclusive items
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hostel_meal_assign ON public.meal_hostel_assignments(hostel_name);

-- 5. Kitchen Queue (live preparation tracking)
CREATE TABLE IF NOT EXISTS public.meal_kitchen_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  kitchen_id UUID REFERENCES public.meal_kitchens(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.meal_orders(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'queued', -- queued, preparing, packed, dispatched
  priority INTEGER DEFAULT 5, -- 1=highest
  estimated_time INTEGER DEFAULT 15, -- minutes
  assigned_staff TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kitchen_queue_kitchen ON public.meal_kitchen_queue(kitchen_id);
CREATE INDEX IF NOT EXISTS idx_kitchen_queue_status ON public.meal_kitchen_queue(status);

-- Grant access
GRANT ALL ON public.meal_kitchens TO anon, authenticated;
GRANT ALL ON public.meal_kitchen_staff TO anon, authenticated;
GRANT ALL ON public.meal_delivery_slots TO anon, authenticated;
GRANT ALL ON public.meal_hostel_assignments TO anon, authenticated;
GRANT ALL ON public.meal_kitchen_queue TO anon, authenticated;

-- Disable RLS
ALTER TABLE public.meal_kitchens DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_kitchen_staff DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_delivery_slots DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_hostel_assignments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_kitchen_queue DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- SEED DATA
-- ============================================================

-- Default Kitchens
INSERT INTO public.meal_kitchens (name, location, capacity, assigned_hostels, status)
VALUES 
  ('Main Kitchen', 'Campus Block A', 200, '["Mithali", "Gavaskar"]', 'available'),
  ('Hostel Kitchen', 'Hostel Block B', 100, '["Virat", "Tendulkar"]', 'available')
ON CONFLICT DO NOTHING;

-- Default Delivery Slots
INSERT INTO public.meal_delivery_slots (meal_type, start_time, end_time, cutoff_time, max_orders)
VALUES
  ('breakfast', '07:30', '09:30', '07:00', 80),
  ('lunch', '12:00', '14:00', '11:30', 120),
  ('snacks', '16:00', '17:30', '15:30', 60),
  ('dinner', '19:00', '21:30', '18:30', 120)
ON CONFLICT DO NOTHING;

-- Default Hostel Assignments
INSERT INTO public.meal_hostel_assignments (hostel_name, available_meal_types, delivery_priority)
VALUES
  ('Mithali', '["breakfast", "lunch", "snacks", "dinner"]', 1),
  ('Gavaskar', '["breakfast", "lunch", "snacks", "dinner"]', 2),
  ('Virat', '["breakfast", "lunch", "dinner"]', 3),
  ('Tendulkar', '["breakfast", "lunch", "dinner"]', 4)
ON CONFLICT DO NOTHING;
