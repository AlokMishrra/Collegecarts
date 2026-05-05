import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()

  // Get unassigned confirmed orders from last 10 minutes
  const { data: unassignedOrders } = await supabase
    .from('orders')
    .select('id, delivery_address, created_at, total_amount, user_id, order_number')
    .eq('status', 'confirmed')
    .is('delivery_person_id', null)
    .gte('created_at', tenMinutesAgo)

  if (!unassignedOrders || unassignedOrders.length === 0) {
    return new Response(JSON.stringify({ batched: 0 }), { status: 200 })
  }

  // Group by hostel (extracted from delivery_address)
  const byHostel = unassignedOrders.reduce((acc: Record<string, typeof unassignedOrders>, order) => {
    // Extract hostel from address like "ABC Hostel, Room No: 101"
    const hostelMatch = order.delivery_address?.match(/^([^,]+)\s+Hostel/i)
    const key = hostelMatch ? hostelMatch[1].trim() : 'unknown'
    if (!acc[key]) acc[key] = []
    acc[key].push(order)
    return acc
  }, {})

  const results = []

  for (const [hostelId, orders] of Object.entries(byHostel)) {
    // Find best available delivery partner for this hostel
    const { data: partners } = await supabase
      .from('delivery_persons')
      .select('id, current_orders')
      .eq('is_available', true)
      .or(`assigned_hostel.eq.${hostelId},assigned_hostel.eq.All`)
      .order('id', { ascending: true })
      .limit(1)

    if (!partners || partners.length === 0) {
      results.push({ hostelId, status: 'no_partner', count: orders.length })
      continue
    }

    const partner = partners[0]

    // Assign all orders in this hostel to the partner
    const assignResults = await Promise.all(
      (orders as typeof unassignedOrders).map(order =>
        supabase
          .from('orders')
          .update({
            delivery_person_id: partner.id,
            status: 'preparing',
            assigned_at: new Date().toISOString()
          })
          .eq('id', order.id)
          .eq('status', 'confirmed')       // prevent race condition
          .is('delivery_person_id', null)  // prevent double assignment
      )
    )

    const assigned = assignResults.filter(r => !r.error).length
    results.push({ hostelId, partnerId: partner.id, assigned })
  }

  // Alert admin if any order unassigned for > 10 minutes
  const { data: stalledOrders } = await supabase
    .from('orders')
    .select('id, created_at, delivery_address')
    .eq('status', 'confirmed')
    .is('delivery_person_id', null)
    .lt('created_at', tenMinutesAgo)

  if (stalledOrders && stalledOrders.length > 0) {
    await supabase.from('admin_alerts').insert({
      type: 'unassigned_orders',
      message: `${stalledOrders.length} order(s) unassigned for > 10 minutes`,
      data: JSON.stringify(stalledOrders.map(o => o.id)),
      created_at: new Date().toISOString(),
      resolved: false
    })
  }

  return new Response(
    JSON.stringify({ results }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
})
