-- ============================================================
-- CHECKOUT CHARGES SYSTEM
-- Small Cart Charge + Handling Fee
-- Created: 2026-05-15
-- ============================================================

-- Create checkout_settings table
CREATE TABLE IF NOT EXISTS public.checkout_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Small Cart Charge Settings
  small_cart_enabled BOOLEAN DEFAULT true,
  small_cart_threshold NUMERIC(10,2) DEFAULT 40.00,
  small_cart_fee NUMERIC(10,2) DEFAULT 10.00,
  
  -- Handling Charge Settings
  handling_fee_enabled BOOLEAN DEFAULT true,
  handling_fee NUMERIC(10,2) DEFAULT 10.00,
  
  -- Free Delivery Handling Charge (applies when delivery is free)
  free_delivery_handling_enabled BOOLEAN DEFAULT true,
  free_delivery_handling_fee NUMERIC(10,2) DEFAULT 20.00,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_checkout_settings_id ON public.checkout_settings(id);

-- Enable RLS
ALTER TABLE public.checkout_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Anyone can read settings (needed for checkout calculation)
CREATE POLICY "Anyone can read checkout settings"
  ON public.checkout_settings
  FOR SELECT
  USING (true);

-- Only admins can modify settings
CREATE POLICY "Only admins can modify checkout settings"
  ON public.checkout_settings
  FOR ALL
  USING (public.is_admin());

-- Insert default settings (single row)
INSERT INTO public.checkout_settings (
  small_cart_enabled,
  small_cart_threshold,
  small_cart_fee,
  handling_fee_enabled,
  handling_fee,
  free_delivery_handling_enabled,
  free_delivery_handling_fee
) VALUES (
  true,
  40.00,
  10.00,
  true,
  10.00,
  true,
  20.00
)
ON CONFLICT DO NOTHING;

-- ============================================================
-- UPDATE ORDERS TABLE - Add new fee columns
-- ============================================================

-- Add new columns to orders table if they don't exist
DO $$ 
BEGIN
  -- Add small_cart_fee column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'small_cart_fee'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN small_cart_fee NUMERIC(10,2) DEFAULT 0;
  END IF;

  -- Add handling_fee column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'handling_fee'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN handling_fee NUMERIC(10,2) DEFAULT 0;
  END IF;

  -- Add subtotal_before_fees column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'subtotal_before_fees'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN subtotal_before_fees NUMERIC(10,2) DEFAULT 0;
  END IF;

  -- Add delivery_fee column (if not exists)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'delivery_fee'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN delivery_fee NUMERIC(10,2) DEFAULT 0;
  END IF;
END $$;

-- Create indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_orders_small_cart_fee ON public.orders(small_cart_fee) WHERE small_cart_fee > 0;
CREATE INDEX IF NOT EXISTS idx_orders_handling_fee ON public.orders(handling_fee) WHERE handling_fee > 0;
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at);

-- ============================================================
-- HELPER FUNCTION: Calculate checkout charges
-- ============================================================

CREATE OR REPLACE FUNCTION public.calculate_checkout_charges(
  p_subtotal NUMERIC
)
RETURNS TABLE (
  small_cart_fee NUMERIC,
  handling_fee NUMERIC,
  total_fees NUMERIC
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_settings RECORD;
  v_small_cart_fee NUMERIC := 0;
  v_handling_fee NUMERIC := 0;
BEGIN
  -- Get current settings
  SELECT * INTO v_settings
  FROM public.checkout_settings
  LIMIT 1;

  -- Calculate small cart fee
  IF v_settings.small_cart_enabled AND p_subtotal < v_settings.small_cart_threshold THEN
    v_small_cart_fee := v_settings.small_cart_fee;
  END IF;

  -- Calculate handling fee
  IF v_settings.handling_fee_enabled THEN
    v_handling_fee := v_settings.handling_fee;
  END IF;

  -- Return results
  RETURN QUERY SELECT 
    v_small_cart_fee,
    v_handling_fee,
    v_small_cart_fee + v_handling_fee;
END;
$$;

-- ============================================================
-- TRIGGER: Update updated_at timestamp
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_checkout_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_checkout_settings_timestamp
  BEFORE UPDATE ON public.checkout_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_checkout_settings_updated_at();

-- ============================================================
-- ANALYTICS VIEWS
-- ============================================================

-- View: Checkout charges revenue summary
CREATE OR REPLACE VIEW public.checkout_charges_revenue AS
SELECT
  COUNT(*) FILTER (WHERE small_cart_fee > 0) as orders_with_small_cart_fee,
  COUNT(*) FILTER (WHERE handling_fee > 0) as orders_with_handling_fee,
  COALESCE(SUM(small_cart_fee), 0) as total_small_cart_revenue,
  COALESCE(SUM(handling_fee), 0) as total_handling_revenue,
  COALESCE(SUM(small_cart_fee + handling_fee), 0) as total_fees_revenue,
  COALESCE(AVG(subtotal_before_fees), 0) as avg_cart_value,
  DATE(created_at) as date
FROM public.orders
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Grant access to views
GRANT SELECT ON public.checkout_charges_revenue TO authenticated;

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================

-- Verify table creation
SELECT 
  'checkout_settings' as table_name,
  COUNT(*) as row_count
FROM public.checkout_settings;

-- Verify new columns in orders table
SELECT 
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_name = 'orders'
  AND column_name IN ('small_cart_fee', 'handling_fee', 'subtotal_before_fees', 'delivery_fee')
ORDER BY column_name;

-- Test calculate_checkout_charges function
SELECT * FROM public.calculate_checkout_charges(30.00); -- Should apply small cart fee
SELECT * FROM public.calculate_checkout_charges(50.00); -- Should NOT apply small cart fee

COMMENT ON TABLE public.checkout_settings IS 'Configurable checkout charges: small cart fee and handling fee';
COMMENT ON FUNCTION public.calculate_checkout_charges IS 'Calculates applicable checkout charges based on subtotal';
