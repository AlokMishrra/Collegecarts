-- ============================================================================
-- STEP 2: ENABLE REALTIME FOR HOSTEL_STOCK
-- ============================================================================
-- Run this AFTER STEP 1
-- ============================================================================

-- Add hostel_stock to realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'hostel_stock'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.hostel_stock;
  END IF;
END $$;

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate trigger
DROP TRIGGER IF EXISTS update_hostel_stock_updated_at ON public.hostel_stock;

CREATE TRIGGER update_hostel_stock_updated_at
    BEFORE UPDATE ON public.hostel_stock
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create performance indexes
CREATE INDEX IF NOT EXISTS idx_hostel_stock_product_id ON public.hostel_stock(product_id);
CREATE INDEX IF NOT EXISTS idx_hostel_stock_hostel_id ON public.hostel_stock(hostel_id);
CREATE INDEX IF NOT EXISTS idx_hostel_stock_product_hostel ON public.hostel_stock(product_id, hostel_id);
CREATE INDEX IF NOT EXISTS idx_hostel_stock_quantity ON public.hostel_stock(stock_quantity);

-- Verify
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND tablename = 'hostel_stock'
    ) THEN '✅ Realtime enabled'
    ELSE '❌ Realtime NOT enabled'
  END as realtime_status,
  (SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'hostel_stock' AND indexname LIKE 'idx_hostel_stock%') as index_count;
