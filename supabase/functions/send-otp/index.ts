/**
 * send-otp — emails a CollegeCart login OTP through Resend.
 *
 * Why: the project's Supabase-hosted SMTP is rate-limited and its sender is
 * filtered by Gmail, so codes were never delivered. This asks the Supabase admin
 * API for a genuine OTP (so `supabase.auth.verifyOtp` accepts it) and delivers
 * that code with Resend on a verified domain.
 *
 * Deploy:
 *   supabase functions deploy send-otp
 *   supabase secrets set RESEND_API_KEY=re_xxx \
 *     RESEND_FROM_EMAIL="CollegeCart <noreply@collegecarts.in>"
 *
 * No database table is required and the service-role key never leaves the server.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const RESEND_COOLDOWN_SECONDS = 30;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// In-memory throttle. Edge instances are ephemeral, so this is best-effort and
// only exists to stop an accidental double-tap from burning two emails.
const lastSent = new Map<string, number>();

serve(async (req) => {
  if (req.method === 'OPTIONS') return json({ ok: true });

  const apiKey = Deno.env.get('RESEND_API_KEY');
  const fromEmail = Deno.env.get('RESEND_FROM_EMAIL');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  const missing = [
    ['RESEND_API_KEY', apiKey],
    ['RESEND_FROM_EMAIL', fromEmail],
    ['SUPABASE_SERVICE_ROLE_KEY', serviceKey],
  ]
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length) {
    console.error('missing secrets:', missing.join(', '));
    return json({ error: 'Email service not configured.' }, 500);
  }

  let email = '';
  try {
    ({ email } = await req.json());
  } catch {
    return json({ error: 'Invalid request body.' }, 400);
  }

  email = String(email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return json({ error: 'Enter a valid email address.' }, 400);

  const since = Date.now() - (lastSent.get(email) ?? 0);
  if (since < RESEND_COOLDOWN_SECONDS * 1000) {
    const wait = Math.ceil((RESEND_COOLDOWN_SECONDS * 1000 - since) / 1000);
    return json({ error: `Please wait ${wait}s before requesting another code.` }, 429);
  }

  const admin = createClient(supabaseUrl!, serviceKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // A real Supabase OTP, so the client can verify it with verifyOtp() as usual.
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  // supabase-js nests the generated values under `properties`; the raw REST
  // response returns them flat, so accept both shapes.
  const otp = data?.properties?.email_otp ?? data?.email_otp;
  if (error || !otp) {
    console.error('generateLink failed', JSON.stringify(error), Object.keys(data || {}).join(','));
    return json({ error: 'Could not create a login code. Please try again.' }, 500);
  }

  const code = String(otp);
  const resend = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: fromEmail,
      to: [email],
      subject: `${code} is your CollegeCart code`,
      html: `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:420px;margin:0 auto;padding:24px">
  <h2 style="margin:0 0 4px">Your CollegeCart code</h2>
  <p style="color:#666;margin:0 0 20px">Use this to finish signing in. It expires in 60 minutes.</p>
  <div style="font-size:34px;font-weight:700;letter-spacing:8px;background:#EFF9F1;border-radius:12px;padding:20px;text-align:center;color:#0F7A45">${code}</div>
  <p style="color:#888;font-size:12px;margin-top:24px">If you didn't request this, you can safely ignore this email.</p>
</div>`,
      text: `Your CollegeCart code is ${code}. It expires in 60 minutes.`,
    }),
  });

  if (!resend.ok) {
    console.error('resend failed', resend.status, await resend.text());
    // Don't leak provider details to the client.
    return json({ error: 'Could not send the email. Please try again.' }, 502);
  }

  lastSent.set(email, Date.now());
  return json({ ok: true });
});
