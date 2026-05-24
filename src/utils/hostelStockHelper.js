/**
 * Hostel Stock Helper
 * 
 * Utilities for fetching and managing hostel-specific stock from the hostel_stock table
 */

import { supabase } from '@/lib/supabase';

/**
 * Fetch hostel-specific stock for products
 * @param {Array<string>} productIds - Array of product IDs
 * @param {string} hostelName - Name of the hostel (e.g., "Mithali", "Gavaskar")
 * @returns {Promise<Object>} Map of product_id => stock_quantity
 */
export async function fetchHostelStock(productIds, hostelName) {
  if (!productIds || productIds.length === 0) {
    console.log('[fetchHostelStock] No product IDs provided');
    return {};
  }

  console.log('[fetchHostelStock] ========================================');
  console.log('[fetchHostelStock] Fetching FRESH stock for', productIds.length, 'products');
  console.log('[fetchHostelStock] Hostel:', hostelName);

  try {
    // First, get the hostel ID by name
    const { data: hostelData, error: hostelError } = await supabase
      .from('hostels')
      .select('id, name')
      .eq('name', hostelName)
      .maybeSingle();

    if (hostelError) {
      console.error('[fetchHostelStock] ❌ Error fetching hostel:', hostelError);
      console.error('[fetchHostelStock] This usually means the hostels table is empty or hostel name is wrong');
      console.error('[fetchHostelStock] Please run sql/COMPLETE_HOSTEL_SETUP.sql');
      return {};
    }

    if (!hostelData) {
      console.error('[fetchHostelStock] ❌ Hostel not found:', hostelName);
      console.error('[fetchHostelStock] Available hostels should be: Mithali, Gavaskar, Tendulkar, Virat, Shyamji Auditorium, Other');
      return {};
    }

    console.log('[fetchHostelStock] ✅ Found hostel:', hostelData.name, 'ID:', hostelData.id);

    // Now fetch hostel stock using hostel_id - NO CACHING
    const { data, error } = await supabase
      .from('hostel_stock')
      .select('product_id, stock_quantity')
      .in('product_id', productIds)
      .eq('hostel_id', hostelData.id);

    if (error) {
      console.error('[fetchHostelStock] ❌ Error fetching hostel stock:', error);
      console.error('[fetchHostelStock] This usually means the hostel_stock table is empty');
      console.error('[fetchHostelStock] Please run sql/COMPLETE_HOSTEL_SETUP.sql');
      return {};
    }

    if (!data || data.length === 0) {
      console.warn('[fetchHostelStock] ⚠️  No hostel stock records found for', productIds.length, 'products');
      console.warn('[fetchHostelStock] This means hostel_stock table is empty or has no records for these products');
      console.warn('[fetchHostelStock] Please run sql/COMPLETE_HOSTEL_SETUP.sql to initialize');
      return {};
    }

    console.log('[fetchHostelStock] ✅ Found', data.length, 'hostel stock records');

    // Convert to map: product_id => stock_quantity
    const stockMap = {};
    let inStockCount = 0;
    let outOfStockCount = 0;
    
    if (data) {
      data.forEach(item => {
        stockMap[item.product_id] = item.stock_quantity || 0;
        if (item.stock_quantity > 0) {
          inStockCount++;
        } else {
          outOfStockCount++;
        }
      });
    }

    console.log('[fetchHostelStock] Stock summary:');
    console.log('[fetchHostelStock]    - In stock:', inStockCount);
    console.log('[fetchHostelStock]    - Out of stock:', outOfStockCount);
    console.log('[fetchHostelStock] ========================================');

    return stockMap;
  } catch (error) {
    console.error('[fetchHostelStock] ❌ Exception:', error);
    return {};
  }
}

/**
 * Enrich products with hostel-specific stock
 * @param {Array<Object>} products - Array of product objects
 * @param {string} hostelName - Name of the hostel
 * @returns {Promise<Array<Object>>} Products with hostel_stock_quantity field
 */
