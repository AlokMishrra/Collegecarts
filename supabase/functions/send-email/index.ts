/**
 * send-email — Email via Resend (free tier: 3000/month)
 * Deploy: supabase functions deploy send-email
 * Env vars needed: RESEND_API_KEY
 * Sign up free at: https://resend.com
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { to, subject, body, from_name = 'CollegeCart' } = await req.json();

    const apiKey = Deno.env.get('RESEND_API_KEY');
    if (!apiKey) {
      console.warn('RESEND_API_KEY not set — email skipped');
      return Response.json({ success: true, skipped: true }, { headers: corsHeaders });
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${from_name} <noreply@yourdomain.com>`,
        to: [to],
        subject,
        html: body,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('Resend error:', err);
      return Response.json({ success: false, error: err }, { headers: corsHeaders });
    }

    return Response.json({ success: true }, { headers: corsHeaders });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
});
