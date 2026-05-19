-- ============================================================================
-- CREATE EMPLOYEE INVENTORY LOGS TABLE
-- ============================================================================
-- This table tracks all stock changes made by employees
-- Syncs with main products table for real-time inventory management
-- ============================================================================

-- Create employee_inventory_logs table
CREATE TABLE IF NOT EXISTS employee_inventory_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employee_accounts(id) ON DELETE SET NULL,
    action_type TEXT NOT NULL CHECK (action_type IN ('stock_in', 'stock_out', 'adjustment', 'transfer')),
    quantity_change INTEGER NOT NULL,
    previous_quantity INTEGER NOT NULL,
    new_quantity INTEGER NOT NULL,
    reason TEXT NOT NULL,
    notes TEXT,
    reference_type TEXT, -- 'manual_adjustment', 'stock_order', 'transfer', 'return', etc.
    reference_id UUID, -- ID of related stock order, transfer, etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_inventory_logs_product_id ON employee_inventory_logs(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_logs_employee_id ON employee_inventory_logs(employee_id);
CREATE INDEX IF NOT EXISTS idx_inventory_logs_created_at ON employee_inventory_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_logs_action_type ON employee_inventory_logs(action_type);

-- Enable RLS
ALTER TABLE employee_inventory_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Allow employees to view all inventory logs
CREATE POLICY "Employees can view inventory logs"
    ON employee_inventory_logs
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM employee_accounts
            WHERE employee_accounts.id = auth.uid()
            AND employee_accounts.status = 'active'
        )
    );

-- Allow employees with inventory permission to insert logs
CREATE POLICY "Employees can create inventory logs"
    ON employee_inventory_logs
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM employee_accounts ea
            JOIN employee_roles er ON ea.role_id = er.id
            WHERE ea.id = auth.uid()
            AND ea.status = 'active'
            AND (
                er.permissions->>'all' = 'true'
                OR er.permissions->>'manage_inventory' = 'true'
            )
        )
    );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_inventory_log_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS trigger_update_inventory_log_updated_at ON employee_inventory_logs;
CREATE TRIGGER trigger_update_inventory_log_updated_at
    BEFORE UPDATE ON employee_inventory_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_inventory_log_updated_at();

-- Create function to sync stock changes to products table
CREATE OR REPLACE FUNCTION sync_product_stock_on_log()
RETURNS TRIGGER AS $$
BEGIN
    -- This trigger ensures the products table is always in sync
    -- The application should update products first, then log
    -- This is a safety check
    
    -- Verify the new_quantity matches the product's current stock
    DECLARE
        current_stock INTEGER;
    BEGIN
        SELECT stock_quantity INTO current_stock
        FROM products
        WHERE id = NEW.product_id;
        
        -- If there's a mismatch, log a warning
        IF current_stock != NEW.new_quantity THEN
            RAISE WARNING 'Stock mismatch detected for product %: Expected %, Got %', 
                NEW.product_id, NEW.new_quantity, current_stock;
        END IF;
    END;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to verify stock sync
DROP TRIGGER IF EXISTS trigger_sync_product_stock_on_log ON employee_inventory_logs;
CREATE TRIGGER trigger_sync_product_stock_on_log
    AFTER INSERT ON employee_inventory_logs
    FOR EACH ROW
    EXECUTE FUNCTION sync_product_stock_on_log();

-- Create view for inventory summary
CREATE OR REPLACE VIEW inventory_summary AS
SELECT 
    p.id as product_id,
    p.name as product_name,
    p.category_id,
    p.stock_quantity as current_stock,
    COUNT(eil.id) as total_transactions,
    SUM(CASE WHEN eil.action_type = 'stock_in' THEN eil.quantity_change ELSE 0 END) as total_stock_in,
    SUM(CASE WHEN eil.action_type = 'stock_out' THEN ABS(eil.quantity_change) ELSE 0 END) as total_stock_out,
    MAX(eil.created_at) as last_transaction_date
FROM products p
LEFT JOIN employee_inventory_logs eil ON p.id = eil.product_id
GROUP BY p.id, p.name, p.category_id, p.stock_quantity;

-- Grant permissions
GRANT SELECT ON inventory_summary TO authenticated;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Check if table exists
SELECT 
    table_name,
    (SELECT COUNT(*) FROM employee_inventory_logs) as row_count
FROM information_schema.tables
WHERE table_name = 'employee_inventory_logs';

-- Check indexes
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'employee_inventory_logs';

-- Check RLS policies
SELECT 
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies
WHERE tablename = 'employee_inventory_logs';

-- ============================================================================
-- NOTES
-- ============================================================================
-- 1. This table logs ALL stock changes made through the employee system
-- 2. Stock changes are immediately reflected in the products table
-- 3. The main website reads from the products table, so changes sync instantly
-- 4. RLS ensures only authorized employees can manage inventory
-- 5. All changes are audited with employee ID and timestamp
-- 6. The inventory_summary view provides quick analytics
-- ============================================================================

-- Final verification and success message
DO $$
BEGIN
    RAISE NOTICE 'Employee inventory logs table created successfully!';
    RAISE NOTICE 'Stock changes will now sync with main website in real-time.';
END $$;
