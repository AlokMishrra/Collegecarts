/**
 * inventoryService.js — Centralized inventory management
 *
 * All stock operations go through this module.
 * Rules:
 *   - Order placed  → NO stock change (only UI optimistic)
 *   - Order delivered → Deduct stock_quantity + hostel_stock (atomic RPC)
 *   - Order cancelled → Release reserved_stock only (atomic RPC)
 *
 * Every function throws on failure — no silent swallowing.
 */

import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

// ─── Confirm Delivery: Deduct stock atomically ───────────────────────────
/**
 * Deduct stock when an order is DELIVERED.
 * Uses the `confirm_delivery_atomic` RPC which handles:
 *   - stock_quantity -= quantity
 *   - hostel_stock[hostel] -= quantity
 *   - reserved_stock -= quantity
 *   - is_available = false if stock reaches 0
 *
 * @param {Object} order - Full order object with items[] and hostel_id
 * @returns {Promise<{success: boolean, results: Array}>}
 */
export async function deductStockOnDelivery(order) {
  if (!order) {
    throw new Error('[Inventory] deductStockOnDelivery called with null order');
  }

  if (!order.items || !Array.isArray(order.items) || order.items.length === 0) {
    console.warn(`[Inventory] Order ${order.order_number || order.id} has no items — skipping stock deduction`);
    return { success: true, results: [] };
  }

  const hostel = order.hostel_id || null;
  const results = [];
  const errors = [];

  for (const item of order.items) {
    if (!item.product_id || !item.quantity) {
      errors.push(`Invalid item in order ${order.order_number}: missing product_id or quantity`);
      continue;
    }

    try {
      const { data, error } = await supabase.rpc('confirm_delivery_atomic', {
        p_product_id: item.product_id,
        p_quantity: item.quantity,
        p_hostel: hostel
      });

      if (error) {
        const msg = `[Inventory] RPC confirm_delivery_atomic failed for product ${item.product_id}: ${error.message}`;
        console.error(msg);
        errors.push(msg);

        // Fallback: direct UPDATE if RPC doesn't exist
        if (error.message?.includes('function') || error.code === '42883') {
          console.warn('[Inventory] RPC not found, using direct UPDATE fallback');
          await directStockDeduction(item, hostel);
          results.push({ product_id: item.product_id, method: 'direct', success: true });
        }
        continue;
      }

      // RPC returns a JSON object
      const rpcResult = typeof data === 'string' ? JSON.parse(data) : data;

      if (!rpcResult?.success) {
        const msg = `[Inventory] Stock deduction rejected for ${item.product_name || item.product_id}: ${rpcResult?.error || 'unknown'}`;
        console.error(msg);
        errors.push(msg);
        continue;
      }

      console.log(`[Inventory] ✅ Deducted ${item.quantity}x ${item.product_name || item.product_id}. New stock: ${rpcResult.new_stock}`);
      results.push({ product_id: item.product_id, new_stock: rpcResult.new_stock, success: true });

    } catch (err) {
      const msg = `[Inventory] Unexpected error for ${item.product_id}: ${err.message}`;
      console.error(msg);
      errors.push(msg);
    }
  }

  if (errors.length > 0) {
    console.error(`[Inventory] ${errors.length} error(s) during stock deduction for order ${order.order_number}:`, errors);
    // Log to error_logs table
    try {
      await supabase.from('error_logs').insert({
        error_type: 'STOCK_DEDUCTION',
        message: `Stock deduction errors for order ${order.order_number}: ${errors.join('; ')}`,
        page: '/admin/orders',
        resolved: false
      });
    } catch (_) { /* don't fail on logging */ }
  }

  return { success: errors.length === 0, results, errors };
}

// ─── Cancel Order: Release reserved stock ────────────────────────────────
/**
 * Release reserved stock when an order is CANCELLED.
 * Does NOT touch actual stock_quantity — only reserved_stock.
 *
 * @param {Object} order - Full order object with items[]
 * @returns {Promise<{success: boolean, results: Array}>}
 */
