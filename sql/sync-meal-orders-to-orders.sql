-- ============================================================
-- SYNC MEAL ORDERS TO MAIN ORDERS TABLE
-- When a meal order is placed, it creates a corresponding entry
-- in the main orders table so delivery persons can see it.
-- Status updates sync both ways.
-- ============================================================

-- Function to sync meal_order to orders table on INSERT
CREATE OR REPLACE FUNCTION public.sync_meal_order_to_orders()
RETURNS TRIGGER AS $$
DECLARE
  item_names TEXT;
  order_items JSONB;
BEGIN
  -- Build items array for the orders table
  item_names := '';
  order_items := '[]'::JSONB;
  
  IF NEW.items IS NOT NULL AND jsonb_array_length(NEW.items) > 0 THEN
    SELECT jsonb_agg(
      jsonb_build_object(
        'product_name', item->>'name',
        'quantity', COALESCE((item->>'qty')::int, 1),
        'price', COALESCE((item->>'price')::numeric, 0)
      )
    ) INTO order_items
    FROM jsonb_array_elements(NEW.items) AS item;
    
    SELECT string_agg(item->>'name', ', ')
    INTO item_names
    FROM jsonb_array_elements(NEW.items) AS item;
  END IF;

  -- Insert into orders table
  INSERT INTO public.orders (
    id,
    user_id,
    status,
    total_amount,
    items,
    delivery_address,
    hostel,
    payment_method,
    is_paid,
    delivery_time,
    delivery_notes,
    created_at
  ) VALUES (
    NEW.id,
    NEW.user_id,
    CASE NEW.status
      WHEN 'pending' THEN 'confirmed'
      WHEN 'preparing' THEN 'preparing'
      WHEN 'ready' THEN 'out_for_delivery'
      WHEN 'delivered' THEN 'delivered'
      WHEN 'cancelled' THEN 'cancelled'
      ELSE 'confirmed'
    END,
    NEW.total_price,
    order_items,
    COALESCE(NEW.hostel, '') || ' ' || COALESCE(NEW.room_number, ''),
    NEW.hostel,
    'online',
    true,
    NEW.delivery_time,
    'Meal Order: ' || UPPER(NEW.meal_type) || CASE WHEN NEW.delivery_time IS NOT NULL THEN ' | Slot: ' || NEW.delivery_time ELSE '' END,
    NEW.created_at
  )
  ON CONFLICT (id) DO UPDATE SET
    status = EXCLUDED.status,
    total_amount = EXCLUDED.total_amount,
    delivery_time = EXCLUDED.delivery_time,
    delivery_notes = EXCLUDED.delivery_notes;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to sync status updates from meal_orders to orders
CREATE OR REPLACE FUNCTION public.sync_meal_order_status_update()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE public.orders
    SET status = CASE NEW.status
      WHEN 'pending' THEN 'confirmed'
      WHEN 'accepted' THEN 'confirmed'
      WHEN 'preparing' THEN 'preparing'
      WHEN 'ready' THEN 'out_for_delivery'
      WHEN 'delivered' THEN 'delivered'
      WHEN 'cancelled' THEN 'cancelled'
      ELSE 'confirmed'
    END,
    updated_at = NOW()
    WHERE id = NEW.id;
  END IF;
  
  -- Sync delivery partner assignment
  IF OLD.delivery_partner_id IS DISTINCT FROM NEW.delivery_partner_id THEN
    UPDATE public.orders
    SET delivery_person_id = NEW.delivery_partner_id,
        updated_at = NOW()
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to sync status updates from orders back to meal_orders
CREATE OR REPLACE FUNCTION public.sync_order_status_to_meal_order()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE public.meal_orders
    SET status = CASE NEW.status
      WHEN 'confirmed' THEN 'pending'
      WHEN 'preparing' THEN 'preparing'
      WHEN 'out_for_delivery' THEN 'ready'
      WHEN 'delivered' THEN 'delivered'
      WHEN 'cancelled' THEN 'cancelled'
      ELSE NEW.status
    END,
    updated_at = NOW()
    WHERE id = NEW.id;
  END IF;
  
  -- Sync delivery partner assignment back
  IF OLD.delivery_person_id IS DISTINCT FROM NEW.delivery_person_id THEN
    UPDATE public.meal_orders
    SET delivery_partner_id = NEW.delivery_person_id,
        delivery_partner_name = (
          SELECT name FROM public.delivery_persons WHERE id = NEW.delivery_person_id
        ),
        updated_at = NOW()
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers if any
DROP TRIGGER IF EXISTS trg_sync_meal_order_insert ON public.meal_orders;
DROP TRIGGER IF EXISTS trg_sync_meal_order_update ON public.meal_orders;
DROP TRIGGER IF EXISTS trg_sync_order_to_meal ON public.orders;

-- Create triggers
CREATE TRIGGER trg_sync_meal_order_insert
  AFTER INSERT ON public.meal_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_meal_order_to_orders();

CREATE TRIGGER trg_sync_meal_order_update
  AFTER UPDATE ON public.meal_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_meal_order_status_update();

-- Only sync back from orders to meal_orders if the order exists in meal_orders
CREATE TRIGGER trg_sync_order_to_meal
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  WHEN (EXISTS (SELECT 1 FROM public.meal_orders WHERE id = NEW.id))
  EXECUTE FUNCTION public.sync_order_status_to_meal_order();

-- Add delivery_time column to orders table if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'delivery_time'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN delivery_time TEXT;
  END IF;
END $$;

-- Add metadata column to cart_items if not exists (for storing meal_type and delivery_slot)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'cart_items' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE public.cart_items ADD COLUMN metadata JSONB DEFAULT '{}';
  END IF;
END $$;
