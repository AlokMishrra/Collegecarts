/**
 * Cart Validation Service
 * 
 * Validates cart items before checkout
 * Ensures all items have sufficient stock
 */

import { CartItem } from '@/entities/CartItem';
import { Product } from '@/entities/Product';
import { stockService } from './stockService';
import { toast } from 'sonner';

/**
 * Cart Validation Service Class
 */
class CartValidationService {
  /**
   * Validate all items in cart have sufficient stock
   * @param {string} userId - User UUID
   * @param {string} hostelName - Hostel name
   * @returns {Promise<Object>} - Validation result
   */
  async validateCart(userId, hostelName) {
    console.log('[CartValidation] Validating cart for user:', userId, 'hostel:', hostelName);

    try {
      // Get cart items
      const cartItems = await CartItem.filter({ user_id: userId });
      
      if (cartItems.length === 0) {
        return {
          valid: true,
          items: [],
          outOfStock: [],
          insufficientStock: []
        };
      }

      // Get product details for all cart items
      const productIds = cartItems.map(item => item.product_id);
      const products = await Promise.all(
        productIds.map(id => 
          Product.filter({ id }).then(results => results[0]).catch(() => null)
        )
      );

      // Create product map
      const productMap = {};
      products.forEach(product => {
        if (product) {
          productMap[product.id] = product;
        }
      });

      // Enrich products with hostel stock
      const enrichedProducts = await stockService.enrichProducts(
        Object.values(productMap),
        hostelName
      );

      // Update product map with enriched data
      enrichedProducts.forEach(product => {
        productMap[product.id] = product;
      });

      // Validate each item
      const outOfStock = [];
      const insufficientStock = [];
      const validItems = [];

      for (const cartItem of cartItems) {
        const product = productMap[cartItem.product_id];
        
        if (!product) {
          console.warn('[CartValidation] Product not found:', cartItem.product_id);
          outOfStock.push({
            cartItemId: cartItem.id,
            productId: cartItem.product_id,
            productName: 'Unknown Product',
            requestedQuantity: cartItem.quantity,
            availableStock: 0,
            reason: 'Product not found'
          });
          continue;
        }

        const availableStock = stockService.getDisplayStock(product);
        
        if (availableStock === 0) {
          console.warn('[CartValidation] Out of stock:', product.name);
          outOfStock.push({
            cartItemId: cartItem.id,
            productId: product.id,
            productName: product.name,
            requestedQuantity: cartItem.quantity,
            availableStock: 0,
            reason: 'Out of stock'
          });
        } else if (availableStock < cartItem.quantity) {
          console.warn('[CartValidation] Insufficient stock:', product.name, 
            'requested:', cartItem.quantity, 'available:', availableStock);
          insufficientStock.push({
            cartItemId: cartItem.id,
            productId: product.id,
            productName: product.name,
            requestedQuantity: cartItem.quantity,
            availableStock,
            reason: 'Insufficient stock'
          });
        } else {
          validItems.push({
            cartItemId: cartItem.id,
            productId: product.id,
            productName: product.name,
            quantity: cartItem.quantity,
            price: product.price,
            availableStock
          });
        }
      }

      const isValid = outOfStock.length === 0 && insufficientStock.length === 0;

      console.log('[CartValidation] Validation complete:', {
        valid: isValid,
        validItems: validItems.length,
        outOfStock: outOfStock.length,
        insufficientStock: insufficientStock.length
      });

      return {
        valid: isValid,
        items: validItems,
        outOfStock,
        insufficientStock
      };
    } catch (error) {
      console.error('[CartValidation] Error validating cart:', error);
      return {
        valid: false,
        items: [],
        outOfStock: [],
        insufficientStock: [],
        error: error.message
      };
    }
  }

  /**
   * Validate cart and show toast messages
   * @param {string} userId - User UUID
   * @param {string} hostelName - Hostel name
   * @returns {Promise<Object>} - Validation result
   */
  async validateCartWithToast(userId, hostelName) {
    const result = await this.validateCart(userId, hostelName);

    if (!result.valid) {
      // Show toast for out-of-stock items
      result.outOfStock.forEach(item => {
        toast.error(`${item.productName} is out of stock`, {
          description: 'This item has been removed from your cart'
        });
      });

      // Show toast for insufficient stock items
      result.insufficientStock.forEach(item => {
        toast.warning(`Limited stock for ${item.productName}`, {
          description: `Only ${item.availableStock} available (you requested ${item.requestedQuantity})`
        });
      });
    }

    return result;
  }

