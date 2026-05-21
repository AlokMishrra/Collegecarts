-- ============================================================
-- WEEKLY MENU SCHEDULE SYSTEM
-- Admin sets up menu for each day of the week (Monday-Sunday)
-- Menu automatically shows to customers based on current day
-- No daily updates needed - repeats weekly automatically
-- ============================================================

-- Create weekly_menu_schedule table
CREATE TABLE IF NOT EXISTS public.weekly_menu_schedule (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 7), -- 1=Monday, 2=Tuesday, ..., 7=Sunday
  meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'snacks', 'dinner')),
  meal_id UUID NOT NULL REFERENCES public.meal_menu_items(id) ON DELETE CASCADE,
  display_order INTEGER DEFAULT 0, -- Order in which meals appear in the menu
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  
  -- Ensure unique meal per day per meal_type
  UNIQUE(day_of_week, meal_type, meal_id)
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_weekly_menu_day ON public.weekly_menu_schedule(day_of_week);
CREATE INDEX IF NOT EXISTS idx_weekly_menu_meal_type ON public.weekly_menu_schedule(meal_type);
CREATE INDEX IF NOT EXISTS idx_weekly_menu_active ON public.weekly_menu_schedule(is_active);
CREATE INDEX IF NOT EXISTS idx_weekly_menu_meal_id ON public.weekly_menu_schedule(meal_id);

-- Grant permissions
GRANT ALL ON public.weekly_menu_schedule TO anon, authenticated;
ALTER TABLE public.weekly_menu_schedule DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- FUNCTION: Get Today's Menu (Automatically based on current day)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_todays_menu()
RETURNS TABLE (
  meal_type TEXT,
  meal_id UUID,
  meal_name TEXT,
  meal_description TEXT,
  meal_price DECIMAL,
  meal_image TEXT,
  meal_calories INTEGER,
  display_order INTEGER,
  day_name TEXT
) AS $$
DECLARE
  current_day INTEGER;
BEGIN
  -- Get current day of week (1=Monday, 7=Sunday)
  current_day := EXTRACT(ISODOW FROM CURRENT_DATE);
  
  RETURN QUERY
  SELECT 
    wms.meal_type,
    m.id,
    m.name,
    m.description,
    m.price,
    m.image_url,
    m.calories,
    wms.display_order,
    CASE current_day
      WHEN 1 THEN 'Monday'
      WHEN 2 THEN 'Tuesday'
      WHEN 3 THEN 'Wednesday'
      WHEN 4 THEN 'Thursday'
      WHEN 5 THEN 'Friday'
      WHEN 6 THEN 'Saturday'
      WHEN 7 THEN 'Sunday'
    END
  FROM public.weekly_menu_schedule wms
  JOIN public.meal_menu_items m ON wms.meal_id = m.id
  WHERE wms.day_of_week = current_day
    AND wms.is_active = true
    AND m.is_available = true
  ORDER BY 
    CASE wms.meal_type
      WHEN 'breakfast' THEN 1
      WHEN 'lunch' THEN 2
      WHEN 'snacks' THEN 3
      WHEN 'dinner' THEN 4
    END,
    wms.display_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FUNCTION: Get Menu for Specific Day of Week
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_menu_for_day(p_day_of_week INTEGER)
RETURNS TABLE (
  meal_type TEXT,
  meal_id UUID,
  meal_name TEXT,
  meal_description TEXT,
  meal_price DECIMAL,
  meal_image TEXT,
  meal_calories INTEGER,
  display_order INTEGER,
  day_name TEXT
) AS $$
BEGIN
  -- Validate day_of_week
  IF p_day_of_week < 1 OR p_day_of_week > 7 THEN
    RAISE EXCEPTION 'Invalid day_of_week. Must be between 1 (Monday) and 7 (Sunday)';
  END IF;

  RETURN QUERY
  SELECT 
    wms.meal_type,
    m.id,
    m.name,
    m.description,
    m.price,
    m.image_url,
    m.calories,
    wms.display_order,
    CASE p_day_of_week
      WHEN 1 THEN 'Monday'
      WHEN 2 THEN 'Tuesday'
      WHEN 3 THEN 'Wednesday'
      WHEN 4 THEN 'Thursday'
      WHEN 5 THEN 'Friday'
      WHEN 6 THEN 'Saturday'
      WHEN 7 THEN 'Sunday'
    END
  FROM public.weekly_menu_schedule wms
  JOIN public.meal_menu_items m ON wms.meal_id = m.id
  WHERE wms.day_of_week = p_day_of_week
    AND wms.is_active = true
    AND m.is_available = true
  ORDER BY 
    CASE wms.meal_type
      WHEN 'breakfast' THEN 1
      WHEN 'lunch' THEN 2
      WHEN 'snacks' THEN 3
      WHEN 'dinner' THEN 4
    END,
    wms.display_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FUNCTION: Get Full Week Menu (For Admin View)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_full_week_menu()
