import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * Hook to fetch and calculate checkout charges (small cart fee + handling fee)
 * Includes caching and realtime updates
 */
export function useCheckoutCharges(subtotal = 0) {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch settings from database
  useEffect(() => {
    let mounted = true;
    let subscription = null;

    const fetchSettings = async () => {
      try {
        setLoading(true);
        const { data, error: fetchError } = await supabase
          .from('checkout_settings')
          .select('*')
          .limit(1)
          .single();

        if (fetchError) throw fetchError;

        if (mounted) {
          setSettings(data);
          setError(null);
        }
      } catch (err) {
        console.error('Error fetching checkout settings:', err);
        if (mounted) {
          setError(err.message);
          // Fallback to default settings
          setSettings({
            small_cart_enabled: true,
            small_cart_threshold: 40,
            small_cart_fee: 10,
            handling_fee_enabled: true,
            handling_fee: 10
          });
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchSettings();

    // Subscribe to realtime changes
    subscription = supabase
      .channel('checkout_settings_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'checkout_settings'
        },
        (payload) => {
          if (mounted && payload.new) {
            setSettings(payload.new);
          }
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      if (subscription) {
        supabase.removeChannel(subscription);
      }
    };
  }, []);

  // Calculate charges based on subtotal (memoized for performance)
  const charges = useMemo(() => {
    if (!settings) {
      return {
        smallCartFee: 0,
        handlingFee: 0,
        totalFees: 0,
        shouldApplySmallCartFee: false,
        settings: null
      };
    }

    const shouldApplySmallCartFee = 
      settings.small_cart_enabled && 
      subtotal > 0 && 
      subtotal < settings.small_cart_threshold;

    const smallCartFee = shouldApplySmallCartFee ? settings.small_cart_fee : 0;
    const handlingFee = settings.handling_fee_enabled ? settings.handling_fee : 0;

    return {
      smallCartFee,
      handlingFee,
      totalFees: smallCartFee + handlingFee,
      shouldApplySmallCartFee,
      threshold: settings.small_cart_threshold,
      settings // Include full settings for access to free_delivery_handling
    };
  }, [settings, subtotal]);

  return {
    settings,
    charges,
    loading,
    error,
    // Helper methods
    isSmallCartFeeApplicable: charges.shouldApplySmallCartFee,
    isHandlingFeeEnabled: settings?.handling_fee_enabled || false,
    amountNeededForFreeSmallCartFee: charges.shouldApplySmallCartFee 
      ? Math.max(0, (settings?.small_cart_threshold || 0) - subtotal)
      : 0
  };
}

/**
 * Hook to update checkout settings (admin only)
 */
export function useUpdateCheckoutSettings() {
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState(null);

  const updateSettings = async (newSettings) => {
    try {
      setUpdating(true);
      setError(null);

      // Get the existing settings ID
      const { data: existing, error: fetchError } = await supabase
        .from('checkout_settings')
        .select('id')
        .limit(1)
        .single();

      if (fetchError) throw fetchError;

      // Update settings
      const { data, error: updateError } = await supabase
        .from('checkout_settings')
        .update(newSettings)
        .eq('id', existing.id)
        .select()
        .single();

      if (updateError) throw updateError;

      return { success: true, data };
    } catch (err) {
      console.error('Error updating checkout settings:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setUpdating(false);
    }
  };

  return {
    updateSettings,
    updating,
    error
  };
}
