/**
 * Stock Service
 * 
 * Centralized service for all stock-related operations
 * Provides a single source of truth for stock management
 */

import { supabase } from '@/lib/supabase';
import { enrichProductsWithHostelStock, getProductHostelStock } from '@/utils/hostelStockHelper';

/**
 * Stock Service Class
 */
class StockService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 5000; // 5 seconds cache
  }

  /**
   * Clear all cached stock data
   */
  clearCache() {
    console.log('[StockService] Clearing cache');
    this.cache.clear();
  }

  /**
   * Get cache key for product + hostel
   */
  getCacheKey(productId, hostelName) {
    return `${productId}:${hostelName}`;
  }

  /**
   * Check if product has sufficient stock
   * @param {string} productId - Product UUID
   * @param {string} hostelName - Hostel name
   * @param {number} quantity - Requested quantity
   * @returns {Promise<boolean>} - True if stock available
   */
  async checkStock(productId, hostelName, quantity = 1) {
    try {
      const { data, error } = await supabase.rpc('check_product_stock', {
        p_product_id: productId,
        p_hostel_name: hostelName,
        p_quantity: quantity
      });

      if (error) {
        console.error('[StockService] Error checking stock:', error);
        return false;
      }

      return data === true;
    } catch (error) {
      console.error('[StockService] Exception checking stock:', error);
      return false;
    }
  }

  /**
   * Get current stock for a product (with short-lived cache)
   * @param {string} productId - Product UUID
   * @param {string} hostelName - Hostel name
   * @param {boolean} skipCache - Skip cache and fetch fresh
   * @returns {Promise<number>} - Current stock quantity
   */
  async getStock(productId, hostelName, skipCache = false) {
    const cacheKey = this.getCacheKey(productId, hostelName);

    // Check cache
    if (!skipCache && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        console.log('[StockService] Returning cached stock:', cached.stock);
        return cached.stock;
      }
    }

    // Fetch fresh stock
    try {
      const stock = await getProductHostelStock(productId, hostelName);
      
      // Update cache
      this.cache.set(cacheKey, {
        stock,
        timestamp: Date.now()
      });

      return stock;
    } catch (error) {
      console.error('[StockService] Error getting stock:', error);
      return 0;
    }
  }

  /**
   * Enrich products with hostel-specific stock
   * @param {Array} products - Array of product objects
   * @param {string} hostelName - Hostel name
   * @returns {Promise<Array>} - Products with hostel_stock_quantity
   */
  async enrichProducts(products, hostelName) {
    return enrichProductsWithHostelStock(products, hostelName);
  }

  /**
   * Validate cart items have sufficient stock
   * @param {string} userId - User UUID
   * @param {string} hostelName - Hostel name
   * @returns {Promise<Object>} - Validation result
   */
  async validateCart(userId, hostelName) {
    try {
      const { data, error } = await supabase.rpc('validate_cart_stock', {
        p_user_id: userId,
        p_hostel_name: hostelName
      });

      if (error) {
        console.error('[StockService] Error validating cart:', error);
        return { valid: false, outOfStock: [], error: error.message };
      }

      const outOfStock = data || [];
      return {
        valid: outOfStock.length === 0,
        outOfStock
      };
    } catch (error) {
      console.error('[StockService] Exception validating cart:', error);
      return { valid: false, outOfStock: [], error: error.message };
    }
  }

  /**
   * Reserve stock for an order (atomic operation)
   * @param {Array} items - Array of {product_id, quantity}
   * @param {string} hostelName - Hostel name
   * @returns {Promise<Object>} - Reservation result
   */
  async reserveStockForOrder(items, hostelName) {
    const results = [];
    const failed = [];

    for (const item of items) {
      try {
        const { data, error } = await supabase.rpc('reserve_stock', {
          p_product_id: item.product_id,
          p_hostel_name: hostelName,
          p_quantity: item.quantity
        });

        if (error || data !== true) {
          failed.push({
            product_id: item.product_id,
            quantity: item.quantity,
            error: error?.message || 'Insufficient stock'
          });
        } else {
          results.push({
            product_id: item.product_id,
            quantity: item.quantity,
            reserved: true
          });
        }
      } catch (error) {
        failed.push({
          product_id: item.product_id,
          quantity: item.quantity,
          error: error.message
        });
      }
    }

    // If any reservation failed, rollback all
    if (failed.length > 0) {
      console.error('[StockService] Reservation failed, rolling back:', failed);
      await this.releaseStockForOrder(results, hostelName);
      return {
        success: false,
        failed,
        message: 'Some items are out of stock'
      };
    }

    return {
      success: true,
      reserved: results
    };
  }

  /**
   * Release reserved stock (e.g., cancelled order)
   * @param {Array} items - Array of {product_id, quantity}
   * @param {string} hostelName - Hostel name
   * @returns {Promise<boolean>} - True if all releases successful
   */
  async releaseStockForOrder(items, hostelName) {
    const results = [];

    for (const item of items) {
      try {
        const { data, error } = await supabase.rpc('release_stock', {
          p_product_id: item.product_id,
          p_hostel_name: hostelName,
          p_quantity: item.quantity
        });

        results.push({
          product_id: item.product_id,
          success: !error && data === true
        });
      } catch (error) {
        console.error('[StockService] Error releasing stock:', error);
        results.push({
          product_id: item.product_id,
          success: false
        });
      }
    }

    return results.every(r => r.success);
  }

  /**
   * Get low stock products (for admin alerts)
   * @param {number} threshold - Stock threshold
   * @returns {Promise<Array>} - Low stock products
   */
  async getLowStockProducts(threshold = 5) {
    try {
      const { data, error } = await supabase.rpc('get_low_stock_products', {
        p_threshold: threshold
      });

      if (error) {
        console.error('[StockService] Error getting low stock:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('[StockService] Exception getting low stock:', error);
      return [];
    }
  }

  /**
   * Check if product is in stock
   * @param {Object} product - Product object
   * @returns {boolean} - True if in stock
   */
  isInStock(product) {
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
   * @returns {number} - Stock quantity to display
   */
  getDisplayStock(product) {
    if (!product) return 0;

    // Use enriched hostel stock if available
    if (product.hostel_stock_quantity !== undefined) {
      return product.hostel_stock_quantity;
    }

    // Fallback to total stock
    return product.stock_quantity || 0;
  }

  /**
   * Subscribe to stock changes for a product
   * @param {string} productId - Product UUID
   * @param {Function} callback - Callback when stock changes
   * @returns {Function} - Unsubscribe function
   */
  subscribeToProduct(productId, callback) {
    const channel = supabase
      .channel(`stock_${productId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'hostel_stock',
          filter: `product_id=eq.${productId}`
        },
        (payload) => {
          console.log('[StockService] Stock changed for product:', productId);
          // Clear cache for this product
          this.cache.forEach((value, key) => {
            if (key.startsWith(productId)) {
              this.cache.delete(key);
            }
          });
          callback(payload);
        }
      )
      .subscribe();

    // Return unsubscribe function
    return () => {
      supabase.removeChannel(channel);
    };
  }
}

// Export singleton instance
export const stockService = new StockService();

// Export class for testing
export { StockService };
