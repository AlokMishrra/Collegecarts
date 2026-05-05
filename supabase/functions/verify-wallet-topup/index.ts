import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  const { partnerId } = await req.json()

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data: partner } = await supabase
    .from('delivery_persons')
    .select('pending_topup_link_id')
    .eq('id', partnerId)
    .single()

  if (!partner?.pending_topup_link_id) {
    return new Response(
      JSON.stringify({ paid: false }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const BASE_URL = Deno.env.get('CASHFREE_ENV') === 'production'
    ? 'https://api.cashfree.com'
    : 'https://sandbox.cashfree.com'

  const statusRes = await fetch(`${BASE_URL}/pg/links/${partner.pending_topup_link_id}`, {
    headers: {
      'x-api-version': '2023-08-01',
      'x-client-id': Deno.env.get('CASHFREE_CLIENT_ID')!,
      'x-client-secret': Deno.env.get('CASHFREE_CLIENT_SECRET')!
    }
  })

  const statusData = await statusRes.json()
  const isPaid = statusData?.link_status === 'PAID'

  if (isPaid) {
    // Clear the pending link reference
    await supabase.from('delivery_persons')
      .update({ pending_topup_link_id: null })
      .eq('id', partnerId)
  }

  return new Response(
    JSON.stringify({ paid: isPaid, paymentId: partner.pending_topup_link_id }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
})
