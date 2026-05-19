/**
 * useStockValidation Hook
 * 
 * Provides stock validation utilities for cart and checkout
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

/**
 * Hook for validating stock before operations
 * @returns {Object} - Validation functions and state
 */
export function useStockValidation() {
  const [isValidating, setIsValidating] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);

  /**
   * Check if a product has sufficient stock
   * @param {string} productId - Product UUID
   * @param {string} hostelName - Hostel name
   * @param {number} quantity - Requested quantity
   * @returns {Promise<boolean>} - True if stock available
   */
  const checkStock = useCallback(async (productId, hostelName, quantity = 1) => {
    try {
      const { data, error } = await supabase.rpc('check_product_stock', {
        p_product_id: productId,
        p_hostel_name: hostelName,
        p_quantity: quantity
      });

      if (error) {
        console.error('[useStockValidation] Error checking stock:', error);
        return false;
      }

      return data === true;
    } catch (error) {
      console.error('[useStockValidation] Exception checking stock:', error);
      return false;
    }
  }, []);

  /**
   * Get current stock for a product
   * @param {string} productId - Product UUID
   * @param {string} hostelName - Hostel name
   * @returns {Promise<number>} - Current stock quantity
   */
  const getStock = useCallback(async (productId, hostelName) => {
    try {
      const { data, error } = await supabase.rpc('get_product_hostel_stock', {
        p_product_id: productId,
        p_hostel_name: hostelName
      });

      if (error) {
        console.error('[useStockValidation] Error getting stock:', error);
        return 0;
      }

      return data || 0;
    } catch (error) {
      console.error('[useStockValidation] Exception getting stock:', error);
      return 0;
    }
  }, []);

  /**
   * Validate all items in user's cart
   * @param {string} userId - User UUID
   * @param {string} hostelName - Hostel name
   * @returns {Promise<Object>} - Validation result with out-of-stock items
   */
  const validateCart = useCallback(async (userId, hostelName) => {
    setIsValidating(true);
    setValidationErrors([]);

    try {
      const { data, error } = await supabase.rpc('validate_cart_stock', {
        p_user_id: userId,
        p_hostel_name: hostelName
      });

      if (error) {
        console.error('[useStockValidation] Error validating cart:', error);
        setValidationErrors([{ message: 'Failed to validate cart' }]);
        return { valid: false, outOfStock: [] };
      }

      const outOfStock = data || [];
      
      if (outOfStock.length > 0) {
        setValidationErrors(outOfStock);
        return { valid: false, outOfStock };
      }

      return { valid: true, outOfStock: [] };
    } catch (error) {
      console.error('[useStockValidation] Exception validating cart:', error);
      setValidationErrors([{ message: 'Failed to validate cart' }]);
      return { valid: false, outOfStock: [] };
    } finally {
      setIsValidating(false);
    }
  }, []);

  /**
   * Validate cart and show toast messages
   * @param {string} userId - User UUID
   * @param {string} hostelName - Hostel name
   * @returns {Promise<boolean>} - True if cart is valid
   */
  const validateCartWithToast = useCallback(async (userId, hostelName) => {
    const result = await validateCart(userId, hostelName);

    if (!result.valid && result.outOfStock.length > 0) {
      // Show toast for each out-of-stock item
      result.outOfStock.forEach(item => {
        toast.error(
          `${item.product_name} is out of stock`,
          {
            description: `Requested: ${item.requested_quantity}, Available: ${item.available_stock}`
          }
        );
      });
      return false;
    }

    return true;
  }, [validateCart]);

  /**
   * Reserve stock for an order (atomic operation)
   * @param {string} productId - Product UUID
   * @param {string} hostelName - Hostel name
   * @param {number} quantity - Quantity to reserve
   * @returns {Promise<boolean>} - True if reservation successful
   */
  const reserveStock = useCallback(async (productId, hostelName, quantity) => {
    try {
      const { data, error } = await supabase.rpc('reserve_stock', {
        p_product_id: productId,
        p_hostel_name: hostelName,
        p_quantity: quantity
      });

      if (error) {
        console.error('[useStockValidation] Error reserving stock:', error);
        return false;
      }

      return data === true;
    } catch (error) {
      console.error('[useStockValidation] Exception reserving stock:', error);
      return false;
    }
  }, []);

  /**
   * Release reserved stock (e.g., cancelled order)
   * @param {string} productId - Product UUID
   * @param {string} hostelName - Hostel name
   * @param {number} quantity - Quantity to release
   * @returns {Promise<boolean>} - True if release successful
   */
  const releaseStock = useCallback(async (productId, hostelName, quantity) => {
    try {
      const { data, error } = await supabase.rpc('release_stock', {
        p_product_id: productId,
        p_hostel_name: hostelName,
        p_quantity: quantity
      });

      if (error) {
        console.error('[useStockValidation] Error releasing stock:', error);
        return false;
      }

      return data === true;
    } catch (error) {
      console.error('[useStockValidation] Exception releasing stock:', error);
      return false;
    }
  }, []);

  /**
   * Get low stock products (for admin alerts)
   * @param {number} threshold - Stock threshold (default: 5)
   * @returns {Promise<Array>} - Array of low stock products
   */
  const getLowStockProducts = useCallback(async (threshold = 5) => {
    try {
      const { data, error } = await supabase.rpc('get_low_stock_products', {
        p_threshold: threshold
      });

      if (error) {
        console.error('[useStockValidation] Error getting low stock:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('[useStockValidation] Exception getting low stock:', error);
      return [];
    }
  }, []);

  return {
    // State
    isValidating,
    validationErrors,
    
    // Functions
    checkStock,
    getStock,
    validateCart,
    validateCartWithToast,
    reserveStock,
    releaseStock,
    getLowStockProducts
  };
}

/**
 * Simple hook to check if a product is in stock
 * @param {Object} product - Product object
 * @param {string} hostelName - Hostel name
 * @returns {boolean} - True if in stock
 */
export function useIsInStock(product, hostelName) {
  if (!product) return false;

  // Use enriched hostel stock if available
  if (product.hostel_stock_quantity !== undefined) {
    return product.hostel_stock_quantity > 0;
  }

  // Fallback to total stock
  return (product.stock_quantity || 0) > 0;
}

/**
 * Get display stock for a product
 * @param {Object} product - Product object
 * @param {string} hostelName - Hostel name
 * @returns {number} - Stock quantity to display
 */
export function useDisplayStock(product, hostelName) {
  if (!product) return 0;

  // Use enriched hostel stock if available
  if (product.hostel_stock_quantity !== undefined) {
    return product.hostel_stock_quantity;
  }

  // Fallback to total stock
  return product.stock_quantity || 0;
}
