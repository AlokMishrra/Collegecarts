-- ============================================================
-- ADD FREE DELIVERY HANDLING CHARGE COLUMNS
-- Adds new columns to existing checkout_settings table
-- ============================================================

-- Add new columns if they don't exist
DO $$ 
BEGIN
  -- Add free_delivery_handling_enabled column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'checkout_settings' 
    AND column_name = 'free_delivery_handling_enabled'
  ) THEN
    ALTER TABLE public.checkout_settings 
    ADD COLUMN free_delivery_handling_enabled BOOLEAN DEFAULT true;
  END IF;

  -- Add free_delivery_handling_fee column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'checkout_settings' 
    AND column_name = 'free_delivery_handling_fee'
  ) THEN
    ALTER TABLE public.checkout_settings 
    ADD COLUMN free_delivery_handling_fee NUMERIC(10,2) DEFAULT 20.00;
  END IF;
END $$;

-- Update existing row with default values
UPDATE public.checkout_settings
SET 
  free_delivery_handling_enabled = COALESCE(free_delivery_handling_enabled, true),
  free_delivery_handling_fee = COALESCE(free_delivery_handling_fee, 20.00)
WHERE free_delivery_handling_enabled IS NULL 
   OR free_delivery_handling_fee IS NULL;

-- Verify the changes
SELECT 
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_name = 'checkout_settings'
  AND column_name IN ('free_delivery_handling_enabled', 'free_delivery_handling_fee')
ORDER BY column_name;

-- Show current settings
SELECT * FROM public.checkout_settings;

COMMENT ON COLUMN public.checkout_settings.free_delivery_handling_enabled IS 'Enable special handling fee when delivery is free (above threshold)';
COMMENT ON COLUMN public.checkout_settings.free_delivery_handling_fee IS 'Handling fee amount to charge when delivery is free';
