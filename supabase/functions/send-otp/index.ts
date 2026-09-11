/**
 * send-otp — Generate OTP, store in DB, and email via Resend
 * Deploy: supabase functions deploy send-otp
 * Uses: send-email function + otp_codes table
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
    const { email } = await req.json();
    if (!email) {
      return Response.json({ error: 'Email is required' }, { status: 400, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Generate 6-digit OTP
    const code = String(Math.floor(100000 + Math.random() * 900000));

    // Invalidate old OTPs for this email
    await supabase
      .from('otp_codes')
      .update({ used: true })
      .eq('email', email)
      .eq('used', false);

    // Store new OTP (expires in 10 minutes)
    const { error: insertErr } = await supabase
      .from('otp_codes')
      .insert({
        email,
        code,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        used: false,
      });

    if (insertErr) {
      console.error('Insert error:', insertErr);
      return Response.json({ error: 'Failed to create OTP' }, { status: 500, headers: corsHeaders });
    }

    // Send email via Resend
    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (resendKey) {
      const html = `
        <!DOCTYPE html>
        <html>
        <body style="margin:0;padding:0;background-color:#f0fdf4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0fdf4;padding:40px 16px;">
            <tr><td align="center">
              <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
                <tr><td align="center" style="padding-bottom:24px;">
                  <table cellpadding="0" cellspacing="0"><tr>
                    <td style="background:#ffffff;border-radius:20px;padding:16px 28px;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
                      <table cellpadding="0" cellspacing="0"><tr>
                        <td style="padding-right:12px;vertical-align:middle;">
                          <div style="width:44px;height:44px;background:#059669;border-radius:12px;text-align:center;line-height:44px;color:#fff;font-size:24px;font-weight:900;">C</div>
                        </td>
                        <td style="vertical-align:middle;">
                          <div style="font-size:20px;font-weight:800;color:#059669;">CollegeCart</div>
                          <div style="font-size:11px;color:#6b7280;">Smart Shopping, Better Living</div>
                        </td>
                      </tr></table>
                    </td>
                  </tr></table>
                </td></tr>
                <tr><td style="background:#ffffff;border-radius:24px;box-shadow:0 4px 24px rgba(0,0,0,0.08);overflow:hidden;">
                  <div style="height:5px;background:linear-gradient(90deg,#059669,#34d399);"></div>
                  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 40px 36px;">
                    <tr><td align="center" style="padding-bottom:20px;">
                      <div style="width:64px;height:64px;background:#d1fae5;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;">
                        <span style="font-size:32px;">🔐</span>
                      </div>
                    </td></tr>
                    <tr><td align="center" style="padding-bottom:8px;">
                      <h1 style="margin:0;font-size:24px;font-weight:800;color:#111827;">Verify your email</h1>
                    </td></tr>
                    <tr><td align="center" style="padding-bottom:32px;">
                      <p style="margin:0;font-size:15px;color:#6b7280;line-height:1.6;">
                        Use the code below to complete your<br/>CollegeCart account setup.
                      </p>
                    </td></tr>
                    <tr><td align="center" style="padding-bottom:32px;">
                      <div style="background:linear-gradient(135deg,#f0fdf4,#dcfce7);border:2px solid #86efac;border-radius:16px;padding:24px 40px;display:inline-block;">
                        <div style="font-size:11px;font-weight:600;color:#059669;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px;">Your 6-digit verification code</div>
                        <div style="font-size:42px;font-weight:900;color:#065f46;letter-spacing:10px;font-family:'Courier New',monospace;">${code}</div>
                        <div style="font-size:12px;color:#6b7280;margin-top:10px;">⏱ Expires in 10 minutes</div>
                      </div>
                    </td></tr>
                    <tr><td style="padding-bottom:28px;">
                      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:12px;padding:16px 20px;">
                        <tr><td style="font-size:13px;color:#374151;line-height:1.7;">
                          <strong style="color:#111827;">How to verify:</strong><br/>
                          1. Go back to the CollegeCart app<br/>
                          2. Enter the 6-digit code above<br/>
                          3. Your account will be activated instantly
                        </td></tr>
                      </table>
                    </td></tr>
                    <tr><td align="center" style="padding-bottom:8px;">
                      <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6;">
                        If you didn't create a CollegeCart account, you can safely ignore this email.<br/>
                        Never share this code with anyone.
                      </p>
                    </td></tr>
                  </table>
                </td></tr>
                <tr><td align="center" style="padding-top:28px;">
                  <p style="margin:0 0 6px;font-size:13px;color:#6b7280;">
                    Questions? Email us at <a href="mailto:contact@collegecarts.in" style="color:#059669;font-weight:600;">contact@collegecarts.in</a>
                  </p>
                  <p style="margin:0;font-size:12px;color:#9ca3af;">© ${new Date().getFullYear()} CollegeCart</p>
                </td></tr>
              </table>
            </td></tr>
          </table>
        </body>
        </html>
      `;

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'CollegeCart <noreply@collegecarts.in>',
          to: [email],
          subject: 'Your CollegeCart Verification Code',
          html,
        }),
      });
    }

    return Response.json({ success: true }, { headers: corsHeaders });
  } catch (err) {
    console.error('send-otp error:', err);
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
});
