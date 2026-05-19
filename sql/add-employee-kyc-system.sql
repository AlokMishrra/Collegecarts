-- ============================================================
-- EMPLOYEE KYC SYSTEM - Database Schema
-- ============================================================

-- Add KYC fields to employee_accounts table
ALTER TABLE public.employee_accounts 
ADD COLUMN IF NOT EXISTS kyc_status TEXT DEFAULT 'pending', -- pending, submitted, verified, rejected
ADD COLUMN IF NOT EXISTS aadhaar_number TEXT,
ADD COLUMN IF NOT EXISTS aadhaar_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS aadhaar_name TEXT,
ADD COLUMN IF NOT EXISTS pan_number TEXT,
ADD COLUMN IF NOT EXISTS pan_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS pan_name TEXT,
ADD COLUMN IF NOT EXISTS bank_account_number TEXT,
ADD COLUMN IF NOT EXISTS bank_ifsc TEXT,
ADD COLUMN IF NOT EXISTS bank_name TEXT,
ADD COLUMN IF NOT EXISTS bank_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS kyc_submitted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS kyc_verified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS kyc_verified_by UUID,
ADD COLUMN IF NOT EXISTS kyc_rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS kyc_documents JSONB DEFAULT '{}';

-- Create index for KYC status
CREATE INDEX IF NOT EXISTS idx_employee_kyc_status ON public.employee_accounts(kyc_status);

-- Create KYC verification logs table
CREATE TABLE IF NOT EXISTS public.employee_kyc_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES public.employee_accounts(id) ON DELETE CASCADE,
  verification_type TEXT NOT NULL, -- aadhaar_otp_sent, aadhaar_otp_verified, pan_verified, bank_verified, admin_upload, admin_approved, admin_rejected
  request_data JSONB DEFAULT '{}',
  response_data JSONB DEFAULT '{}',
  status TEXT NOT NULL, -- success, failed, pending
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kyc_logs_employee ON public.employee_kyc_logs(employee_id);
CREATE INDEX IF NOT EXISTS idx_kyc_logs_type ON public.employee_kyc_logs(verification_type);

-- Grant access
GRANT ALL ON public.employee_kyc_logs TO anon, authenticated;

-- Disable RLS for employee_kyc_logs (using custom auth)
ALTER TABLE public.employee_kyc_logs DISABLE ROW LEVEL SECURITY;
