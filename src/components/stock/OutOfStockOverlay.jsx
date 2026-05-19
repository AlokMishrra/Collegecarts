/**
 * OutOfStockOverlay Component
 * 
 * Displays an overlay on product images when out of stock
 * Provides clear visual feedback that product is unavailable
 */

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * OutOfStockOverlay Component
 * @param {Object} props
 * @param {boolean} props.isOutOfStock - Whether product is out of stock
 * @param {Function} props.onNotifyMe - Callback when user clicks "Notify Me"
 * @param {string} props.className - Additional CSS classes
 * @param {boolean} props.showNotifyButton - Show "Notify Me" button (default: false)
 */
export function OutOfStockOverlay({ 
  isOutOfStock, 
  onNotifyMe, 
  className = '',
  showNotifyButton = false
}) {
  if (!isOutOfStock) return null;

  return (
    <div className={`absolute inset-0 bg-gray-900/80 backdrop-blur-sm flex flex-col items-center justify-center z-20 ${className}`}>
      <Badge className="bg-red-500 text-white text-sm px-4 py-2 mb-3 shadow-lg">
        <AlertCircle className="w-4 h-4 mr-2" />
        OUT OF STOCK
      </Badge>
      
      {showNotifyButton && onNotifyMe && (
        <Button
          size="sm"
          variant="outline"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onNotifyMe();
          }}
          className="bg-white/90 hover:bg-white text-gray-900 border-0"
        >
          <Bell className="w-3 h-3 mr-2" />
          Notify Me
        </Button>
      )}
    </div>
  );
}

/**
 * LowStockOverlay Component
 * Shows a subtle overlay for low stock items
 */
export function LowStockOverlay({ 
  stock, 
  threshold = 5, 
  className = '' 
}) {
  if (stock > threshold || stock === 0) return null;

  return (
    <div className={`absolute top-3 right-3 z-10 ${className}`}>
      <Badge className="bg-orange-500 text-white shadow-lg text-xs px-3 py-1 animate-pulse">
        Only {stock} left
      </Badge>
    </div>
  );
}

/**
 * StockOverlay Component
 * Combines out-of-stock and low-stock overlays
 */
export function StockOverlay({ 
  product, 
  stock, 
  onNotifyMe, 
  showNotifyButton = false,
  lowStockThreshold = 5,
  className = '' 
}) {
  if (!product) return null;

  const stockQuantity = stock !== undefined 
    ? stock 
    : (product.hostel_stock_quantity !== undefined 
        ? product.hostel_stock_quantity 
        : product.stock_quantity || 0);

  // Out of stock
  if (stockQuantity === 0) {
    return (
      <OutOfStockOverlay
        isOutOfStock={true}
        onNotifyMe={onNotifyMe}
        showNotifyButton={showNotifyButton}
        className={className}
      />
    );
  }

  // Low stock
  if (stockQuantity <= lowStockThreshold) {
    return (
      <LowStockOverlay
        stock={stockQuantity}
        threshold={lowStockThreshold}
        className={className}
      />
    );
  }

  return null;
}

/**
 * ComingSoonOverlay Component
 * For products that will be available soon
 */
export function ComingSoonOverlay({ 
  availableDate, 
  className = '' 
}) {
  return (
    <div className={`absolute inset-0 bg-gradient-to-br from-purple-900/80 to-blue-900/80 backdrop-blur-sm flex flex-col items-center justify-center z-20 ${className}`}>
      <Badge className="bg-purple-500 text-white text-sm px-4 py-2 mb-2 shadow-lg">
        COMING SOON
      </Badge>
      {availableDate && (
        <span className="text-white text-xs">
          Available {availableDate}
        </span>
      )}
    </div>
  );
}

/**
 * PreOrderOverlay Component
 * For products available for pre-order
 */
export function PreOrderOverlay({ 
  deliveryDate, 
  onPreOrder, 
  className = '' 
}) {
  return (
    <div className={`absolute inset-0 bg-gradient-to-br from-blue-900/80 to-indigo-900/80 backdrop-blur-sm flex flex-col items-center justify-center z-20 ${className}`}>
      <Badge className="bg-blue-500 text-white text-sm px-4 py-2 mb-3 shadow-lg">
        PRE-ORDER
      </Badge>
      {deliveryDate && (
        <span className="text-white text-xs mb-3">
          Delivery: {deliveryDate}
        </span>
      )}
      {onPreOrder && (
        <Button
          size="sm"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onPreOrder();
          }}
          className="bg-blue-500 hover:bg-blue-600 text-white border-0"
        >
          Pre-Order Now
        </Button>
      )}
    </div>
  );
}

export default OutOfStockOverlay;
