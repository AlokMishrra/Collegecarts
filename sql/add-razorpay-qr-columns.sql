-- Add Razorpay QR Code columns to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS razorpay_qr_id TEXT,
ADD COLUMN IF NOT EXISTS razorpay_qr_url TEXT,
ADD COLUMN IF NOT EXISTS qr_created_at TIMESTAMPTZ;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_orders_razorpay_qr_id ON orders(razorpay_qr_id);
