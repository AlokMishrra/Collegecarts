-- ============================================================
-- COMPLETE DATABASE FIX FOR COLLEGECART (VERSION 4 - CORRECTED)
-- Run this ENTIRE script in Supabase SQL Editor
-- ============================================================
-- This version is corrected to match your actual database schema
-- Uses created_at instead of created_date
-- ============================================================

-- ============================================================
-- STEP 1: Add Scheduled Orders Support
-- ============================================================

-- Add scheduled order columns to orders table
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'is_scheduled'
    ) THEN
        ALTER TABLE public.orders ADD COLUMN is_scheduled BOOLEAN DEFAULT FALSE;
        RAISE NOTICE '✅ Added is_scheduled column';
    ELSE
        RAISE NOTICE 'ℹ️  is_scheduled column already exists';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'scheduled_time'
    ) THEN
        ALTER TABLE public.orders ADD COLUMN scheduled_time TIMESTAMPTZ;
        RAISE NOTICE '✅ Added scheduled_time column';
    ELSE
        RAISE NOTICE 'ℹ️  scheduled_time column already exists';
    END IF;
END $$;

-- Add index for scheduled orders (for efficient querying)
CREATE INDEX IF NOT EXISTS idx_orders_scheduled 
ON public.orders(is_scheduled, scheduled_time) 
WHERE is_scheduled = TRUE;

-- ============================================================
-- STEP 2: Add Payment Tracking Columns
-- ============================================================

-- Add payment tracking columns to orders table
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'razorpay_order_id'
    ) THEN
        ALTER TABLE public.orders ADD COLUMN razorpay_order_id VARCHAR(255);
        RAISE NOTICE '✅ Added razorpay_order_id column';
    ELSE
        RAISE NOTICE 'ℹ️  razorpay_order_id column already exists';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'razorpay_signature'
    ) THEN
        ALTER TABLE public.orders ADD COLUMN razorpay_signature VARCHAR(255);
        RAISE NOTICE '✅ Added razorpay_signature column';
    ELSE
        RAISE NOTICE 'ℹ️  razorpay_signature column already exists';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'cashfree_order_id'
    ) THEN
        ALTER TABLE public.orders ADD COLUMN cashfree_order_id VARCHAR(255);
        RAISE NOTICE '✅ Added cashfree_order_id column';
    ELSE
        RAISE NOTICE 'ℹ️  cashfree_order_id column already exists';
    END IF;
END $$;

-- Add index for payment tracking
CREATE INDEX IF NOT EXISTS idx_orders_payment_id ON public.orders(payment_id);

-- ============================================================
-- STEP 3: Update Withdrawal Requests Table
-- ============================================================