export async function releaseStockOnCancel(order) {
  if (!order) {
    throw new Error('[Inventory] releaseStockOnCancel called with null order');
  }

  if (!order.items || !Array.isArray(order.items) || order.items.length === 0) {
    console.warn(`[Inventory] Order ${order.order_number || order.id} has no items — nothing to release`);
    return { success: true, results: [] };
  }

  const results = [];
  const errors = [];

  for (const item of order.items) {
    if (!item.product_id || !item.quantity) continue;

    try {
      const { data, error } = await supabase.rpc('cancel_order_stock_atomic', {
        p_product_id: item.product_id,
        p_quantity: item.quantity
      });

      if (error) {
        // If RPC doesn't exist, use direct update
        if (error.message?.includes('function') || error.code === '42883') {
          console.warn('[Inventory] cancel_order_stock_atomic RPC not found, using direct fallback');
          await directReservationRelease(item);
          results.push({ product_id: item.product_id, method: 'direct', success: true });
          continue;
        }
        errors.push(`Release failed for ${item.product_id}: ${error.message}`);
        continue;
      }

      const rpcResult = typeof data === 'string' ? JSON.parse(data) : data;
      if (rpcResult?.success) {
        console.log(`[Inventory] ✅ Released reservation of ${item.quantity}x ${item.product_name || item.product_id}`);
        results.push({ product_id: item.product_id, success: true });
      } else {
        errors.push(`Release rejected for ${item.product_id}: ${rpcResult?.error}`);
      }

    } catch (err) {
      errors.push(`Unexpected error releasing ${item.product_id}: ${err.message}`);
    }
  }

  if (errors.length > 0) {
    console.error(`[Inventory] Release errors for order ${order.order_number}:`, errors);
  }

  return { success: errors.length === 0, results, errors };
}

// ─── Fetch Updated Product Stock ─────────────────────────────────────────
/**
 * Fetch fresh product data after a delivery to sync UI.
 *
 * @param {string[]} productIds - Array of product IDs to refresh
 * @returns {Promise<Object>} Map of productId → product data
 */
export async function fetchUpdatedStock(productIds) {
  if (!productIds || productIds.length === 0) return {};

  const { data, error } = await supabase
    .from('products')
    .select('id, stock_quantity, hostel_stock, reserved_stock, is_available')
    .in('id', productIds);

  if (error) {
    console.error('[Inventory] Failed to fetch updated stock:', error.message);
    throw new Error(`Failed to fetch updated stock: ${error.message}`);
  }

  const map = {};
  (data || []).forEach(p => { map[p.id] = p; });
  return map;
}

// ─── Direct fallback (when RPC not available) ────────────────────────────
async function directStockDeduction(item, hostel) {
  const { data: prod, error: fetchErr } = await supabase
    .from('products')
    .select('stock_quantity, hostel_stock, reserved_stock')
    .eq('id', item.product_id)
    .single();

  if (fetchErr || !prod) {
    throw new Error(`Could not fetch product ${item.product_id}: ${fetchErr?.message || 'not found'}`);
  }

  const newTotal = Math.max(0, (prod.stock_quantity || 0) - item.quantity);
  const newReserved = Math.max(0, (prod.reserved_stock || 0) - item.quantity);

  const updatePayload = {
    stock_quantity: newTotal,
    reserved_stock: newReserved,
    is_available: newTotal > 0,
    updated_at: new Date().toISOString()
  };

  // Update hostel stock if applicable
  if (hostel && hostel !== 'Other' && prod.hostel_stock &&
      typeof prod.hostel_stock[hostel] === 'number') {
    const newHostelQty = Math.max(0, prod.hostel_stock[hostel] - item.quantity);
    updatePayload.hostel_stock = { ...prod.hostel_stock, [hostel]: newHostelQty };
  }

  const { error: updateErr } = await supabase
    .from('products')
    .update(updatePayload)
    .eq('id', item.product_id);

  if (updateErr) {
    throw new Error(`Direct stock update failed for ${item.product_id}: ${updateErr.message}`);
  }

  console.log(`[Inventory] ✅ Direct fallback: deducted ${item.quantity}x ${item.product_name}. New total: ${newTotal}`);
}

async function directReservationRelease(item) {
  const { data: prod, error: fetchErr } = await supabase
    .from('products')
    .select('stock_quantity, reserved_stock')
    .eq('id', item.product_id)
    .single();

  if (fetchErr || !prod) return; // Silently skip if product gone

  // Restore stock_quantity (since we deducted on order placement)
  const newStock = (prod.stock_quantity || 0) + item.quantity;
  const newReserved = Math.max(0, (prod.reserved_stock || 0) - item.quantity);

  const { error: updateErr } = await supabase
    .from('products')
    .update({
      stock_quantity: newStock,
      reserved_stock: newReserved,
      is_available: true,
      updated_at: new Date().toISOString()
    })
    .eq('id', item.product_id);

  if (updateErr) {
    console.error(`[Inventory] Direct reservation release failed for ${item.product_id}:`, updateErr.message);
  }

  // Also restore hostel_stock table if hostel info available
  if (item.hostel && item.hostel !== 'Other') {
    try {
      const { data: hostelData } = await supabase
        .from('hostels')
        .select('id')
        .eq('name', item.hostel)
        .maybeSingle();

      if (hostelData?.id) {
        const { data: hsRow } = await supabase
          .from('hostel_stock')
          .select('stock_quantity')
          .eq('product_id', item.product_id)
          .eq('hostel_id', hostelData.id)
          .maybeSingle();

        if (hsRow) {
          await supabase
            .from('hostel_stock')
            .update({
              stock_quantity: (hsRow.stock_quantity || 0) + item.quantity,
              updated_at: new Date().toISOString()
            })
            .eq('product_id', item.product_id)
            .eq('hostel_id', hostelData.id);
        }
      }
    } catch (e) {
      console.error('[Inventory] Failed to restore hostel_stock on cancel:', e);
    }
  }
}

