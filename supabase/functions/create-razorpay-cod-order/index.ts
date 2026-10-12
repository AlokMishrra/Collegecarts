import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { json, requireUser, isAdmin } from '../_shared/auth.ts'

/**
 * User-scoped client so RLS decides whether the caller may read the order.
 * Takes the caller's own Authorization header, never the service key.
 */
function supabaseReadClient(authHeader: string) {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } }
  );
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { orderId, amount, customerName, customerPhone, customerEmail } = body

    // Customer name/phone/email are deliberately not logged.
    console.log('Creating Razorpay order for orderId:', orderId)

    // ── HARDENED ────────────────────────────────────────────────────────
    // This function was callable by anyone holding the public anon key, and it
    // created a Razorpay order for an arbitrary amount. It also updated any
    // order row by id without checking the caller may touch it.
    //
    // Contract now:
    //   * the caller must be an authenticated user
    //   * the amount must match the order's own total_amount when the order
    //     exists, so the browser cannot choose how much a customer pays
    //   * the order row is only updated when the caller owns it or is an admin
    // ───────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization') ?? '';

    const auth = await requireUser(req);
    if (!auth) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const amountNum = Number(amount);

    // Server-side amount binding for a known order.
    if (orderId && !String(orderId).startsWith('wallet_')) {
      const admin = await isAdmin(auth.user.id);
      const rowQuery = supabaseReadClient(authHeader)
        .from('orders')
        .select('id, total_amount, user_id')
        .eq('id', orderId);

      const { data: own } = await rowQuery.maybeSingle();
      const allowed = !!own || admin;

      if (!allowed) {
        return json({ error: 'Forbidden' }, 403);
      }

      if (own && own.total_amount !== null && own.total_amount !== undefined) {
        const expected = Number(own.total_amount);
        if (Number.isFinite(expected) && Math.abs(expected - amountNum) > 0.01) {
          return json(
            { error: 'Amount does not match the order total' },
            400,
          );
        }
      }
    }

    // Get Razorpay credentials from environment
    const razorpayKeyId = Deno.env.get('RAZORPAY_KEY_ID')
    const razorpayKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET')

    console.log('Razorpay Key ID exists:', !!razorpayKeyId)
    console.log('Razorpay Secret exists:', !!razorpayKeySecret)

    if (!razorpayKeyId || !razorpayKeySecret) {
      console.error('Razorpay credentials not configured')
      return new Response(
        JSON.stringify({ error: 'Payment gateway not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Razorpay order
    const orderData = {
      amount: Math.round(amount * 100), // Convert to paise
      currency: 'INR',
      receipt: `${orderId}`.substring(0, 40), // Razorpay receipt max 40 chars
      notes: {
        order_id: orderId,
        customer_name: customerName,
        customer_phone: customerPhone,
        payment_type: 'cod_collection'
      }
    }

    const authHeader = btoa(`${razorpayKeyId}:${razorpayKeySecret}`)

    console.log('Calling Razorpay API with order data:', JSON.stringify(orderData))

    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authHeader}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(orderData)
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('Razorpay API Error Status:', response.status)
      console.error('Razorpay API Error:', error)
      return new Response(
        JSON.stringify({ 
          error: 'Failed to create payment order',
          details: error,
          status: response.status
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const razorpayOrder = await response.json()

    console.log('Razorpay order created successfully:', razorpayOrder.id)

    // Only update orders table if it's an actual order (not wallet top-up)
    if (orderId && !orderId.toString().startsWith('wallet_')) {
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )

      await supabaseClient
        .from('orders')
        .update({
          razorpay_order_id: razorpayOrder.id,
          payment_link: `https://rzp.io/l/${razorpayOrder.id}`
        })
        .eq('id', orderId)
    }

    return new Response(
      JSON.stringify({
        success: true,
        razorpayOrderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        keyId: razorpayKeyId
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in create-razorpay-cod-order:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error',
        stack: error.stack 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