-- Add bank details columns if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'withdrawal_requests' AND column_name = 'bank_account_number'
    ) THEN
        ALTER TABLE public.withdrawal_requests ADD COLUMN bank_account_number VARCHAR(255);
        RAISE NOTICE '✅ Added bank_account_number column';
    ELSE
        RAISE NOTICE 'ℹ️  bank_account_number column already exists';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'withdrawal_requests' AND column_name = 'ifsc_code'
    ) THEN
        ALTER TABLE public.withdrawal_requests ADD COLUMN ifsc_code VARCHAR(20);
        RAISE NOTICE '✅ Added ifsc_code column';
    ELSE
        RAISE NOTICE 'ℹ️  ifsc_code column already exists';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'withdrawal_requests' AND column_name = 'account_holder_name'
    ) THEN
        ALTER TABLE public.withdrawal_requests ADD COLUMN account_holder_name VARCHAR(255);
        RAISE NOTICE '✅ Added account_holder_name column';
    ELSE
        RAISE NOTICE 'ℹ️  account_holder_name column already exists';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'withdrawal_requests' AND column_name = 'bank_name'
    ) THEN
        ALTER TABLE public.withdrawal_requests ADD COLUMN bank_name VARCHAR(255);
        RAISE NOTICE '✅ Added bank_name column';
    ELSE
        RAISE NOTICE 'ℹ️  bank_name column already exists';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'withdrawal_requests' AND column_name = 'cashfree_transfer_id'
    ) THEN
        ALTER TABLE public.withdrawal_requests ADD COLUMN cashfree_transfer_id VARCHAR(255);
        RAISE NOTICE '✅ Added cashfree_transfer_id column';
    ELSE
        RAISE NOTICE 'ℹ️  cashfree_transfer_id column already exists';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'withdrawal_requests' AND column_name = 'cashfree_beneficiary_id'
    ) THEN
        ALTER TABLE public.withdrawal_requests ADD COLUMN cashfree_beneficiary_id VARCHAR(255);
        RAISE NOTICE '✅ Added cashfree_beneficiary_id column';
    ELSE
        RAISE NOTICE 'ℹ️  cashfree_beneficiary_id column already exists';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'withdrawal_requests' AND column_name = 'rejection_reason'
    ) THEN
        ALTER TABLE public.withdrawal_requests ADD COLUMN rejection_reason TEXT;
        RAISE NOTICE '✅ Added rejection_reason column';
    ELSE
        RAISE NOTICE 'ℹ️  rejection_reason column already exists';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'withdrawal_requests' AND column_name = 'processed_date'
    ) THEN
        ALTER TABLE public.withdrawal_requests ADD COLUMN processed_date TIMESTAMPTZ;
        RAISE NOTICE '✅ Added processed_date column';
    ELSE
        RAISE NOTICE 'ℹ️  processed_date column already exists';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'withdrawal_requests' AND column_name = 'completed_date'
    ) THEN
        ALTER TABLE public.withdrawal_requests ADD COLUMN completed_date TIMESTAMPTZ;
        RAISE NOTICE '✅ Added completed_date column';
    ELSE
        RAISE NOTICE 'ℹ️  completed_date column already exists';
    END IF;
END $$;