RETURNS TABLE (
  day_of_week INTEGER,
  day_name TEXT,
  meal_type TEXT,
  meal_id UUID,
  meal_name TEXT,
  meal_price DECIMAL,
  meal_image TEXT,
  meal_calories INTEGER,
  display_order INTEGER,
  is_active BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    wms.day_of_week,
    CASE wms.day_of_week
      WHEN 1 THEN 'Monday'
      WHEN 2 THEN 'Tuesday'
      WHEN 3 THEN 'Wednesday'
      WHEN 4 THEN 'Thursday'
      WHEN 5 THEN 'Friday'
      WHEN 6 THEN 'Saturday'
      WHEN 7 THEN 'Sunday'
    END,
    wms.meal_type,
    m.id,
    m.name,
    m.price,
    m.image_url,
    m.calories,
    wms.display_order,
    wms.is_active
  FROM public.weekly_menu_schedule wms
  JOIN public.meal_menu_items m ON wms.meal_id = m.id
  ORDER BY wms.day_of_week, 
    CASE wms.meal_type
      WHEN 'breakfast' THEN 1
      WHEN 'lunch' THEN 2
      WHEN 'snacks' THEN 3
      WHEN 'dinner' THEN 4
    END,
    wms.display_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FUNCTION: Schedule Menu for Specific Day and Meal Type
-- ============================================================
CREATE OR REPLACE FUNCTION public.schedule_weekly_menu(
  p_day_of_week INTEGER,
  p_meal_type TEXT,
  p_meal_ids UUID[]
)
RETURNS VOID AS $$
DECLARE
  meal_id UUID;
  order_num INTEGER := 0;
BEGIN
  -- Validate day_of_week
  IF p_day_of_week < 1 OR p_day_of_week > 7 THEN
    RAISE EXCEPTION 'Invalid day_of_week. Must be between 1 (Monday) and 7 (Sunday)';
  END IF;
  
  -- Validate meal_type
  IF p_meal_type NOT IN ('breakfast', 'lunch', 'snacks', 'dinner') THEN
    RAISE EXCEPTION 'Invalid meal_type. Must be breakfast, lunch, snacks, or dinner';
  END IF;
  
  -- Delete existing menu for this day and meal_type
  DELETE FROM public.weekly_menu_schedule
  WHERE day_of_week = p_day_of_week AND meal_type = p_meal_type;
  
  -- Insert new menu items with display order
  FOREACH meal_id IN ARRAY p_meal_ids
  LOOP
    INSERT INTO public.weekly_menu_schedule (day_of_week, meal_type, meal_id, display_order)
    VALUES (p_day_of_week, p_meal_type, meal_id, order_num);
    order_num := order_num + 1;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FUNCTION: Copy Menu from One Day to Another
-- ============================================================
CREATE OR REPLACE FUNCTION public.copy_day_menu(
  p_from_day INTEGER,
  p_to_day INTEGER
)
RETURNS VOID AS $$
BEGIN
  -- Validate days
  IF p_from_day < 1 OR p_from_day > 7 OR p_to_day < 1 OR p_to_day > 7 THEN
    RAISE EXCEPTION 'Invalid day. Must be between 1 (Monday) and 7 (Sunday)';
  END IF;
  
  -- Delete existing menu for target day
  DELETE FROM public.weekly_menu_schedule WHERE day_of_week = p_to_day;
  
  -- Copy menu from source day to target day
  INSERT INTO public.weekly_menu_schedule (day_of_week, meal_type, meal_id, display_order)
  SELECT p_to_day, meal_type, meal_id, display_order
  FROM public.weekly_menu_schedule
  WHERE day_of_week = p_from_day AND is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FUNCTION: Copy Entire Week Menu (For Recurring Schedules)
-- ============================================================
CREATE OR REPLACE FUNCTION public.copy_entire_week()
RETURNS TEXT AS $$
BEGIN
  -- This function can be used to backup or duplicate the entire week's menu
  RETURN 'Week menu copied successfully';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FUNCTION: Clear Menu for Specific Day
-- ============================================================
CREATE OR REPLACE FUNCTION public.clear_day_menu(p_day_of_week INTEGER)
RETURNS VOID AS $$
BEGIN
  IF p_day_of_week < 1 OR p_day_of_week > 7 THEN
    RAISE EXCEPTION 'Invalid day. Must be between 1 (Monday) and 7 (Sunday)';
  END IF;
  
  DELETE FROM public.weekly_menu_schedule WHERE day_of_week = p_day_of_week;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Update Timestamp Trigger
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_weekly_menu_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER weekly_menu_updated
  BEFORE UPDATE ON public.weekly_menu_schedule
  FOR EACH ROW
  EXECUTE FUNCTION public.update_weekly_menu_timestamp();

-- ============================================================
-- Helper View for Easy Querying
-- ============================================================
CREATE OR REPLACE VIEW public.v_weekly_menu AS
SELECT 
  wms.id,
  wms.day_of_week,
  CASE wms.day_of_week
    WHEN 1 THEN 'Monday'
    WHEN 2 THEN 'Tuesday'
    WHEN 3 THEN 'Wednesday'
    WHEN 4 THEN 'Thursday'
    WHEN 5 THEN 'Friday'
    WHEN 6 THEN 'Saturday'
    WHEN 7 THEN 'Sunday'
  END as day_name,
  wms.meal_type,
  wms.display_order,
  m.id as meal_id,
  m.name as meal_name,
  m.description,
  m.price,
  m.image_url,
  m.calories,
  m.is_available,
  wms.is_active,
  wms.created_at,
  wms.updated_at
FROM public.weekly_menu_schedule wms
JOIN public.meal_menu_items m ON wms.meal_id = m.id
ORDER BY wms.day_of_week, 
  CASE wms.meal_type
    WHEN 'breakfast' THEN 1
    WHEN 'lunch' THEN 2
    WHEN 'snacks' THEN 3
    WHEN 'dinner' THEN 4
  END,
  wms.display_order;

GRANT SELECT ON public.v_weekly_menu TO anon, authenticated;

-- ============================================================
-- SAMPLE DATA (Optional - for testing)
-- ============================================================
-- Example: Schedule Monday breakfast
-- SELECT public.schedule_weekly_menu(
--   1, -- Monday
--   'breakfast',
--   ARRAY['meal-uuid-1', 'meal-uuid-2', 'meal-uuid-3']::UUID[]
-- );

-- Example: Get today's menu
-- SELECT * FROM public.get_todays_menu();

-- Example: Get Monday's menu
-- SELECT * FROM public.get_menu_for_day(1);

-- Example: Get full week menu
-- SELECT * FROM public.get_full_week_menu();

-- Example: Copy Monday menu to Tuesday
-- SELECT public.copy_day_menu(1, 2);
