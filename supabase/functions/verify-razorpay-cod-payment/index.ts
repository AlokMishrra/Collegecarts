import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = await req.json()

    console.log('Verifying Razorpay payment:', {
      orderId,
      razorpayOrderId,
      razorpayPaymentId
    })

    // Validate input
    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return new Response(
        JSON.stringify({ error: 'Missing payment details' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get Razorpay secret from environment
    const razorpayKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET')

    if (!razorpayKeySecret) {
      console.error('Razorpay secret not configured')
      return new Response(
        JSON.stringify({ error: 'Payment verification not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify signature
    const text = `${razorpayOrderId}|${razorpayPaymentId}`
    const encoder = new TextEncoder()
    const keyData = encoder.encode(razorpayKeySecret)
    const messageData = encoder.encode(text)

    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )

    const signature = await crypto.subtle.sign('HMAC', key, messageData)
    const expectedSignature = Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')

    if (expectedSignature !== razorpaySignature) {
      console.error('Signature mismatch - Expected:', expectedSignature, 'Got:', razorpaySignature)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Payment verification failed' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Payment verified successfully:', razorpayPaymentId)

    // Update order in database — skip for wallet top-ups
    if (orderId && !String(orderId).startsWith('wallet_')) {
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )

      const { error: updateError } = await supabaseClient
        .from('orders')
        .update({
          is_paid: true,
          payment_id: razorpayPaymentId,
          razorpay_signature: razorpaySignature,
          cod_collected: true,
          cod_collected_at: new Date().toISOString(),
          cod_collection_method: 'online'
        })
        .eq('id', orderId)

      if (updateError) {
        console.error('Error updating order:', updateError)
        throw updateError
      }
    } else {
      console.log('Wallet top-up payment — skipping orders table update')
    }

    return new Response(
      JSON.stringify({
        success: true,
        paid: true,
        paymentId: razorpayPaymentId,
        message: 'Payment verified successfully'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in verify-razorpay-cod-payment:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error',
        stack: error.stack 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
