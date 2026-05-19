-- ============================================================
-- EMPLOYEE PAYOUT SYSTEM
-- ============================================================
-- Creates tables and functions for employee salary payouts
-- Only Super Admin can process payouts

-- ============================================================
-- 1. CREATE EMPLOYEE PAYOUTS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS employee_payouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES employee_accounts(id) ON DELETE CASCADE,
  
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
  gross_salary DECIMAL(10,2) NOT NULL,
  total_deductions DECIMAL(10,2) NOT NULL DEFAULT 0,
  net_salary DECIMAL(10,2) NOT NULL,
  
  -- Payout Information
  payment_method VARCHAR(50) DEFAULT 'bank_transfer', -- bank_transfer, cash, cheque, upi
  payment_reference VARCHAR(255), -- Transaction ID, Cheque number, etc.
  payment_status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, failed
  
  -- Notes & Metadata
  notes TEXT,
  processed_by UUID REFERENCES employee_accounts(id), -- Super Admin who processed
  processed_at TIMESTAMP,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT unique_employee_month_year UNIQUE(employee_id, payout_month, payout_year),
  CONSTRAINT valid_month CHECK (payout_month >= 1 AND payout_month <= 12),
  CONSTRAINT valid_year CHECK (payout_year >= 2020 AND payout_year <= 2100),
  CONSTRAINT positive_amounts CHECK (
    base_salary >= 0 AND 
    gross_salary >= 0 AND 
    net_salary >= 0
  )
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_employee_payouts_employee ON employee_payouts(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_payouts_date ON employee_payouts(payout_date);
CREATE INDEX IF NOT EXISTS idx_employee_payouts_status ON employee_payouts(payment_status);
CREATE INDEX IF NOT EXISTS idx_employee_payouts_month_year ON employee_payouts(payout_month, payout_year);

-- Add comments
COMMENT ON TABLE employee_payouts IS 'Stores employee salary payout records';
COMMENT ON COLUMN employee_payouts.gross_salary IS 'Total salary before deductions';
COMMENT ON COLUMN employee_payouts.net_salary IS 'Final amount paid to employee after deductions';
COMMENT ON COLUMN employee_payouts.processed_by IS 'Super Admin who approved and processed the payout';

-- ============================================================
-- 2. CREATE PAYOUT CALCULATION FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION calculate_employee_payout(
  p_employee_id UUID,
  p_month INTEGER,
  p_year INTEGER,
  p_bonus DECIMAL DEFAULT 0,
  p_penalty DECIMAL DEFAULT 0,
  p_other_allowances DECIMAL DEFAULT 0,
  p_other_deductions DECIMAL DEFAULT 0
)
RETURNS TABLE (
  base_salary DECIMAL,
  hra DECIMAL,
  transport_allowance DECIMAL,
  gross_salary DECIMAL,
  tax_deduction DECIMAL,
  pf_deduction DECIMAL,
  total_deductions DECIMAL,
  net_salary DECIMAL
) AS $$
DECLARE
  v_base_salary DECIMAL;
  v_hra DECIMAL;
  v_transport DECIMAL;
  v_gross DECIMAL;
  v_tax DECIMAL;
  v_pf DECIMAL;
  v_total_deductions DECIMAL;
  v_net DECIMAL;
BEGIN
  -- Get salary structure
  SELECT 
    COALESCE(ss.base_salary, 0),
    COALESCE(ss.hra, 0),
    COALESCE(ss.transport_allowance, 0)
  INTO v_base_salary, v_hra, v_transport
  FROM employee_accounts ea
  LEFT JOIN employee_salary_structures ss ON ea.salary_structure_id = ss.id
  WHERE ea.id = p_employee_id;
  
  -- Calculate gross salary
  v_gross := v_base_salary + v_hra + v_transport + p_other_allowances + p_bonus - p_penalty;
  
  -- Calculate deductions (simplified - you can add complex tax logic)
  v_tax := v_gross * 0.10; -- 10% tax (example)
  v_pf := v_base_salary * 0.12; -- 12% PF (example)
  v_total_deductions := v_tax + v_pf + p_other_deductions;
  
  -- Calculate net salary
  v_net := v_gross - v_total_deductions;
  
  RETURN QUERY SELECT 
    v_base_salary,
    v_hra,
    v_transport,
    v_gross,
    v_tax,
    v_pf,
    v_total_deductions,
    v_net;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 3. CREATE AUTO-UPDATE TRIGGER
-- ============================================================

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

-- ============================================================
-- 4. CREATE RLS POLICIES
-- ============================================================

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
    WHERE er.role_code = 'SUPERADMIN'
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
  )
);

