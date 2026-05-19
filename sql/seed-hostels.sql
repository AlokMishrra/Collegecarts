-- ============================================================================
-- SEED HOSTELS DATA
-- ============================================================================
-- Creates all hostel records for the CollegeCart system
-- ============================================================================

-- Insert all hostels
INSERT INTO hostels (name, code, is_active, display_order) VALUES
('Mithali', 'MITH', true, 1),
('Gavaskar', 'GAVA', true, 2),
('Tendulkar', 'TEND', true, 3),
('Virat', 'VIRA', true, 4),
('Shyamji Auditorium', 'SHYA', true, 5),
('Other', 'OTHR', true, 6)
ON CONFLICT DO NOTHING;

-- Verification
DO $$
DECLARE
    hostel_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO hostel_count FROM hostels;
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Hostels seeded successfully!';
    RAISE NOTICE 'Total hostels in database: %', hostel_count;
    RAISE NOTICE '============================================';
END $$;

-- Show all hostels
SELECT 
    id, 
    name, 
    code, 
    is_active,
    display_order,
    created_at 
FROM hostels 
ORDER BY display_order, name;
