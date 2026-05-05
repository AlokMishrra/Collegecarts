/**
 * Check if a product is available based on its scheduled time
 * @param {Object} product - Product object with available_from and available_to
 * @returns {boolean} - True if product is available now, false otherwise
 */
export function isProductAvailableNow(product) {
  // If no schedule is set, product is available
  if (!product.available_from || !product.available_to) {
    return true;
  }

  try {
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes(); // Current time in minutes

    // Parse available_from (format: "HH:MM")
    const [fromHour, fromMin] = product.available_from.split(':').map(Number);
    const availableFromMinutes = fromHour * 60 + fromMin;

    // Parse available_to (format: "HH:MM")
    const [toHour, toMin] = product.available_to.split(':').map(Number);
    const availableToMinutes = toHour * 60 + toMin;

    // Check if current time is within available range
    if (availableFromMinutes <= availableToMinutes) {
      // Normal case: e.g., 09:00 to 18:00
      return currentTime >= availableFromMinutes && currentTime <= availableToMinutes;
    } else {
      // Overnight case: e.g., 22:00 to 02:00
      return currentTime >= availableFromMinutes || currentTime <= availableToMinutes;
    }
  } catch (error) {
    console.error('Error checking product availability:', error);
    return true; // Default to available if there's an error
  }
}

/**
 * Filter an array of products to only include those available now
 * @param {Array} products - Array of product objects
 * @returns {Array} - Filtered array of available products
 */
export function filterAvailableProducts(products) {
  return products.filter(product => isProductAvailableNow(product));
}

/**
 * Get a human-readable availability message for a product
 * @param {Object} product - Product object with available_from and available_to
 * @returns {string} - Availability message
 */
export function getAvailabilityMessage(product) {
  if (!product.available_from || !product.available_to) {
    return 'Available 24/7';
  }

  if (isProductAvailableNow(product)) {
    return `Available until ${product.available_to}`;
  } else {
    return `Available from ${product.available_from} to ${product.available_to}`;
  }
}
