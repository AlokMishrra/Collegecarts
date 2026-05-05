-- Fix order deletion by adding CASCADE to foreign key constraints
-- This allows orders to be deleted even if they have related loyalty_transactions

-- Drop existing foreign key constraint
ALTER TABLE loyalty_transactions 
DROP CONSTRAINT IF EXISTS loyalty_transactions_order_id_fkey;

-- Add new foreign key constraint with CASCADE delete
ALTER TABLE loyalty_transactions 
ADD CONSTRAINT loyalty_transactions_order_id_fkey 
FOREIGN KEY (order_id) 
REFERENCES orders(id) 
ON DELETE CASCADE;

-- Also check and fix campaign_usage table if it exists
ALTER TABLE campaign_usage 
DROP CONSTRAINT IF EXISTS campaign_usage_order_id_fkey;

ALTER TABLE campaign_usage 
ADD CONSTRAINT campaign_usage_order_id_fkey 
FOREIGN KEY (order_id) 
REFERENCES orders(id) 
ON DELETE CASCADE;

-- Grant necessary permissions
GRANT DELETE ON orders TO authenticated;
GRANT DELETE ON loyalty_transactions TO authenticated;
GRANT DELETE ON campaign_usage TO authenticated;