  /**
   * Remove out-of-stock items from cart
   * @param {Array} outOfStockItems - Array of out-of-stock items
   * @returns {Promise<number>} - Number of items removed
   */
  async removeOutOfStockItems(outOfStockItems) {
    let removedCount = 0;

    for (const item of outOfStockItems) {
      try {
        await CartItem.delete(item.cartItemId);
        removedCount++;
        console.log('[CartValidation] Removed out-of-stock item:', item.productName);
      } catch (error) {
        console.error('[CartValidation] Error removing item:', error);
      }
    }

    return removedCount;
  }

  /**
   * Update cart items with insufficient stock to available quantity
   * @param {Array} insufficientStockItems - Array of items with insufficient stock
   * @returns {Promise<number>} - Number of items updated
   */
  async updateInsufficientStockItems(insufficientStockItems) {
    let updatedCount = 0;

    for (const item of insufficientStockItems) {
      try {
        await CartItem.update(item.cartItemId, {
          quantity: item.availableStock
        });
        updatedCount++;
        console.log('[CartValidation] Updated item quantity:', item.productName, 
          'to', item.availableStock);
      } catch (error) {
        console.error('[CartValidation] Error updating item:', error);
      }
    }

    return updatedCount;
  }

  /**
   * Clean cart by removing out-of-stock and updating insufficient stock items
   * @param {string} userId - User UUID
   * @param {string} hostelName - Hostel name
   * @returns {Promise<Object>} - Cleanup result
   */
  async cleanCart(userId, hostelName) {
    const validation = await this.validateCart(userId, hostelName);

    if (validation.valid) {
      return {
        cleaned: false,
        removed: 0,
        updated: 0,
        message: 'Cart is valid'
      };
    }

    const removed = await this.removeOutOfStockItems(validation.outOfStock);
    const updated = await this.updateInsufficientStockItems(validation.insufficientStock);

    return {
      cleaned: true,
      removed,
      updated,
      message: `Removed ${removed} out-of-stock items, updated ${updated} items with limited stock`
    };
  }

  /**
   * Validate cart before checkout (strict validation)
   * @param {string} userId - User UUID
   * @param {string} hostelName - Hostel name
   * @param {boolean} autoClean - Automatically clean cart if invalid
   * @returns {Promise<Object>} - Validation result
   */
  async validateBeforeCheckout(userId, hostelName, autoClean = true) {
    console.log('[CartValidation] Validating before checkout...');

    const validation = await this.validateCart(userId, hostelName);

    if (!validation.valid) {
      if (autoClean) {
        console.log('[CartValidation] Auto-cleaning cart...');
        const cleanup = await this.cleanCart(userId, hostelName);
        
        // Re-validate after cleanup
        const revalidation = await this.validateCart(userId, hostelName);
        
        return {
          ...revalidation,
          cleaned: true,
          cleanupResult: cleanup
        };
      }

      return {
        ...validation,
        cleaned: false
      };
    }

    return {
      ...validation,
      cleaned: false
    };
  }

  /**
   * Reserve stock for all cart items
   * @param {string} userId - User UUID
   * @param {string} hostelName - Hostel name
   * @returns {Promise<Object>} - Reservation result
   */
  async reserveCartStock(userId, hostelName) {
    console.log('[CartValidation] Reserving stock for cart...');

    // First validate cart
    const validation = await this.validateCart(userId, hostelName);

    if (!validation.valid) {
      return {
        success: false,
        message: 'Cart validation failed',
        validation
      };
    }

    // Reserve stock for each item
    const items = validation.items.map(item => ({
      product_id: item.productId,
      quantity: item.quantity
    }));

    const reservation = await stockService.reserveStockForOrder(items, hostelName);

    return {
      success: reservation.success,
      message: reservation.message || 'Stock reserved successfully',
      reservation,
      items: validation.items
    };
  }
}

// Export singleton instance
export const cartValidationService = new CartValidationService();

// Export class for testing
export { CartValidationService };