-- Add indexes for withdrawal requests
CREATE INDEX IF NOT EXISTS idx_withdrawal_status ON public.withdrawal_requests(status);
CREATE INDEX IF NOT EXISTS idx_withdrawal_delivery_person ON public.withdrawal_requests(delivery_person_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_created_at ON public.withdrawal_requests(created_at DESC);

-- ============================================================
-- STEP 4: Create Error Logs Table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.error_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Error details
  error_message TEXT,
  error_stack TEXT,
  component_stack TEXT,
  
  -- Context
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  url TEXT,
  user_agent TEXT,
  browser_info JSONB,
  
  -- Categorization
  error_type VARCHAR(100), -- 'frontend', 'backend', 'network', 'database'
  severity VARCHAR(50) DEFAULT 'error', -- 'info', 'warning', 'error', 'critical'
  
  -- Resolution
  is_resolved BOOLEAN DEFAULT FALSE,
  resolved_by UUID REFERENCES public.users(id),
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  
  -- Timestamp
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for error logs
CREATE INDEX IF NOT EXISTS idx_error_logs_timestamp ON public.error_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_user ON public.error_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_error_logs_type ON public.error_logs(error_type);
CREATE INDEX IF NOT EXISTS idx_error_logs_severity ON public.error_logs(severity);
CREATE INDEX IF NOT EXISTS idx_error_logs_unresolved ON public.error_logs(is_resolved) WHERE is_resolved = FALSE;

-- Enable RLS
ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

-- Create policy for error logs
DROP POLICY IF EXISTS "public_all_error_logs" ON public.error_logs;
CREATE POLICY "public_all_error_logs" ON public.error_logs FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- STEP 5: Fix Delivery Persons Constraints
-- ============================================================

-- Make password nullable (we use OTP login)
ALTER TABLE public.delivery_persons ALTER COLUMN password DROP NOT NULL;

-- Set default password for existing rows without password
UPDATE public.delivery_persons SET password = 'otp_login' WHERE password IS NULL OR password = '';

-- Make email nullable (it's optional)
ALTER TABLE public.delivery_persons ALTER COLUMN email DROP NOT NULL;

-- Drop unique constraint on email (since it can be null)
ALTER TABLE public.delivery_persons DROP CONSTRAINT IF EXISTS delivery_persons_email_key;

-- ============================================================
-- STEP 6: Add Missing updated_at Columns
-- ============================================================

-- Add updated_at to notifications if missing
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifications' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE public.notifications ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
        RAISE NOTICE '✅ Added updated_at to notifications';
    ELSE
        RAISE NOTICE 'ℹ️  notifications.updated_at already exists';
    END IF;
END $$;

-- Add updated_at to onboarding_progress if missing
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'onboarding_progress' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE public.onboarding_progress ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
        RAISE NOTICE '✅ Added updated_at to onboarding_progress';
    ELSE
        RAISE NOTICE 'ℹ️  onboarding_progress.updated_at already exists';
    END IF;
END $$;

-- ============================================================
-- STEP 7: Refresh Supabase Schema Cache
-- ============================================================

DO $$
BEGIN
    NOTIFY pgrst, 'reload schema';
    RAISE NOTICE '✅ Schema cache refreshed';
END $$;

-- ============================================================
-- STEP 8: Verification
-- ============================================================

-- Check scheduled order columns
DO $$
DECLARE
    col_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO col_count
    FROM information_schema.columns 
    WHERE table_name = 'orders' 
    AND column_name IN ('is_scheduled', 'scheduled_time', 'payment_id', 'razorpay_order_id', 'cashfree_order_id');
    
    RAISE NOTICE '✅ Orders table has % payment/scheduling columns', col_count;
END $$;

-- Check error_logs table exists
DO $$
DECLARE
    table_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'error_logs'
    ) INTO table_exists;
    
    IF table_exists THEN
        RAISE NOTICE '✅ error_logs table exists';
    ELSE
        RAISE NOTICE '⚠️  error_logs table does not exist';
    END IF;
END $$;

-- ============================================================
-- SUCCESS MESSAGE
-- ============================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🎉🎉🎉 DATABASE UPDATE COMPLETE! 🎉🎉🎉';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Scheduled orders support added';
  RAISE NOTICE '   - is_scheduled column';
  RAISE NOTICE '   - scheduled_time column';
  RAISE NOTICE '   - Performance index created';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Payment tracking added';
  RAISE NOTICE '   - razorpay_order_id column';
  RAISE NOTICE '   - razorpay_signature column';
  RAISE NOTICE '   - cashfree_order_id column';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Withdrawal requests enhanced';
  RAISE NOTICE '   - Bank details columns';
  RAISE NOTICE '   - Cashfree tracking columns';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Error logging system created';
  RAISE NOTICE '   - error_logs table';
  RAISE NOTICE '   - Indexes for performance';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Delivery persons constraints fixed';
  RAISE NOTICE '✅ Missing columns added';
  RAISE NOTICE '✅ Schema cache refreshed';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 YOUR DATABASE IS NOW READY FOR:';
  RAISE NOTICE '   1. ⏰ Scheduled Orders (10-30 min window)';
  RAISE NOTICE '   2. 💳 Razorpay & Cashfree Payments';
  RAISE NOTICE '   3. 💰 Delivery Partner Withdrawals';
  RAISE NOTICE '   4. 🐛 Error Tracking & Logging';
  RAISE NOTICE '';
  RAISE NOTICE '📋 NEXT STEPS:';
  RAISE NOTICE '   1. Test scheduled order creation in Cart';
  RAISE NOTICE '   2. Verify delivery partner sees scheduled time';
  RAISE NOTICE '   3. Check admin Scheduled Orders tab';
  RAISE NOTICE '   4. Deploy backend for auto-release cron job';
  RAISE NOTICE '';
  RAISE NOTICE '✨ ALL FEATURES ARE NOW ENABLED!';
  RAISE NOTICE '';
END $$;
