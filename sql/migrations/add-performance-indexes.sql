-- ============================================================
-- PERFORMANCE INDEXES FOR 10K CONCURRENT USERS
-- Run once in Supabase SQL Editor
-- ============================================================
-- These indexes make the two queries in get-shop-data fast:
--   SELECT ... FROM products ORDER BY display_order
--   SELECT ... FROM products WHERE category_id = $1
--   SELECT ... FROM categories WHERE is_active = true ORDER BY display_order
-- ============================================================

-- Products: category lookup + display ordering (most critical)
-- Used by: get-shop-data edge function, CategoryProducts page
CREATE INDEX IF NOT EXISTS idx_products_category_order
  ON public.products (category_id, display_order ASC NULLS LAST);

-- Products: global display ordering (used when no category filter)
CREATE INDEX IF NOT EXISTS idx_products_display_order
  ON public.products (display_order ASC NULLS LAST);

-- Products: stock quantity (used for in-stock filtering)
CREATE INDEX IF NOT EXISTS idx_products_stock
  ON public.products (stock_quantity DESC);

-- Products: composite for shop listing (category + stock + order)
CREATE INDEX IF NOT EXISTS idx_products_shop_listing
  ON public.products (category_id, stock_quantity DESC, display_order ASC NULLS LAST);

-- Categories: active + ordered (used in every shop load)
CREATE INDEX IF NOT EXISTS idx_categories_active_order
  ON public.categories (is_active, display_order ASC)
  WHERE is_active = true;

-- Cart items: user lookup (used on every page load for logged-in users)
CREATE INDEX IF NOT EXISTS idx_cart_items_user
  ON public.cart_items (user_id, created_at DESC);

-- Orders: user lookup (used in order history)
CREATE INDEX IF NOT EXISTS idx_orders_user_created
  ON public.orders (user_id, created_at DESC);

-- Orders: status filtering (used in admin dashboard)
CREATE INDEX IF NOT EXISTS idx_orders_status_created
  ON public.orders (status, created_at DESC);

-- Notifications: user + unread (used in notification bell)
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications (user_id, is_read, created_at DESC);

-- ============================================================
-- VERIFY
-- ============================================================
DO $$
DECLARE
  idx_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO idx_count
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND indexname LIKE 'idx_%';
  RAISE NOTICE '✅ % performance indexes present', idx_count;
END $$;
