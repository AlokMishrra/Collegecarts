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
      has_hostel_stock: false,
      hostel_stock_quantity: p.stock_quantity || 0
    }));
  }

  console.log('[enrichProductsWithHostelStock] Fetching stock for hostel:', hostelName);
  const productIds = products.map(p => p.id);
  const hostelStockMap = await fetchHostelStock(productIds, hostelName);
  
  console.log('[enrichProductsWithHostelStock] Hostel stock map size:', Object.keys(hostelStockMap).length);

  // Two different situations must not be collapsed into one:
  //
  //   has_hostel_stock = true  -> this product is stocked per hostel and the row
  //                              says 0, so it is genuinely sold out HERE. It
  //                              must not show an ADD button.
  //   has_hostel_stock = false -> no per-hostel row exists at all. 76 of 299
  //                              products are in this state, and hiding them
  //                              would take real, orderable products off the
  //                              shelf. Treat them as available via total stock.
  //
  // Treating a missing row as 0 (the previous behaviour) is what made 95
  // genuinely sold-out products look available, and what would have made these
  // 76 disappear. Only an explicit 0 counts as sold out.

  return products.map(product => {
    const hasRecord = Object.prototype.hasOwnProperty.call(hostelStockMap, product.id);

    return {
      ...product,
      has_hostel_stock: hasRecord,
      // Always a number so the many existing `hostel_stock_quantity !== undefined`
      // call sites keep working unchanged. The boolean above is what tells the
      // display/guard logic whether the number is a real per-hostel figure.
      hostel_stock_quantity: hasRecord
        ? hostelStockMap[product.id] || 0
        : product.stock_quantity || 0,
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
 * Check if product is in stock for a specific hostel.
 * Must always agree with getDisplayStock — the ADD button and the cart guard
 * both use these, and any disagreement is what let sold-out items be added.
 */
export function isProductInStock(product, hostelName) {
  if (!product) return false;
  return getDisplayStock(product, hostelName) > 0;
}

/**
 * getDisplayStock — the stock figure that must be shown and enforced.
 *
 * This is the ONLY definition. Five call sites used to carry their own copy and
 * two of them (Shop.jsx, CategoryProducts.jsx) "helpfully" fell back to the
 * global `stock_quantity` when the hostel figure was 0. That made an item that
 * is out of stock in the selected hostel still render an enabled ADD button,
 * because the shop believed there was stock left.
 *
 * Semantics:
 *   - `hostel_stock_quantity` is set by enrichProductsWithHostelStock() and is
 *     authoritative once a real hostel is selected. 0 means genuinely sold out
 *     in that hostel, and must never be second-guessed.
 *   - With no hostel selected (or "Other"), there is no per-hostel figure, so the
 *     global `stock_quantity` is correct.
 *
 * Never reintroduce a "if hostel is 0 but total > 0, use total" branch. Stock
 * is stocked per hostel; an empty shelf in one hostel is not restocked by
 * inventory sitting in another.
 */
export function getDisplayStock(product, hostelName) {
  if (!product) return 0;

  const hostelSelected = !!hostelName && hostelName !== "Other";
  if (!hostelSelected) {
    return product.stock_quantity || 0;
  }

  // A hostel is chosen. If the product is stocked per hostel, that row is
  // authoritative — a 0 means sold out in this hostel and must be respected.
  if (product.has_hostel_stock === true) {
    return product.hostel_stock_quantity || 0;
  }

  // No per-hostel row exists for this product, so per-hostel stock has not been
  // configured for it. Fall back to total stock rather than hiding a product
  // that may well be orderable.
  return product.stock_quantity || 0;
}
