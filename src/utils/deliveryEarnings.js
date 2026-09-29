/**
 * deliveryEarnings.js — the single source of truth for delivery-partner earnings.
 *
 * Why this exists
 * ---------------
 * `delivery_persons.total_earnings` and `.lifetime_earnings` are denormalised
 * counters that are incremented on the client every time a delivery completes.
 * They were never the real figure, and because `markOrderDelivered` could run
 * twice for one order (COD collection plus OTP verification), the same 10%
 * commission was written twice — into the counters *and* as a second
 * `wallet_transactions` row. 1,349 commission rows exist site-wide, 256 of them
 * duplicate credits for an order that was already paid, over-crediting partners
 * by ₹2,760.
 *
 * The rule
 * --------
 * `wallet_transactions` is the append-only record of what was actually paid out.
 * A partner is paid once per delivery, so the earnings figure is the sum of
 * `delivery_earning` rows counted ONCE PER ORDER. Never read the counters for a
 * displayed amount; use this module.
 *
 * Dedupe is by `order_id` when present, falling back to the order number parsed
 * out of the description, which is how rows written before `order_id` was
 * populated are still matched.
 */

import { supabase } from "@/lib/supabase";

/** Order key for a commission row, or null when it cannot be identified. */
export function commissionOrderKey(row) {
  if (row.order_id) return `id:${row.order_id}`;
  const match = /#(\S+)/.exec(row.description || "");
  return match ? `no:${match[1]}` : null;
}

/**
 * Pure calculation — given commission rows, return the earnings total with each
 * order counted once. Exported so it can be unit tested without a network call.
 */
export function totalEarningsFrom(rows) {
  const seen = new Set();
  let total = 0;
  for (const row of rows || []) {
    const key = commissionOrderKey(row);
    if (key) {
      if (seen.has(key)) continue;
      seen.add(key);
    }
    total += row.amount || 0;
  }
  return total;
}

/** Number of distinct deliveries represented by the given commission rows. */
export function deliveryCountFrom(rows) {
  const seen = new Set();
  let count = 0;
  for (const row of rows || []) {
    const key = commissionOrderKey(row);
    if (key) {
      if (seen.has(key)) continue;
      seen.add(key);
    }
    count += 1;
  }
  return count;
}

/**
 * Fetch every commission row for a partner and return
 * `{ totalEarnings, deliveryCount, totalOrders, duplicateRows }`.
 * `duplicateRows` is the count of surplus credits that should be reconciled.
 */
export async function getEarningsSummary(deliveryPersonId) {
  const { data, error } = await supabase
    .from("wallet_transactions")
    .select("amount, description, order_id, created_at")
    .eq("delivery_person_id", deliveryPersonId)
    .eq("type", "delivery_earning")
    .order("created_at", { ascending: true });

  if (error) throw error;

  const rows = data || [];
  const seen = new Set();
  let duplicateRows = 0;
  for (const row of rows) {
    const key = commissionOrderKey(row);
    if (key && seen.has(key)) duplicateRows += 1;
    else if (key) seen.add(key);
  }

  return {
    totalEarnings: totalEarningsFrom(rows),
    deliveryCount: deliveryCountFrom(rows),
    totalOrders: rows.length,
    duplicateRows,
  };
}
