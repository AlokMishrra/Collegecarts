import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const now = new Date().toISOString()

  // Find all scheduled orders whose time has arrived
  const { data: dueOrders, error } = await supabase
    .from('orders')
    .select('id, scheduled_time, user_id, order_number')
    .eq('status', 'scheduled')
    .lte('scheduled_time', now)

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  if (!dueOrders || dueOrders.length === 0) {
    return new Response(JSON.stringify({ released: 0 }), { status: 200 })
  }

  // Release each due order into the assignment queue
  const releaseResults = await Promise.all(
    dueOrders.map(order =>
      supabase
        .from('orders')
        .update({
          status: 'confirmed',
          is_scheduled: false,
          released_at: now
        })
        .eq('id', order.id)
    )
  )

  const released = releaseResults.filter(r => !r.error).length

  // Notify users their scheduled orders are now being processed
  await Promise.all(
    dueOrders.map(order =>
      supabase.from('notifications').insert({
        user_id: order.user_id,
        title: 'Scheduled Order Released!',
        message: `Your scheduled order #${order.order_number} is now being assigned to a delivery partner.`,
        type: 'info',
        created_at: now
      })
    )
  )

  return new Response(
    JSON.stringify({ released, total: dueOrders.length }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
})
