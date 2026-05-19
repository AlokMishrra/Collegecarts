/**
 * useRealtimeStock Hook
 * 
 * Subscribes to realtime stock updates from Supabase
 * Automatically invalidates cache and triggers re-fetch when stock changes
 */

import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * Subscribe to realtime stock updates
 * @param {Function} onStockChange - Callback when stock changes
 * @param {Object} options - Configuration options
 * @param {number} options.debounceMs - Debounce time in milliseconds (default: 2000)
 * @param {boolean} options.enabled - Enable/disable subscription (default: true)
 * @returns {Object} - Subscription status and controls
 */
export function useRealtimeStock(onStockChange, options = {}) {
  const {
    debounceMs = 2000,
    enabled = true
  } = options;

  const channelRef = useRef(null);
  const timeoutRef = useRef(null);
  const isSubscribedRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      console.log('[useRealtimeStock] Subscription disabled');
      return;
    }

    console.log('[useRealtimeStock] Setting up realtime subscription...');

    // Create channel
    const channel = supabase
      .channel('hostel_stock_changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'hostel_stock'
        },
        (payload) => {
          console.log('[useRealtimeStock] ⚡ Stock changed!', {
            event: payload.eventType,
            product_id: payload.new?.product_id || payload.old?.product_id,
            old_stock: payload.old?.stock_quantity,
            new_stock: payload.new?.stock_quantity
          });

          // Debounce callback to prevent excessive reloads
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
          }

          timeoutRef.current = setTimeout(() => {
            console.log('[useRealtimeStock] Triggering stock change callback');
            onStockChange?.(payload);
          }, debounceMs);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[useRealtimeStock] ✅ Subscribed to stock updates');
          isSubscribedRef.current = true;
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[useRealtimeStock] ❌ Subscription error');
          isSubscribedRef.current = false;
        } else if (status === 'TIMED_OUT') {
          console.error('[useRealtimeStock] ⏱️  Subscription timed out');
          isSubscribedRef.current = false;
        } else {
          console.log('[useRealtimeStock] Subscription status:', status);
        }
      });

    channelRef.current = channel;

    // Cleanup
    return () => {
      console.log('[useRealtimeStock] Cleaning up subscription');
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }

      isSubscribedRef.current = false;
    };
  }, [enabled, debounceMs, onStockChange]);

  return {
    isSubscribed: isSubscribedRef.current,
    channel: channelRef.current
  };
}

/**
 * Subscribe to specific product stock updates
 * @param {string} productId - Product ID to watch
 * @param {Function} onStockChange - Callback when this product's stock changes
 * @param {Object} options - Configuration options
 */
export function useProductStockUpdates(productId, onStockChange, options = {}) {
  const {
    debounceMs = 1000,
    enabled = true
  } = options;

  useEffect(() => {
    if (!enabled || !productId) {
      return;
    }

    console.log('[useProductStockUpdates] Watching product:', productId);

    let timeoutRef = null;

    const channel = supabase
      .channel(`product_stock_${productId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'hostel_stock',
          filter: `product_id=eq.${productId}`
        },
        (payload) => {
          console.log('[useProductStockUpdates] ⚡ Product stock changed!', {
            product_id: productId,
            old_stock: payload.old?.stock_quantity,
            new_stock: payload.new?.stock_quantity
          });

          if (timeoutRef) {
            clearTimeout(timeoutRef);
          }

          timeoutRef = setTimeout(() => {
            onStockChange?.(payload);
          }, debounceMs);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[useProductStockUpdates] ✅ Watching product:', productId);
        }
      });

    return () => {
      if (timeoutRef) {
        clearTimeout(timeoutRef);
      }
      supabase.removeChannel(channel);
    };
  }, [productId, enabled, debounceMs, onStockChange]);
}

/**
 * Subscribe to products table updates (for total stock changes)
 * @param {Function} onStockChange - Callback when products table changes
 * @param {Object} options - Configuration options
 */
export function useProductsTableUpdates(onStockChange, options = {}) {
  const {
    debounceMs = 2000,
    enabled = true
  } = options;

  useEffect(() => {
    if (!enabled) {
      return;
    }

    console.log('[useProductsTableUpdates] Setting up products table subscription...');

    let timeoutRef = null;

    const channel = supabase
      .channel('products_changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'products'
        },
        (payload) => {
          // Only trigger if stock_quantity changed
          if (payload.old?.stock_quantity !== payload.new?.stock_quantity) {
            console.log('[useProductsTableUpdates] ⚡ Product stock changed!', {
              product_id: payload.new?.id,
              old_stock: payload.old?.stock_quantity,
              new_stock: payload.new?.stock_quantity
            });

            if (timeoutRef) {
              clearTimeout(timeoutRef);
            }

            timeoutRef = setTimeout(() => {
              onStockChange?.(payload);
            }, debounceMs);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[useProductsTableUpdates] ✅ Subscribed to products table');
        }
      });

    return () => {
      if (timeoutRef) {
        clearTimeout(timeoutRef);
      }
      supabase.removeChannel(channel);
    };
  }, [enabled, debounceMs, onStockChange]);
}
