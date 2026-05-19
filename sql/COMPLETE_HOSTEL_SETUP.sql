-- ============================================================================
-- COMPLETE HOSTEL SETUP - RUN THIS IN SUPABASE SQL EDITOR
-- ============================================================================
-- This script will:
-- 1. Create hostels table if it doesn't exist
-- 2. Seed all hostel data
-- 3. Fix RLS policies
-- 4. Create hostel_stock table and sync system
-- 5. Initialize stock for all products across all hostels
-- ============================================================================

-- ============================================================================
-- STEP 1: CREATE HOSTELS TABLE (if not exists)
-- ============================================================================

CREATE TABLE IF NOT EXISTS hostels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT,
  block TEXT,
  address TEXT,
  contact_person TEXT,
  contact_phone TEXT,
  total_rooms INTEGER DEFAULT 0,
  assigned_delivery_persons TEXT[] DEFAULT '{}',
  delivery_radius_km NUMERIC DEFAULT 2,
  coordinates JSONB DEFAULT '{"latitude": 0, "longitude": 0}',
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- STEP 2: SEED HOSTELS DATA
-- ============================================================================

-- Delete existing hostels to avoid duplicates
DELETE FROM hostels;

-- Insert all hostels
INSERT INTO hostels (name, code, is_active, display_order) VALUES
('Mithali', 'MITH', true, 1),
('Gavaskar', 'GAVA', true, 2),
('Tendulkar', 'TEND', true, 3),
('Virat', 'VIRA', true, 4),
('Shyamji Auditorium', 'SHYA', true, 5),
('Other', 'OTHR', true, 6);

-- ============================================================================
-- STEP 3: FIX RLS POLICIES FOR HOSTELS
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Allow authenticated users to view hostels" ON hostels;
DROP POLICY IF EXISTS "Enable read access for all users" ON hostels;
DROP POLICY IF EXISTS "Public hostels are viewable by everyone" ON hostels;
DROP POLICY IF EXISTS "Anyone can read hostels" ON hostels;
DROP POLICY IF EXISTS "Admins can manage hostels" ON hostels;
DROP POLICY IF EXISTS "Allow all authenticated users to view hostels" ON hostels;
DROP POLICY IF EXISTS "Allow authenticated users to manage hostels" ON hostels;

-- Enable RLS
ALTER TABLE hostels ENABLE ROW LEVEL SECURITY;

-- Create new policies - allow ALL users (authenticated and anon) to view hostels
CREATE POLICY "Public can view all hostels"
    ON hostels
    FOR SELECT
    USING (true);

-- Allow authenticated users to manage hostels
CREATE POLICY "Authenticated users can manage hostels"
    ON hostels
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- ============================================================================
-- STEP 4: CREATE HOSTEL STOCK SYSTEM
-- ============================================================================

-- Create hostel_stock table
CREATE TABLE IF NOT EXISTS hostel_stock (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hostel_id UUID NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    stock_quantity INTEGER NOT NULL DEFAULT 0,
    reserved_quantity INTEGER NOT NULL DEFAULT 0,
    available_quantity INTEGER GENERATED ALWAYS AS (stock_quantity - reserved_quantity) STORED,
    min_stock_level INTEGER DEFAULT 10,
    max_stock_level INTEGER DEFAULT 1000,
    last_restocked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(hostel_id, product_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_hostel_stock_hostel_id ON hostel_stock(hostel_id);
CREATE INDEX IF NOT EXISTS idx_hostel_stock_product_id ON hostel_stock(product_id);
CREATE INDEX IF NOT EXISTS idx_hostel_stock_available ON hostel_stock(available_quantity);

-- Enable RLS for hostel_stock
ALTER TABLE hostel_stock ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Allow authenticated users to view hostel stock" ON hostel_stock;
DROP POLICY IF EXISTS "Allow authenticated users to manage hostel stock" ON hostel_stock;
DROP POLICY IF EXISTS "Public can view hostel stock" ON hostel_stock;
DROP POLICY IF EXISTS "Authenticated users can manage hostel stock" ON hostel_stock;

-- Create new policies
CREATE POLICY "Public can view hostel stock"
    ON hostel_stock
    FOR SELECT
    USING (true);

CREATE POLICY "Authenticated users can manage hostel stock"
    ON hostel_stock
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- ============================================================================
-- STEP 5: CREATE SYNC FUNCTION
-- ============================================================================

-- Function to sync hostel stock to main products table
CREATE OR REPLACE FUNCTION sync_hostel_stock_to_products()
RETURNS TRIGGER AS $$
BEGIN
    -- Update main products table with total stock across all hostels
    UPDATE products
    SET stock_quantity = (
        SELECT COALESCE(SUM(stock_quantity), 0)
        FROM hostel_stock
        WHERE product_id = COALESCE(NEW.product_id, OLD.product_id)
    ),
    updated_at = NOW()
    WHERE id = COALESCE(NEW.product_id, OLD.product_id);
    
    RETURN COALESCE(NEW, OLD);
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

-- ============================================================================
-- STEP 6: CREATE ADJUST HOSTEL STOCK FUNCTION
-- ============================================================================

-- Add hostel_id column to inventory logs if not exists
ALTER TABLE employee_inventory_logs 
ADD COLUMN IF NOT EXISTS hostel_id UUID REFERENCES hostels(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_logs_hostel_id ON employee_inventory_logs(hostel_id);

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
-- STEP 7: INITIALIZE HOSTEL STOCK FOR ALL PRODUCTS
-- ============================================================================

-- Initialize stock for all products in all hostels (starting with 0)
-- This creates the records so employees can start managing stock
INSERT INTO hostel_stock (hostel_id, product_id, stock_quantity)
SELECT h.id, p.id, 0
FROM hostels h
CROSS JOIN products p
ON CONFLICT (hostel_id, product_id) DO NOTHING;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
    hostel_count INTEGER;
    product_count INTEGER;
    stock_record_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO hostel_count FROM hostels;
    SELECT COUNT(*) INTO product_count FROM products;
    SELECT COUNT(*) INTO stock_record_count FROM hostel_stock;
    
    RAISE NOTICE '============================================';
    RAISE NOTICE 'HOSTEL SYSTEM SETUP COMPLETE!';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Total hostels: %', hostel_count;
    RAISE NOTICE 'Total products: %', product_count;
    RAISE NOTICE 'Total hostel stock records: %', stock_record_count;
    RAISE NOTICE '============================================';
    RAISE NOTICE 'All hostels can now be viewed by employees';
    RAISE NOTICE 'Stock management is ready to use';
    RAISE NOTICE '============================================';
END $$;

-- Show all hostels
SELECT 
    id, 
    name, 
    code, 
    is_active,
    display_order
FROM hostels 
ORDER BY display_order, name;

-- Show RLS policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies
WHERE tablename IN ('hostels', 'hostel_stock')
ORDER BY tablename, policyname;