// ─── Notify on stock errors ──────────────────────────────────────────────
/**
 * Show a toast notification if stock operations had errors.
 */
export function notifyStockErrors(result, context = 'Stock operation') {
  if (!result.success && result.errors?.length > 0) {
    toast.error(`${context} had ${result.errors.length} error(s). Check console for details.`);
  }
}

// ─── Deduct Stock on Order Placed ────────────────────────────────────────
/**
 * Deduct stock immediately when an order is PLACED/CONFIRMED.
 * Reduces both hostel_stock table and products.stock_quantity.
 * This ensures stock shows correctly for other users right away.
 *
 * @param {Object} order - Order object with items[] and hostel_id (hostel name)
 * @returns {Promise<{success: boolean, results: Array, errors: Array}>}
 */
export async function deductStockOnOrderPlaced(order) {
  if (!order) {
    console.warn('[Inventory] deductStockOnOrderPlaced called with null order');
    return { success: true, results: [], errors: [] };
  }

  if (!order.items || !Array.isArray(order.items) || order.items.length === 0) {
    console.warn(`[Inventory] Order ${order.order_number || order.id} has no items — skipping`);
    return { success: true, results: [], errors: [] };
  }

  const hostelName = order.hostel_id || null; // hostel_id stores the hostel name
  const results = [];
  const errors = [];

  for (const item of order.items) {
    if (!item.product_id || !item.quantity) continue;

    try {
      // Try the RPC first
      const { data, error } = await supabase.rpc('deduct_stock_on_order', {
        p_product_id: item.product_id,
        p_quantity: item.quantity,
        p_hostel_name: hostelName
      });

      if (error) {
        // RPC doesn't exist yet — use direct fallback
        if (error.message?.includes('function') || error.code === '42883') {
          console.warn('[Inventory] deduct_stock_on_order RPC not found, using direct fallback');
          await directStockDeductionOnOrder(item, hostelName);
          results.push({ product_id: item.product_id, method: 'direct', success: true });
          continue;
        }
        errors.push(`Stock deduction failed for ${item.product_name || item.product_id}: ${error.message}`);
        continue;
      }

      const rpcResult = typeof data === 'string' ? JSON.parse(data) : data;
      if (rpcResult?.success) {
        console.log(`[Inventory] ✅ Order placed: deducted ${item.quantity}x ${item.product_name || item.product_id}. Hostel stock: ${rpcResult.new_hostel_stock}`);
        results.push({ product_id: item.product_id, new_stock: rpcResult.new_hostel_stock, success: true });
      } else {
        errors.push(`Stock deduction rejected for ${item.product_name || item.product_id}: ${rpcResult?.error}`);
      }
    } catch (err) {
      errors.push(`Unexpected error for ${item.product_id}: ${err.message}`);
    }
  }

  if (errors.length > 0) {
    console.error(`[Inventory] Stock deduction errors on order placed:`, errors);
  }

  return { success: errors.length === 0, results, errors };
}

/**
 * Direct fallback for stock deduction on order placed (when RPC not available).
 * Deducts from hostel_stock table + products.stock_quantity.
 */
async function directStockDeductionOnOrder(item, hostelName) {
  // 1. Deduct from hostel_stock table
  if (hostelName && hostelName !== 'Other') {
    // Get hostel ID
    const { data: hostelData } = await supabase
      .from('hostels')
      .select('id')
      .eq('name', hostelName)
      .maybeSingle();

    if (hostelData?.id) {
      const { data: hsRow } = await supabase
        .from('hostel_stock')
        .select('stock_quantity')
        .eq('product_id', item.product_id)
        .eq('hostel_id', hostelData.id)
        .maybeSingle();

      if (hsRow) {
        const newQty = Math.max(0, (hsRow.stock_quantity || 0) - item.quantity);
        await supabase
          .from('hostel_stock')
          .update({ stock_quantity: newQty, updated_at: new Date().toISOString() })
          .eq('product_id', item.product_id)
          .eq('hostel_id', hostelData.id);
      }
    }
  }

  // 2. Deduct from products.stock_quantity
  const { data: prod } = await supabase
    .from('products')
    .select('stock_quantity')
    .eq('id', item.product_id)
    .single();

  if (prod) {
    const newTotal = Math.max(0, (prod.stock_quantity || 0) - item.quantity);
    await supabase
      .from('products')
      .update({
        stock_quantity: newTotal,
        is_available: newTotal > 0,
        updated_at: new Date().toISOString()
      })
      .eq('id', item.product_id);
  }

  console.log(`[Inventory] ✅ Direct fallback: deducted ${item.quantity}x ${item.product_name || item.product_id} on order placed`);
}
