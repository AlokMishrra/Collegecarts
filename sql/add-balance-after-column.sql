-- Add balance_after column to wallet_transactions table

ALTER TABLE wallet_transactions 
ADD COLUMN IF NOT EXISTS balance_after DECIMAL(10,2) DEFAULT 0;

-- Add comment
COMMENT ON COLUMN wallet_transactions.balance_after IS 'Balance after this transaction was applied';

-- Update existing records to calculate balance_after
-- This is optional - you can leave existing records as 0
UPDATE wallet_transactions 
SET balance_after = 0 
WHERE balance_after IS NULL;
