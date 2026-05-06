-- Fix reviews foreign key to cascade on product deletion
-- This allows products to be deleted even if they have reviews

-- Drop the existing foreign key constraint
ALTER TABLE public.reviews 
DROP CONSTRAINT IF EXISTS reviews_product_id_fkey;

-- Add the foreign key constraint with CASCADE delete
ALTER TABLE public.reviews 
ADD CONSTRAINT reviews_product_id_fkey 
FOREIGN KEY (product_id) 
REFERENCES public.products(id) 
ON DELETE CASCADE;

-- Also fix user_id foreign key to handle user deletions
ALTER TABLE public.reviews 
DROP CONSTRAINT IF EXISTS reviews_user_id_fkey;

ALTER TABLE public.reviews 
ADD CONSTRAINT reviews_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES public.users(id) 
ON DELETE CASCADE;
