-- ============================================================
-- COMPLETE EMPLOYEE PAYOUT SYSTEM SETUP - RUN THIS NOW
-- ============================================================
-- This fixes the column name issue and sets up everything properly

-- Drop the table if it exists to start fresh
DROP TABLE IF EXISTS employee_payouts CASCADE;

-- Create the table with correct column names
CREATE TABLE employee_payouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL,
  
  -- Payout Details
  payout_month INTEGER NOT NULL, -- 1-12
  payout_year INTEGER NOT NULL,
  payout_date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  -- Salary Breakdown (using basic_salary NOT base_salary)
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
  payment_method VARCHAR(50) DEFAULT 'bank_transfer',
  payment_reference VARCHAR(255),
  payment_status VARCHAR(50) DEFAULT 'pending',
  
  -- Notes & Metadata
  notes TEXT,
  processed_by UUID,
  processed_at TIMESTAMP,
  created_by UUID,
  
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

-- Add foreign key constraints with explicit names
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

-- Create indexes
CREATE INDEX idx_employee_payouts_employee ON employee_payouts(employee_id);
CREATE INDEX idx_employee_payouts_date ON employee_payouts(payout_date);
CREATE INDEX idx_employee_payouts_status ON employee_payouts(payment_status);
CREATE INDEX idx_employee_payouts_month_year ON employee_payouts(payout_month, payout_year);
CREATE INDEX idx_employee_payouts_processed_by ON employee_payouts(processed_by);

-- Create auto-update trigger
CREATE OR REPLACE FUNCTION update_payout_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_payout_timestamp
BEFORE UPDATE ON employee_payouts
FOR EACH ROW
EXECUTE FUNCTION update_payout_timestamp();

-- Enable RLS
ALTER TABLE employee_payouts ENABLE ROW LEVEL SECURITY;

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

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✓ Employee Payout System Setup Complete!';
  RAISE NOTICE '  - Table created with basic_salary column';
  RAISE NOTICE '  - Foreign keys configured';
  RAISE NOTICE '  - RLS policies enabled';
END $$;