export async function enrichProductsWithHostelStock(products, hostelName) {
  if (!products || products.length === 0) {
    return products;
  }

  // If no hostel selected or "Other", use total stock
  if (!hostelName || hostelName === "Other") {
    console.log('[enrichProductsWithHostelStock] No hostel or Other, using total stock');
    return products.map(p => ({
      ...p,
      hostel_stock_quantity: p.stock_quantity || 0
    }));
  }

  console.log('[enrichProductsWithHostelStock] Fetching stock for hostel:', hostelName);
  const productIds = products.map(p => p.id);
  const hostelStockMap = await fetchHostelStock(productIds, hostelName);
  
  console.log('[enrichProductsWithHostelStock] Hostel stock map size:', Object.keys(hostelStockMap).length);

  // When a hostel is selected, ONLY use hostel stock data
  // If a product has no record in hostel_stock for this hostel, treat as 0 (out of stock)
  // This ensures out-of-stock items in a hostel are never shown as available

  return products.map(product => {
    // If product has a hostel stock record, use it. Otherwise it's 0 (not available in this hostel)
    const hostelStock = hostelStockMap[product.id];
    const finalStock = hostelStock !== undefined ? hostelStock : 0;
    
    return {
      ...product,
      hostel_stock_quantity: finalStock
    };
  });
}

/**
 * Get stock quantity for a specific product and hostel
 * @param {string} productId - Product ID
 * @param {string} hostelName - Hostel name
 * @returns {Promise<number>} Stock quantity
 */
export async function getProductHostelStock(productId, hostelName) {
  if (!productId) {
    console.log('[getProductHostelStock] No productId provided');
    return 0;
  }

  console.log('[getProductHostelStock] Fetching stock for:', { productId, hostelName });

  // If no hostel or "Other", fetch total stock from products table
  if (!hostelName || hostelName === "Other") {
    console.log('[getProductHostelStock] Using total stock (no hostel or Other)');
    const { data, error } = await supabase
      .from('products')
      .select('stock_quantity')
      .eq('id', productId)
      .single();

    if (error) {
      console.error('[getProductHostelStock] Error fetching product:', error);
      return 0;
    }
    if (!data) {
      console.log('[getProductHostelStock] No product data found');
      return 0;
    }
    console.log('[getProductHostelStock] Total stock:', data.stock_quantity);
    return data.stock_quantity || 0;
  }

  try {
    // First, get the hostel ID by name
    const { data: hostelData, error: hostelError } = await supabase
      .from('hostels')
      .select('id')
      .eq('name', hostelName)
      .single();

    if (hostelError || !hostelData) {
      console.error('[getProductHostelStock] Hostel not found:', hostelName, hostelError);
      // Fallback to total stock
      const { data: productData } = await supabase
        .from('products')
        .select('stock_quantity')
        .eq('id', productId)
        .single();
      
      return productData?.stock_quantity || 0;
    }

    console.log('[getProductHostelStock] Found hostel ID:', hostelData.id);

    // Now get the hostel stock
    const { data, error } = await supabase
      .from('hostel_stock')
      .select('stock_quantity')
      .eq('product_id', productId)
      .eq('hostel_id', hostelData.id)
      .single();

    if (error) {
      console.error('[getProductHostelStock] Error fetching hostel stock:', error);
      // Fallback to total stock if hostel stock not found
      const { data: productData } = await supabase
        .from('products')
        .select('stock_quantity')
        .eq('id', productId)
        .single();
      
      console.log('[getProductHostelStock] Fallback to total stock:', productData?.stock_quantity);
      return productData?.stock_quantity || 0;
    }

    if (!data) {
      console.log('[getProductHostelStock] No hostel stock record found, using 0');
      return 0;
    }

    console.log('[getProductHostelStock] Hostel stock found:', data.stock_quantity);
    return data.stock_quantity || 0;
  } catch (error) {
    console.error('[getProductHostelStock] Exception:', error);
    return 0;
  }
}

/**
 * Check if product is in stock for a specific hostel
 * @param {Object} product - Product object
 * @param {string} hostelName - Hostel name
 * @returns {boolean} True if in stock
 */
export function isProductInStock(product, hostelName) {
  if (!product) return false;

  // Use hostel_stock_quantity if available (enriched product)
  if (product.hostel_stock_quantity !== undefined) {
    return product.hostel_stock_quantity > 0;
  }

  // Fallback to total stock
  return (product.stock_quantity || 0) > 0;
}

/**
 * Get display stock for a product (hostel-specific or total)
 * @param {Object} product - Product object
 * @param {string} hostelName - Hostel name
 * @returns {number} Stock quantity to display
 */
export function getDisplayStock(product, hostelName) {
  if (!product) return 0;

  // Use enriched hostel stock if available
  if (product.hostel_stock_quantity !== undefined) {
    return product.hostel_stock_quantity;
  }

  // Fallback to total stock
  return product.stock_quantity || 0;
}
