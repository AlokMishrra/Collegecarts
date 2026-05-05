/**
 * create-razorpay-order — Creates a Razorpay order
 * Deploy: supabase functions deploy create-razorpay-order
 * Env vars: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // Verify user is authenticated
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

    const { amount, currency = 'INR', receipt } = await req.json();
    if (!amount || amount <= 0) return Response.json({ error: 'Invalid amount' }, { status: 400, headers: corsHeaders });

    const keyId = Deno.env.get('RAZORPAY_KEY_ID');
    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
    if (!keyId || !keySecret) return Response.json({ error: 'Razorpay not configured' }, { status: 500, headers: corsHeaders });

    const authHeader = btoa(`${keyId}:${keySecret}`);
    const res = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { 'Authorization': `Basic ${authHeader}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: Math.round(amount * 100),
        currency,
        receipt: receipt || `order_${Date.now()}`,
        notes: { user_id: user.id, user_email: user.email }
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return Response.json({ error: 'Failed to create order', details: err }, { status: 500, headers: corsHeaders });
    }

    const order = await res.json();
    return Response.json({ orderId: order.id, amount: order.amount, currency: order.currency, keyId }, { headers: corsHeaders });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
});
