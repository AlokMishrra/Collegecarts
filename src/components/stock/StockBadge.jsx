/**
 * StockBadge Component
 * 
 * Displays stock status badge for products
 * Shows "Out of Stock", "Only X left", or nothing if plenty in stock
 */

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Package } from 'lucide-react';

/**
 * StockBadge Component
 * @param {Object} props
 * @param {Object} props.product - Product object
 * @param {number} props.stock - Stock quantity (optional, will use product.hostel_stock_quantity or product.stock_quantity)
 * @param {number} props.lowStockThreshold - Threshold for "low stock" warning (default: 5)
 * @param {string} props.className - Additional CSS classes
 * @param {string} props.size - Badge size: 'sm', 'md', 'lg' (default: 'md')
 * @param {boolean} props.showIcon - Show icon in badge (default: true)
 */
export function StockBadge({ 
  product, 
  stock, 
  lowStockThreshold = 5, 
  className = '',
  size = 'md',
  showIcon = true
}) {
  if (!product) return null;

  // Determine stock quantity
  const stockQuantity = stock !== undefined 
    ? stock 
    : (product.hostel_stock_quantity !== undefined 
        ? product.hostel_stock_quantity 
        : product.stock_quantity || 0);

  // Size classes
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-1.5'
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  };

  // Out of stock
  if (stockQuantity === 0) {
    return (
      <Badge 
        className={`bg-red-500 hover:bg-red-600 text-white ${sizeClasses[size]} ${className}`}
      >
        {showIcon && <AlertCircle className={`${iconSizes[size]} mr-1`} />}
        OUT OF STOCK
      </Badge>
    );
  }

  // Low stock warning
  if (stockQuantity <= lowStockThreshold) {
    return (
      <Badge 
        className={`bg-orange-500 hover:bg-orange-600 text-white animate-pulse ${sizeClasses[size]} ${className}`}
      >
        {showIcon && <Package className={`${iconSizes[size]} mr-1`} />}
        Only {stockQuantity} left
      </Badge>
    );
  }

  // Plenty in stock - don't show badge
  return null;
}

/**
 * InlineStockStatus Component
 * Shows stock status as inline text (not a badge)
 */
export function InlineStockStatus({ product, stock, className = '' }) {
  if (!product) return null;

  const stockQuantity = stock !== undefined 
    ? stock 
    : (product.hostel_stock_quantity !== undefined 
        ? product.hostel_stock_quantity 
        : product.stock_quantity || 0);

  if (stockQuantity === 0) {
    return (
      <span className={`text-red-600 font-semibold ${className}`}>
        Out of Stock
      </span>
    );
  }

  if (stockQuantity <= 5) {
    return (
      <span className={`text-orange-600 font-medium ${className}`}>
        Only {stockQuantity} left
      </span>
    );
  }

  return (
    <span className={`text-green-600 font-medium ${className}`}>
      In Stock
    </span>
  );
}

/**
 * StockIndicator Component
 * Shows a colored dot indicator for stock status
 */
export function StockIndicator({ product, stock, className = '', showLabel = false }) {
  if (!product) return null;

  const stockQuantity = stock !== undefined 
    ? stock 
    : (product.hostel_stock_quantity !== undefined 
        ? product.hostel_stock_quantity 
        : product.stock_quantity || 0);

  let color = 'bg-green-500';
  let label = 'In Stock';

  if (stockQuantity === 0) {
    color = 'bg-red-500';
    label = 'Out of Stock';
  } else if (stockQuantity <= 5) {
    color = 'bg-orange-500';
    label = 'Low Stock';
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className={`w-2 h-2 rounded-full ${color}`} />
      {showLabel && (
        <span className="text-sm text-gray-600">{label}</span>
      )}
    </div>
  );
}

/**
 * StockProgressBar Component
 * Shows stock level as a progress bar
 */
export function StockProgressBar({ 
  product, 
  stock, 
  maxStock = 100, 
  className = '',
  showLabel = true 
}) {
  if (!product) return null;

  const stockQuantity = stock !== undefined 
    ? stock 
    : (product.hostel_stock_quantity !== undefined 
        ? product.hostel_stock_quantity 
        : product.stock_quantity || 0);

  const percentage = Math.min((stockQuantity / maxStock) * 100, 100);
  
  let barColor = 'bg-green-500';
  if (percentage === 0) {
    barColor = 'bg-red-500';
  } else if (percentage <= 20) {
    barColor = 'bg-orange-500';
  } else if (percentage <= 50) {
    barColor = 'bg-yellow-500';
  }

  return (
    <div className={`space-y-1 ${className}`}>
      {showLabel && (
        <div className="flex justify-between text-xs text-gray-600">
          <span>Stock Level</span>
          <span>{stockQuantity} / {maxStock}</span>
        </div>
      )}
      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
        <div 
          className={`h-full ${barColor} transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

export default StockBadge;
