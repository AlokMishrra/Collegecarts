/**
 * verify-razorpay-payment — Verifies a Razorpay payment and returns the
 * AUTHORITATIVE amount paid.
 *
 * Security contract (see COLLEGECART_SECURITY_FIXES.md §P0-7):
 *   1. Caller must be an authenticated Supabase Auth user.
 *   2. HMAC signature is verified with a constant-time comparison.
 *   3. The payment is fetched from Razorpay using the server-held key secret,
 *      so the amount and status returned are Razorpay's own record and cannot
 *      be forged by the browser.
 *   4. Razorpay's order amount is compared with the amount the caller
 *      expected; a mismatch is rejected rather than silently accepted.
 *   5. No secret, token or full payment payload is logged.
 *
 * Deploy: supabase functions deploy verify-razorpay-payment
 * Env vars: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, json, requireUser, timingSafeEqual, hmacSha256Hex, redact } from '../_shared/auth.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // 1. Authenticate the caller.
    const auth = await requireUser(req);
    if (!auth) return json({ error: 'Unauthorized' }, 401);

    const body = await req.json().catch(() => ({}));
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, expectedAmount } = body ?? {};

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return json({ error: 'Missing payment details' }, 400);
    }

    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
    const keyId = Deno.env.get('RAZORPAY_KEY_ID');
    if (!keyId || !keySecret) return json({ error: 'Payment gateway not configured' }, 500);

    // 2. Verify the signature with a constant-time comparison.
    const text = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = await hmacSha256Hex(keySecret, text);
    if (!timingSafeEqual(expectedSignature, String(razorpay_signature))) {
      return json({ success: false, error: 'Payment verification failed' }, 400);
    }

    // 3. Fetch the payment from Razorpay. The amount below therefore comes from
    //    the provider, not from the browser.
    const authHeader = 'Basic ' + btoa(`${keyId}:${keySecret}`);
    const payRes = await fetch(`https://api.razorpay.com/v1/payments/${razorpay_payment_id}`, {
      headers: { Authorization: authHeader },
    });

    if (!payRes.ok) {
      // Do not echo the provider's body; it can contain customer identifiers.
      return json({ success: false, error: 'Could not confirm payment with provider' }, 502);
    }

    const payment = await payRes.json();

    if (payment.status !== 'captured' && payment.status !== 'authorized') {
      return json({ success: false, error: 'Payment not completed' }, 400);
    }

    // The payment must belong to the Razorpay order we think we are verifying.
    if (String(payment.order_id) !== String(razorpay_order_id)) {
      return json({ success: false, error: 'Payment does not match order' }, 400);
    }

    // 4. Authoritative amount in rupees (Razorpay reports paise).
    const paidAmount = Number(payment.amount) / 100;
    const currency = payment.currency ?? 'INR';

    // When the caller supplies the amount it charged the customer, it must match
    // exactly. This closes the "client supplies any total" hole.
    if (expectedAmount !== undefined && expectedAmount !== null) {
      const expected = Number(expectedAmount);
      if (!Number.isFinite(expected) || Math.abs(expected - paidAmount) > 0.01) {
        return json(
          { success: false, error: 'Paid amount does not match the expected order total' },
          400,
        );
      }
    }

    if (currency !== 'INR') {
      return json({ success: false, error: 'Unsupported currency' }, 400);
    }

    // 5. Return only what the client needs to complete order placement.
    return json({
      success: true,
      paymentId: razorpay_payment_id,
      razorpayOrderId: razorpay_order_id,
      amount: paidAmount,
      currency,
      method: payment.method ?? null,
    });
  } catch (err) {
    console.error('[verify-razorpay-payment] failed:', (err as Error)?.message ?? err);
    return json({ error: 'Verification failed' }, 500);
  }
});
