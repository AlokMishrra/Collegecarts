import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  const { orderId } = await req.json()

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data: order } = await supabase
    .from('orders')
    .select('cod_link_id')
    .eq('id', orderId)
    .single()

  if (!order?.cod_link_id) {
    return new Response(
      JSON.stringify({ paid: false }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const BASE_URL = Deno.env.get('CASHFREE_ENV') === 'production'
    ? 'https://api.cashfree.com'
    : 'https://sandbox.cashfree.com'

  const statusRes = await fetch(`${BASE_URL}/pg/links/${order.cod_link_id}`, {
    headers: {
      'x-api-version': '2023-08-01',
      'x-client-id': Deno.env.get('CASHFREE_CLIENT_ID')!,
      'x-client-secret': Deno.env.get('CASHFREE_CLIENT_SECRET')!
    }
  })

  const statusData = await statusRes.json()
  const isPaid = statusData?.link_status === 'PAID'

  if (isPaid) {
    await supabase.from('orders')
      .update({ cod_payment_status: 'completed' })
      .eq('id', orderId)
  }

  return new Response(
    JSON.stringify({ paid: isPaid, paymentId: statusData?.link_id }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
})
