-- Add delivery partner assignment to meal orders
ALTER TABLE public.meal_orders
ADD COLUMN IF NOT EXISTS delivery_partner_id UUID REFERENCES public.delivery_persons(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS delivery_partner_name TEXT,
ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;

-- Enable realtime on meal_orders
ALTER PUBLICATION supabase_realtime ADD TABLE public.meal_orders;
