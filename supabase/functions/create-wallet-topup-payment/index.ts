import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  const { partnerId, amount, purpose } = await req.json()

  const CLIENT_ID = Deno.env.get('CASHFREE_CLIENT_ID')!
  const CLIENT_SECRET = Deno.env.get('CASHFREE_CLIENT_SECRET')!
  const BASE_URL = Deno.env.get('CASHFREE_ENV') === 'production'
    ? 'https://api.cashfree.com'
    : 'https://sandbox.cashfree.com'

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data: partner } = await supabase
    .from('delivery_persons')
    .select('name, phone, email')
    .eq('id', partnerId)
    .single()

  const linkId = `WALLET-${partnerId}-${Date.now()}`

  const linkRes = await fetch(`${BASE_URL}/pg/links`, {
    method: 'POST',
    headers: {
      'x-api-version': '2023-08-01',
      'x-client-id': CLIENT_ID,
      'x-client-secret': CLIENT_SECRET,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      link_id: linkId,
      link_amount: amount,
      link_currency: 'INR',
      link_purpose: purpose || 'CollegeCart Wallet Top-up',
      customer_details: {
        customer_name: partner?.name || 'Delivery Partner',
        customer_phone: partner?.phone || '9999999999',
        customer_email: partner?.email || 'partner@collegecart.in'
      },
      link_notify: { send_sms: true, send_email: false }
    })
  })

  const linkData = await linkRes.json()

  if (!linkData?.link_url) {
    return new Response(
      JSON.stringify({ error: 'Failed to create payment link' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Store pending topup reference
  await supabase.from('delivery_persons')
    .update({ pending_topup_link_id: linkId })
    .eq('id', partnerId)

  return new Response(
    JSON.stringify({ paymentLink: linkData.link_url, linkId }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
})
