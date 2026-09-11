-- Create OTP codes table for email verification
CREATE TABLE IF NOT EXISTS public.otp_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for quick lookup
CREATE INDEX IF NOT EXISTS idx_otp_codes_email_code ON public.otp_codes (email, code, used, expires_at);

-- Enable RLS
ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;

-- Allow anon to insert and update (for OTP flow)
CREATE POLICY "Allow anon insert otp" ON public.otp_codes
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow anon verify otp" ON public.otp_codes
  FOR UPDATE USING (true);

CREATE POLICY "Allow anon select otp" ON public.otp_codes
  FOR SELECT USING (true);

-- Function to generate and store OTP
CREATE OR REPLACE FUNCTION public.create_otp(p_email TEXT)
RETURNS TEXT AS $$
DECLARE
  v_code TEXT;
BEGIN
  -- Generate 6-digit code
  v_code := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');

  -- Invalidate any old OTPs for this email
  UPDATE public.otp_codes SET used = true
  WHERE email = p_email AND used = false;

  -- Insert new OTP (expires in 10 minutes)
  INSERT INTO public.otp_codes (email, code, expires_at)
  VALUES (p_email, v_code, now() + interval '10 minutes');

  RETURN v_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to verify OTP
CREATE OR REPLACE FUNCTION public.verify_otp(p_email TEXT, p_code TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_valid BOOLEAN;
BEGIN
  UPDATE public.otp_codes
  SET used = true
  WHERE email = p_email
    AND code = p_code
    AND used = false
    AND expires_at > now();

  v_valid := FOUND;
  RETURN v_valid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
