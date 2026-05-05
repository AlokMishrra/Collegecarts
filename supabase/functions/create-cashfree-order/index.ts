import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Sanitize order_id: only alphanumeric + underscore, max 50 chars
function sanitizeOrderId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 50)
}

// Sanitize phone: keep only digits, ensure 10 digits
function sanitizePhone(phone: string): string {
  const digits = (phone || '').replace(/\D/g, '')
  if (digits.length === 10) return digits
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2)
  if (digits.length > 10) return digits.slice(-10)
  return '9999999999' // fallback
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { amount, orderNumber, customerName, customerPhone, customerEmail } = body

    console.log('Received request:', { amount, orderNumber, customerName, customerPhone: customerPhone ? '***' : 'missing' })

    if (!amount || Number(amount) <= 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid amount' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ⚠️ SECURITY: Get credentials from environment variables ONLY
    const appId = Deno.env.get('CASHFREE_APP_ID')
    const secretKey = Deno.env.get('CASHFREE_SECRET_KEY')

    if (!appId || !secretKey) {
      console.error('Missing Cashfree credentials in environment variables')
      return new Response(
        JSON.stringify({ error: 'Payment gateway not configured. Please contact support.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Determine if we're in test or production mode based on secret key prefix
    const isTestMode = secretKey.includes('_test_')
    const apiUrl = isTestMode 
      ? 'https://sandbox.cashfree.com/pg/orders' 
      : 'https://api.cashfree.com/pg/orders'
    
    console.log('Cashfree mode:', isTestMode ? 'TEST/SANDBOX' : 'PRODUCTION')
    console.log('API URL:', apiUrl)

    const orderId = sanitizeOrderId(orderNumber || `CC_${Date.now()}`)
    const phone = sanitizePhone(customerPhone || '')
    const email = customerEmail || 'customer@collegecart.com'
    const name = (customerName || 'Customer').slice(0, 50)

    console.log('Creating order with:', { orderId, phone: '***', email, name, amount: Number(amount) })

    const orderData = {
      order_id: orderId,
      order_amount: Number(amount),
      order_currency: 'INR',
      customer_details: {
        customer_id: `cust_${Date.now()}`,
        customer_name: name,
        customer_email: email,
        customer_phone: phone
      },
      order_meta: {
        return_url: `https://shop.collegecarts.in/orders`
      }
    }

    console.log('Sending to Cashfree API...')
    console.log('Using App ID:', appId.substring(0, 10) + '...')
    console.log('Order data:', JSON.stringify({ ...orderData, customer_details: { ...orderData.customer_details, customer_phone: '***' } }))

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'x-client-id': appId,
        'x-client-secret': secretKey,
        'x-api-version': '2023-08-01',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(orderData)
    })

    const responseText = await response.text()
    console.log('Cashfree response status:', response.status)
    console.log('Cashfree response body:', responseText)

    if (!response.ok) {
      console.error('Cashfree API error - Status:', response.status)
      console.error('Cashfree API error - Body:', responseText)
      
      // Try to parse error details
      let errorDetails = responseText;
      try {
        const errorJson = JSON.parse(responseText);
        errorDetails = errorJson.message || errorJson.error || responseText;
      } catch (e) {
        // Keep original text if not JSON
      }
      
      return new Response(
        JSON.stringify({ 
          error: 'Failed to create payment order', 
          details: errorDetails,
          status: response.status 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const order = JSON.parse(responseText)
    console.log('Cashfree order created successfully:', order.order_id)
    console.log('Payment session ID:', order.payment_session_id)

    // Cashfree API v2023-08-01 doesn't return payment_link directly
    // We need to construct the hosted checkout URL using payment_session_id
    // Reference: https://docs.cashfree.com/docs/web-integration
    
    if (!order.payment_session_id) {
      console.error('No payment_session_id in Cashfree response. Full response:', order);
      return new Response(
        JSON.stringify({ 
          error: 'Payment session not available',
          details: 'Cashfree did not return a payment session ID.'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Construct the hosted checkout URL
    // Official Cashfree checkout URL for web integration
    const checkoutUrl = isTestMode
      ? `https://sandbox.cashfree.com/pg/view/sessions/checkout`
      : `https://api.cashfree.com/pg/view/sessions/checkout`;

    return new Response(
      JSON.stringify({
        orderId: order.order_id,
        paymentSessionId: order.payment_session_id,
        checkoutUrl: checkoutUrl,
        orderAmount: order.order_amount,
        orderCurrency: order.order_currency,
        mode: isTestMode ? 'test' : 'production'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Unhandled error:', error.message, error.stack)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
