import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders })
  }

  try {
    const { orderId, amount, customerName, customerPhone, customerEmail } = await req.json()

    console.log('COD Payment Link Request:', { orderId, amount, customerName, phone: customerPhone ? '***' : 'missing' })

    // Validate inputs
    if (!orderId || !amount || !customerName || !customerPhone) {
      console.error('Missing required fields:', { orderId: !!orderId, amount: !!amount, customerName: !!customerName, customerPhone: !!customerPhone })
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get Cashfree credentials - try both naming conventions
    const APP_ID = Deno.env.get('CASHFREE_APP_ID') || Deno.env.get('CASHFREE_CLIENT_ID')
    const SECRET_KEY = Deno.env.get('CASHFREE_SECRET_KEY') || Deno.env.get('CASHFREE_CLIENT_SECRET')
    
    if (!APP_ID || !SECRET_KEY) {
      console.error('Cashfree credentials not found in environment')
      return new Response(
        JSON.stringify({ error: 'Payment gateway not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Sanitize phone number
    const phone = customerPhone.replace(/\D/g, '').slice(-10)
    if (phone.length !== 10) {
      console.error('Invalid phone number:', customerPhone)
      return new Response(
        JSON.stringify({ error: 'Invalid phone number' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create payment link using Cashfree Payment Links API
    const linkId = `COD_${orderId}_${Date.now()}`.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 50)

    const linkPayload = {
      link_id: linkId,
      link_amount: Number(amount),
      link_currency: 'INR',
      link_purpose: `CollegeCart COD Order ${orderId}`,
      customer_details: {
        customer_name: customerName.slice(0, 50),
        customer_phone: phone,
        customer_email: customerEmail || 'customer@collegecart.in'
      },
      link_notify: {
        send_sms: false,
        send_email: false
      },
      link_meta: {
        return_url: 'https://shop.collegecarts.in/delivery'
      }
    }

    console.log('Creating Cashfree payment link:', { linkId, amount, phone: '***' })

    const response = await fetch('https://api.cashfree.com/pg/links', {
      method: 'POST',
      headers: {
        'x-api-version': '2023-08-01',
        'x-client-id': APP_ID,
        'x-client-secret': SECRET_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(linkPayload)
    })

    const responseText = await response.text()
    console.log('Cashfree response status:', response.status)
    console.log('Cashfree response:', responseText)

    if (!response.ok) {
      console.error('Cashfree API error:', responseText)
      return new Response(
        JSON.stringify({ error: 'Failed to create payment link', details: responseText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const linkData = JSON.parse(responseText)

    if (!linkData?.link_url) {
      console.error('No link_url in response:', linkData)
      return new Response(
        JSON.stringify({ error: 'Invalid response from payment gateway' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Payment link created successfully:', linkData.link_id)

    return new Response(
      JSON.stringify({ 
        paymentLink: linkData.link_url, 
        linkId: linkData.link_id 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Function error:', error.message, error.stack)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})