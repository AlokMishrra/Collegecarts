-- Add description column to campaigns table
ALTER TABLE public.campaigns 
ADD COLUMN IF NOT EXISTS description text;

-- Add comment
COMMENT ON COLUMN public.campaigns.description IS 'Campaign description for display purposes';