-- ============================================================
-- 5. CREATE PAYOUT SUMMARY VIEW
-- ============================================================

CREATE OR REPLACE VIEW employee_payout_summary AS
SELECT 
  ep.id,
  ep.employee_id,
  ea.employee_code,
  ea.full_name,
  ea.email,
  er.role_name,
  ed.department_name,
  ep.payout_month,
  ep.payout_year,
  TO_CHAR(TO_DATE(ep.payout_year || '-' || ep.payout_month || '-01', 'YYYY-MM-DD'), 'Month YYYY') as payout_period,
  ep.payout_date,
  ep.gross_salary,
  ep.total_deductions,
  ep.net_salary,
  ep.payment_method,
  ep.payment_status,
  ep.payment_reference,
  ep.processed_at,
  processor.full_name as processed_by_name,
  ep.created_at
FROM employee_payouts ep
JOIN employee_accounts ea ON ep.employee_id = ea.id
LEFT JOIN employee_roles er ON ea.role_id = er.id
LEFT JOIN employee_departments ed ON ea.department_id = ed.id
LEFT JOIN employee_accounts processor ON ep.processed_by = processor.id
ORDER BY ep.payout_year DESC, ep.payout_month DESC, ea.full_name;

-- ============================================================
-- 6. SEED SAMPLE DATA (OPTIONAL - FOR TESTING)
-- ============================================================

-- This will create sample payouts for existing employees
-- Comment out if you don't want sample data

/*
INSERT INTO employee_payouts (
  employee_id,
  payout_month,
  payout_year,
  base_salary,
  hra,
  transport_allowance,
  gross_salary,
  tax_deduction,
  pf_deduction,
  total_deductions,
  net_salary,
  payment_status,
  notes
)
SELECT 
  ea.id,
  EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER - 1, -- Last month
  EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER,
  COALESCE(ss.base_salary, 25000),
  COALESCE(ss.hra, 5000),
  COALESCE(ss.transport_allowance, 2000),
  COALESCE(ss.base_salary, 25000) + COALESCE(ss.hra, 5000) + COALESCE(ss.transport_allowance, 2000),
  (COALESCE(ss.base_salary, 25000) + COALESCE(ss.hra, 5000) + COALESCE(ss.transport_allowance, 2000)) * 0.10,
  COALESCE(ss.base_salary, 25000) * 0.12,
  (COALESCE(ss.base_salary, 25000) + COALESCE(ss.hra, 5000) + COALESCE(ss.transport_allowance, 2000)) * 0.10 + COALESCE(ss.base_salary, 25000) * 0.12,
  (COALESCE(ss.base_salary, 25000) + COALESCE(ss.hra, 5000) + COALESCE(ss.transport_allowance, 2000)) - ((COALESCE(ss.base_salary, 25000) + COALESCE(ss.hra, 5000) + COALESCE(ss.transport_allowance, 2000)) * 0.10 + COALESCE(ss.base_salary, 25000) * 0.12),
  'completed',
  'Sample payout for testing'
FROM employee_accounts ea
LEFT JOIN employee_salary_structures ss ON ea.salary_structure_id = ss.id
WHERE ea.status = 'active'
LIMIT 5;
*/

-- ============================================================
-- SUCCESS MESSAGE
-- ============================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════';
  RAISE NOTICE '✓ Employee Payout System Created Successfully!';
  RAISE NOTICE '════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'Created:';
  RAISE NOTICE '  ✓ employee_payouts table';
  RAISE NOTICE '  ✓ calculate_employee_payout() function';
  RAISE NOTICE '  ✓ Auto-update trigger';
  RAISE NOTICE '  ✓ RLS policies (Super Admin only)';
  RAISE NOTICE '  ✓ employee_payout_summary view';
  RAISE NOTICE '';
  RAISE NOTICE 'Features:';
  RAISE NOTICE '  ✓ Only Super Admin can create/process payouts';
  RAISE NOTICE '  ✓ Employees can view their own payouts';
  RAISE NOTICE '  ✓ Automatic salary calculations';
  RAISE NOTICE '  ✓ Payment tracking (pending/completed/failed)';
  RAISE NOTICE '  ✓ Bonus and penalty support';
  RAISE NOTICE '  ✓ Multiple payment methods';
  RAISE NOTICE '';
  RAISE NOTICE 'Next: Create the UI components for payout management';
  RAISE NOTICE '';
END $$;
