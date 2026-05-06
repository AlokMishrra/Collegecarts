    -- ============================================================
    -- FIX REVIEWS CASCADE DELETE
    -- ============================================================
    -- Problem: Cannot delete products that have reviews
    -- Solution: Add CASCADE delete to foreign key constraints
    -- 
    -- When a product is deleted, all its reviews will be automatically deleted
    -- When a user is deleted, all their reviews will be automatically deleted
    -- ============================================================

    -- Drop the existing foreign key constraints
    ALTER TABLE public.reviews 
    DROP CONSTRAINT IF EXISTS reviews_product_id_fkey;

    ALTER TABLE public.reviews 
    DROP CONSTRAINT IF EXISTS reviews_user_id_fkey;

    -- Add the foreign key constraints with CASCADE delete
    ALTER TABLE public.reviews 
    ADD CONSTRAINT reviews_product_id_fkey 
    FOREIGN KEY (product_id) 
    REFERENCES public.products(id) 
    ON DELETE CASCADE;

    ALTER TABLE public.reviews 
    ADD CONSTRAINT reviews_user_id_fkey 
    FOREIGN KEY (user_id) 
    REFERENCES public.users(id) 
    ON DELETE CASCADE;

    -- Verify the constraints were created correctly
    SELECT 
    conname AS constraint_name,
    conrelid::regclass AS table_name,
    confrelid::regclass AS referenced_table,
    CASE confdeltype
        WHEN 'a' THEN 'NO ACTION'
        WHEN 'r' THEN 'RESTRICT'
        WHEN 'c' THEN 'CASCADE'
        WHEN 'n' THEN 'SET NULL'
        WHEN 'd' THEN 'SET DEFAULT'
    END AS on_delete_action
    FROM pg_constraint
    WHERE conname LIKE 'reviews_%_fkey'
    ORDER BY conname;

    -- Expected output:
    -- constraint_name          | table_name | referenced_table | on_delete_action
    -- -------------------------+------------+------------------+-----------------
    -- reviews_product_id_fkey  | reviews    | products         | CASCADE
    -- reviews_user_id_fkey     | reviews    | users            | CASCADE
