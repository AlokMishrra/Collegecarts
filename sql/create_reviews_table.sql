-- ============================================================
-- REVIEWS TABLE — Run in Supabase SQL Editor
-- ============================================================
-- Creates the missing reviews table and enables RLS.
-- ============================================================

-- 1. Create the reviews table
CREATE TABLE IF NOT EXISTS public.reviews (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  product_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL DEFAULT 'Anonymous',
  order_id TEXT,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT DEFAULT '',
  is_approved BOOLEAN DEFAULT FALSE,
  admin_response TEXT,
  helpful_count INTEGER DEFAULT 0,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON public.reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON public.reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_is_approved ON public.reviews(is_approved);

-- 3. Enable RLS
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
-- Drop existing policies if re-running
DROP POLICY IF EXISTS "Anyone can read approved reviews" ON public.reviews;
DROP POLICY IF EXISTS "Users can insert own reviews" ON public.reviews;
DROP POLICY IF EXISTS "Users can update own reviews" ON public.reviews;
DROP POLICY IF EXISTS "Anon can read approved reviews" ON public.reviews;
DROP POLICY IF EXISTS "Authenticated full access reviews" ON public.reviews;

-- Simple approach: authenticated users get full access (app layer handles authorization)
CREATE POLICY "Authenticated full access reviews"
  ON public.reviews FOR ALL TO authenticated
  USING (TRUE)
  WITH CHECK (TRUE);

-- Anon can only read approved reviews
CREATE POLICY "Anon can read approved reviews"
  ON public.reviews FOR SELECT TO anon
  USING (is_approved = TRUE);

-- 5. Grant access
GRANT ALL ON public.reviews TO authenticated;
GRANT SELECT ON public.reviews TO anon;

-- 6. Reload schema
NOTIFY pgrst, 'reload schema';

SELECT 'Reviews table created successfully!' AS status;
