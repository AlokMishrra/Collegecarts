-- ============================================================================
-- CREATE HOSTEL-WISE STOCK MANAGEMENT SYSTEM
-- ============================================================================
-- This system allows managing stock per hostel
-- Stock changes sync with main website in real-time
-- ============================================================================

-- Create hostel_stock table to track stock per hostel
CREATE TABLE IF NOT EXISTS hostel_stock (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hostel_id UUID NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    stock_quantity INTEGER NOT NULL DEFAULT 0,
    reserved_quantity INTEGER NOT NULL DEFAULT 0,
    available_quantity INTEGER GENERATED ALWAYS AS (stock_quantity - reserved_quantity) STORED,
    min_stock_level INTEGER DEFAULT 10,
    max_stock_level INTEGER DEFAULT 1000,
    last_restocked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(hostel_id, product_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_hostel_stock_hostel_id ON hostel_stock(hostel_id);
CREATE INDEX IF NOT EXISTS idx_hostel_stock_product_id ON hostel_stock(product_id);
CREATE INDEX IF NOT EXISTS idx_hostel_stock_available ON hostel_stock(available_quantity);

-- Update inventory logs to include hostel
ALTER TABLE employee_inventory_logs 
ADD COLUMN IF NOT EXISTS hostel_id UUID REFERENCES hostels(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_logs_hostel_id ON employee_inventory_logs(hostel_id);

-- Enable RLS
ALTER TABLE hostel_stock ENABLE ROW LEVEL SECURITY;

-- RLS Policies for hostel_stock
CREATE POLICY "Allow authenticated users to view hostel stock"
    ON hostel_stock
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated users to manage hostel stock"
    ON hostel_stock
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Function to sync hostel stock to main products table
CREATE OR REPLACE FUNCTION sync_hostel_stock_to_products()
RETURNS TRIGGER AS $$
BEGIN
    -- Update main products table with total stock across all hostels
    UPDATE products
    SET stock_quantity = (
        SELECT COALESCE(SUM(stock_quantity), 0)
        FROM hostel_stock
        WHERE product_id = NEW.product_id
    ),
    updated_at = NOW()
    WHERE id = NEW.product_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to sync hostel stock changes to products table
DROP TRIGGER IF EXISTS trigger_sync_hostel_stock_to_products ON hostel_stock;
CREATE TRIGGER trigger_sync_hostel_stock_to_products
    AFTER INSERT OR UPDATE OR DELETE ON hostel_stock
    FOR EACH ROW
    EXECUTE FUNCTION sync_hostel_stock_to_products();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_hostel_stock_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trigger_update_hostel_stock_updated_at ON hostel_stock;
CREATE TRIGGER trigger_update_hostel_stock_updated_at
    BEFORE UPDATE ON hostel_stock
    FOR EACH ROW
    EXECUTE FUNCTION update_hostel_stock_updated_at();

-- Create view for hostel stock summary
CREATE OR REPLACE VIEW hostel_stock_summary AS
SELECT 
    h.id as hostel_id,
    h.name as hostel_name,
    p.id as product_id,
    p.name as product_name,
    p.category_id,
    COALESCE(hs.stock_quantity, 0) as hostel_stock,
    COALESCE(hs.reserved_quantity, 0) as reserved_stock,
    COALESCE(hs.available_quantity, 0) as available_stock,
    p.stock_quantity as total_stock_all_hostels,
    hs.min_stock_level,
    hs.last_restocked_at,
    CASE 
        WHEN COALESCE(hs.stock_quantity, 0) = 0 THEN 'out_of_stock'
        WHEN COALESCE(hs.stock_quantity, 0) < COALESCE(hs.min_stock_level, 10) THEN 'low_stock'
        ELSE 'in_stock'
    END as stock_status
FROM hostels h
CROSS JOIN products p
LEFT JOIN hostel_stock hs ON h.id = hs.hostel_id AND p.id = hs.product_id;

-- Grant permissions
GRANT SELECT ON hostel_stock_summary TO authenticated;

-- Function to initialize hostel stock for a product
CREATE OR REPLACE FUNCTION initialize_hostel_stock(
    p_hostel_id UUID,
    p_product_id TEXT,
    p_initial_quantity INTEGER DEFAULT 0
)
RETURNS UUID AS $$
DECLARE
    v_stock_id UUID;
BEGIN
    INSERT INTO hostel_stock (hostel_id, product_id, stock_quantity, last_restocked_at)
    VALUES (p_hostel_id, p_product_id, p_initial_quantity, NOW())
    ON CONFLICT (hostel_id, product_id) 
    DO UPDATE SET 
        stock_quantity = hostel_stock.stock_quantity + p_initial_quantity,
        last_restocked_at = NOW(),
        updated_at = NOW()
    RETURNING id INTO v_stock_id;
    
    RETURN v_stock_id;
END;
$$ LANGUAGE plpgsql;

-- Function to adjust hostel stock
CREATE OR REPLACE FUNCTION adjust_hostel_stock(
    p_hostel_id UUID,
    p_product_id TEXT,
    p_quantity_change INTEGER,
    p_employee_id UUID,
    p_reason TEXT,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_current_stock INTEGER;
    v_new_stock INTEGER;
    v_action_type TEXT;
BEGIN
    -- Get current stock or initialize if doesn't exist
    SELECT stock_quantity INTO v_current_stock
    FROM hostel_stock
    WHERE hostel_id = p_hostel_id AND product_id = p_product_id;
    
    IF v_current_stock IS NULL THEN
        -- Initialize stock
        PERFORM initialize_hostel_stock(p_hostel_id, p_product_id, 0);
        v_current_stock := 0;
    END IF;
    
    -- Calculate new stock
    v_new_stock := GREATEST(0, v_current_stock + p_quantity_change);
    
    -- Determine action type
    v_action_type := CASE 
        WHEN p_quantity_change > 0 THEN 'stock_in'
        WHEN p_quantity_change < 0 THEN 'stock_out'
        ELSE 'adjustment'
    END;
    
    -- Update hostel stock
    UPDATE hostel_stock
    SET stock_quantity = v_new_stock,
        last_restocked_at = CASE WHEN p_quantity_change > 0 THEN NOW() ELSE last_restocked_at END,
        updated_at = NOW()
    WHERE hostel_id = p_hostel_id AND product_id = p_product_id;
    
    -- Log the change
    INSERT INTO employee_inventory_logs (
        product_id,
        employee_id,
        hostel_id,
        action_type,
        quantity_change,
        previous_quantity,
        new_quantity,
        reason,
        notes,
        reference_type
    ) VALUES (
        p_product_id,
        p_employee_id,
        p_hostel_id,
        v_action_type,
        p_quantity_change,
        v_current_stock,
        v_new_stock,
        p_reason,
        p_notes,
        'hostel_stock_adjustment'
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'previous_stock', v_current_stock,
        'new_stock', v_new_stock,
        'quantity_change', p_quantity_change
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Check tables
SELECT 
    table_name,
    (SELECT COUNT(*) FROM hostel_stock) as row_count
FROM information_schema.tables
WHERE table_name = 'hostel_stock';

-- Check if hostel_id column added to inventory logs
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'employee_inventory_logs' AND column_name = 'hostel_id';

-- ============================================================================
-- NOTES
-- ============================================================================
-- 1. Each hostel maintains its own stock for each product
-- 2. When hostel stock changes, it automatically syncs to products table
-- 3. products.stock_quantity = SUM of all hostel stocks for that product
-- 4. Main website shows total stock across all hostels
-- 5. Employees can manage stock for their assigned hostel
-- 6. All changes are logged with hostel information
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE 'Hostel-wise stock management system created successfully!';
    RAISE NOTICE 'Stock changes will sync with main website in real-time.';
    RAISE NOTICE 'Use adjust_hostel_stock() function to manage stock per hostel.';
END $$;
