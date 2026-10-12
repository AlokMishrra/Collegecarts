/**
 * verify-cod-payment — Reports whether a COD payment link has been paid.
 *
 * HARDENED (was: an unauthenticated service-role read of any order by id).
 *
 * Security contract:
 *   1. Caller must be an authenticated Supabase Auth user.
 *   2. The order is fetched through the caller's OWN session, so RLS decides
 *      what they may see. A caller cannot probe another customer's order.
 *   3. A caller who may legitimately read the order (owner or admin) gets the
 *      result; anyone else gets 403, not a boolean that leaks existence.
 *   4. If the Supabase service key is absent, the function fails closed.
 *
 * Deploy: supabase functions deploy verify-cod-payment
 * Env vars: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
 *           CASHFREE_CLIENT_ID, CASHFREE_CLIENT_SECRET, CASHFREE_ENV
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, json, requireUser, serviceClient } from '../_shared/auth.ts';

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // 1. Authenticate.
    const auth = await requireUser(req);
    if (!auth) return json({ error: 'Unauthorized' }, 401);

    const body = (await req.json().catch(() => ({}))) as { orderId?: string };
    const orderId = body?.orderId;
    if (!orderId) return json({ error: 'orderId is required' }, 400);

    // 2 & 3. Read through the caller's own session so RLS applies.
    //          A non-owner sees zero rows rather than another customer's state.
    const { data: order, error: readErr } = await auth.client
      .from('orders')
      .select('id, cod_link_id, cod_payment_status, is_paid, delivery_person_id')
      .eq('id', orderId)
      .maybeSingle();

    if (readErr) return json({ paid: false, error: 'lookup_failed' }, 502);
    if (!order) {
      // Do not distinguish "does not exist" from "not yours".
      return json({ paid: false, error: 'forbidden' }, 403);
    }

    if (!order.cod_link_id) {
      return json({ paid: false, reason: 'no_payment_link' });
    }

    // 4. Ask the provider using server-held credentials.
    const cfClientId = Deno.env.get('CASHFREE_CLIENT_ID');
    const cfSecret = Deno.env.get('CASHFREE_CLIENT_SECRET');
    const isProd = Deno.env.get('CASHFREE_ENV') === 'production';

    if (!cfClientId || !cfSecret) {
      return json({ paid: false, error: 'provider_not_configured' }, 500);
    }

    const base = isProd ? 'https://api.cashfree.com' : 'https://sandbox.cashfree.com';
    const res = await fetch(`${base}/pg/links/${order.cod_link_id}`, {
      headers: {
        // Header set preserved from the original implementation.
        'x-api-version': '2023-08-01',
        'x-client-id': cfClientId,
        'x-client-secret': cfSecret,
      },
    });

    if (!res.ok) {
      // Distinguishing "provider says unpaid" from "provider unreachable"
      // matters: the caller surfaced the wrong one before.
      return json({ paid: false, error: 'provider_unavailable' }, 502);
    }

    const link = await res.json();
    const status = String(link?.link_status ?? link?.status ?? '').toUpperCase();
    const paid = status === 'PAID';

    // Persist the confirmed state service-side so the client never asserts it.
    // NOTE: 'completed' is the pre-existing value used by the app; preserved.
    if (paid && order.cod_payment_status !== 'completed') {
      try {
        const db = serviceClient();
        await db
          .from('orders')
          .update({ cod_payment_status: 'completed', updated_at: new Date().toISOString() })
          .eq('id', orderId);
      } catch (e) {
        console.error('[verify-cod-payment] status persist failed:', (e as Error)?.message);
      }
    }

    return json({ paid, paymentId: link?.link_id ?? null, status: link?.link_status ?? null });
  } catch (err) {
    console.error('[verify-cod-payment] error:', (err as Error)?.message ?? err);
    return json({ paid: false, error: 'verification_failed' }, 500);
  }
});
