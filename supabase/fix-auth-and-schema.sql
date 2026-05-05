-- ============================================================
-- FIX: Auth Lock Contention, Missing Columns, and RLS Issues
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Add missing view_count column to knowledge_articles
ALTER TABLE public.knowledge_articles 
ADD COLUMN IF NOT EXISTS view_count integer DEFAULT 0;

-- 2. Add missing updated_at column to onboarding_progress
ALTER TABLE public.onboarding_progress 
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- 2. Fix onboarding_progress RLS policies (allow users to create their own records)
DROP POLICY IF EXISTS "Users can manage own onboarding" ON public.onboarding_progress;

CREATE POLICY "Users can read own onboarding" 
ON public.onboarding_progress 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own onboarding" 
ON public.onboarding_progress 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own onboarding" 
ON public.onboarding_progress 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own onboarding" 
ON public.onboarding_progress 
FOR DELETE 
USING (auth.uid() = user_id);

-- 3. Add index on knowledge_articles for better performance
CREATE INDEX IF NOT EXISTS idx_knowledge_articles_category_published 
ON public.knowledge_articles(category, is_published) 
WHERE is_published = true;

CREATE INDEX IF NOT EXISTS idx_knowledge_articles_view_count 
ON public.knowledge_articles(view_count DESC);

-- 4. Add index on users for auth lookups
CREATE INDEX IF NOT EXISTS idx_users_id ON public.users(id);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON public.users(phone);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON public.users(created_at DESC);

-- 5. Update knowledge_articles to allow view count updates
CREATE POLICY "Anyone can update view count" 
ON public.knowledge_articles 
FOR UPDATE 
USING (true)
WITH CHECK (true);

-- 6. Verify all tables have proper RLS
DO $$
BEGIN
  -- Enable RLS on all tables if not already enabled
  ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.knowledge_articles ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.onboarding_progress ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.gamification ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
END $$;

-- 7. Add helpful indexes for common queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_created 
ON public.notifications(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_gamification_user_id 
ON public.gamification(user_id);

CREATE INDEX IF NOT EXISTS idx_onboarding_user_id 
ON public.onboarding_progress(user_id);

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Schema fixes applied successfully!';
  RAISE NOTICE '1. Added view_count column to knowledge_articles';
  RAISE NOTICE '2. Added updated_at column to onboarding_progress';
  RAISE NOTICE '3. Fixed onboarding_progress RLS policies';
  RAISE NOTICE '4. Added performance indexes';
  RAISE NOTICE '5. Verified RLS on all tables';
END $$;
