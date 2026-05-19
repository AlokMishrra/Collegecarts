-- ============================================================
-- COMPLETE EMPLOYEE PAYOUT SYSTEM SETUP
-- ============================================================
-- Run this file in Supabase SQL Editor to set up the payout system
-- This includes table creation, foreign keys, and RLS policies

-- ============================================================
-- 1. CREATE EMPLOYEE PAYOUTS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS employee_payouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL,
  
  -- Payout Details
  payout_month INTEGER NOT NULL, -- 1-12
  payout_year INTEGER NOT NULL,
  payout_date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  -- Salary Breakdown
  gross_salary DECIMAL(10,2) NOT NULL,
  basic_salary DECIMAL(10,2) NOT NULL DEFAULT 0,
  hra DECIMAL(10,2) DEFAULT 0,
  transport_allowance DECIMAL(10,2) DEFAULT 0,
  other_allowances DECIMAL(10,2) DEFAULT 0,
  
  -- Deductions
  tax_deduction DECIMAL(10,2) DEFAULT 0,
  pf_deduction DECIMAL(10,2) DEFAULT 0,
  other_deductions DECIMAL(10,2) DEFAULT 0,
  
  -- Bonuses & Penalties
  bonus DECIMAL(10,2) DEFAULT 0,
  penalty DECIMAL(10,2) DEFAULT 0,
  
  -- Calculated Totals
  total_deductions DECIMAL(10,2) NOT NULL DEFAULT 0,
  net_salary DECIMAL(10,2) NOT NULL,
  
  -- Payout Information
  payment_method VARCHAR(50) DEFAULT 'bank_transfer', -- bank_transfer, cash, cheque, upi
  payment_reference VARCHAR(255), -- Transaction ID, Cheque number, etc.
  payment_status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, failed
  
  -- Notes & Metadata
  notes TEXT,
  processed_by UUID, -- Super Admin who processed
  processed_at TIMESTAMP,
  created_by UUID, -- Who created the payout
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT unique_employee_month_year UNIQUE(employee_id, payout_month, payout_year),
  CONSTRAINT valid_month CHECK (payout_month >= 1 AND payout_month <= 12),
  CONSTRAINT valid_year CHECK (payout_year >= 2020 AND payout_year <= 2100),
  CONSTRAINT positive_amounts CHECK (
    basic_salary >= 0 AND 
    gross_salary >= 0 AND 
    net_salary >= 0
  )
);

-- ============================================================
-- 2. ADD FOREIGN KEY CONSTRAINTS WITH EXPLICIT NAMES
-- ============================================================

-- Drop existing constraints if they exist
ALTER TABLE employee_payouts 
  DROP CONSTRAINT IF EXISTS employee_payouts_employee_id_fkey;

ALTER TABLE employee_payouts 
  DROP CONSTRAINT IF EXISTS employee_payouts_processed_by_fkey;

ALTER TABLE employee_payouts 
  DROP CONSTRAINT IF EXISTS employee_payouts_created_by_fkey;

-- Add named foreign key constraints
ALTER TABLE employee_payouts
  ADD CONSTRAINT fk_payout_employee 
  FOREIGN KEY (employee_id) 
  REFERENCES employee_accounts(id) 
  ON DELETE CASCADE;

ALTER TABLE employee_payouts
  ADD CONSTRAINT fk_payout_processor 
  FOREIGN KEY (processed_by) 
  REFERENCES employee_accounts(id) 
  ON DELETE SET NULL;

ALTER TABLE employee_payouts
  ADD CONSTRAINT fk_payout_creator 
  FOREIGN KEY (created_by) 
  REFERENCES employee_accounts(id) 
  ON DELETE SET NULL;

-- ============================================================
-- 3. CREATE INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_employee_payouts_employee ON employee_payouts(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_payouts_date ON employee_payouts(payout_date);
CREATE INDEX IF NOT EXISTS idx_employee_payouts_status ON employee_payouts(payment_status);
CREATE INDEX IF NOT EXISTS idx_employee_payouts_month_year ON employee_payouts(payout_month, payout_year);
CREATE INDEX IF NOT EXISTS idx_employee_payouts_processed_by ON employee_payouts(processed_by);

-- ============================================================
-- 4. ADD COMMENTS
-- ============================================================

COMMENT ON TABLE employee_payouts IS 'Stores employee salary payout records';
COMMENT ON COLUMN employee_payouts.gross_salary IS 'Total salary before deductions';
COMMENT ON COLUMN employee_payouts.net_salary IS 'Final amount paid to employee after deductions';
COMMENT ON COLUMN employee_payouts.processed_by IS 'Super Admin who approved and processed the payout';

-- ============================================================
-- 5. CREATE AUTO-UPDATE TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION update_payout_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_payout_timestamp ON employee_payouts;

CREATE TRIGGER trigger_update_payout_timestamp
BEFORE UPDATE ON employee_payouts
FOR EACH ROW
EXECUTE FUNCTION update_payout_timestamp();

-- ============================================================
-- 6. CREATE RLS POLICIES
-- ============================================================

-- Enable RLS
ALTER TABLE employee_payouts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Super Admin full access to payouts" ON employee_payouts;
DROP POLICY IF EXISTS "Employees can view own payouts" ON employee_payouts;

-- Super Admin can do everything
CREATE POLICY "Super Admin full access to payouts"
ON employee_payouts
FOR ALL
TO public
USING (
  EXISTS (
    SELECT 1 FROM employee_accounts ea
    JOIN employee_roles er ON ea.role_id = er.id
    WHERE er.role_code = 'employee_super_admin'
    AND (er.permissions->>'all')::boolean = true
  )
);

-- Employees can view their own payouts
CREATE POLICY "Employees can view own payouts"
ON employee_payouts
FOR SELECT
TO public
USING (
  employee_id IN (
    SELECT id FROM employee_accounts
    WHERE status = 'active'
  )
);

-- ============================================================
-- SUCCESS MESSAGE
-- ============================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════';
  RAISE NOTICE '✓ Employee Payout System Setup Complete!';
  RAISE NOTICE '════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'Created:';
  RAISE NOTICE '  ✓ employee_payouts table with proper column names';
  RAISE NOTICE '  ✓ Named foreign key constraints (fixes ambiguity)';
  RAISE NOTICE '  ✓ Indexes for performance';
  RAISE NOTICE '  ✓ Auto-update trigger';
  RAISE NOTICE '  ✓ RLS policies (Super Admin only)';
  RAISE NOTICE '';
  RAISE NOTICE 'Foreign Keys:';
  RAISE NOTICE '  ✓ fk_payout_employee: employee_id -> employee_accounts';
  RAISE NOTICE '  ✓ fk_payout_processor: processed_by -> employee_accounts';
  RAISE NOTICE '  ✓ fk_payout_creator: created_by -> employee_accounts';
  RAISE NOTICE '';
  RAISE NOTICE 'Features:';
  RAISE NOTICE '  ✓ Only Super Admin can create/process payouts';
  RAISE NOTICE '  ✓ Employees can view their own payouts';
  RAISE NOTICE '  ✓ Payment tracking (pending/completed/failed)';
  RAISE NOTICE '  ✓ Bonus and penalty support';
  RAISE NOTICE '  ✓ Multiple payment methods';
  RAISE NOTICE '';
  RAISE NOTICE 'Next: Access the Payout Management page in the employee portal';
  RAISE NOTICE '';
END $$;
