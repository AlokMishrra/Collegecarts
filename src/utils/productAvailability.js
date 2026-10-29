/**
 * Product availability window.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * Three different implementations of the same check existed:
 *   - src/utils/productAvailability.js   (the canonical one)
 *   - src/pages/Shop.jsx                 (inline copy)
 *   - src/pages/CategoryProducts.jsx     (inline copy)
 *
 * They disagreed on the time format, and all three treated "outside the
 * window" as "OUT OF STOCK" — which silently hid products that were genuinely
 * in stock.
 *
 * THE ACTUAL INCIDENT (Oct 2026)
 * -------------------------------
 * A bulk import wrote a wall-clock timestamp into available_from/available_to
 * instead of a sale window, so all 453 products ended up with something like
 * available_from = '9:21 AM', available_to = '9:40 PM'. The column is meant to
 * hold a 24-hour "HH:MM" value. From 9:40 PM onward every product in the
 * catalogue rendered as OUT OF STOCK even though 341 of them had stock.
 *
 * THE RULES ENFORCED HERE
 * -----------------------
 * 1. An empty window means "available 24/7" (this is what the admin form says:
 *    "Leave empty for 24/7 availability").
 * 2. A window that cannot be parsed is IGNORED, not treated as closed. A
 *    malformed value must never remove a product that is physically in stock.
 * 3. Both 24-hour ("09:21", "21:40") and 12-hour ("9:21 AM", "9:40 PM") are
 *    accepted, because the database has contained both.
 * 4. A window whose end is before its start is treated as overnight
 *    (e.g. 22:00 -> 02:00) rather than as permanently closed.
 */

/**
 * Parse an availability time to minutes-since-midnight.
 *
 * @param {string|number|null|undefined} value
 * @returns {number|null} minutes since midnight, or null when unparseable.
 */
export function parseAvailabilityTime(value) {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const raw = String(value).trim();
  if (!raw) return null;

  // 12-hour form, e.g. "9:21 AM", "09:21 AM", "12:37 PM".
  const m12 = raw.match(/^(\d{1,2}):(\d{2})\s*([AP])\.?M\.?$/i);
  if (m12) {
    let hours = parseInt(m12[1], 10);
    const minutes = parseInt(m12[2], 10);
    if (hours > 23 || minutes > 59) return null;
    const isPm = m12[3].toUpperCase() === "P";
    if (isPm && hours !== 12) hours += 12;
    if (!isPm && hours === 12) hours = 0;
    return hours * 60 + minutes;
  }

  // 24-hour form, e.g. "09:21", "21:40".
  const m24 = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (m24) {
    const hours = parseInt(m24[1], 10);
    const minutes = parseInt(m24[2], 10);
    if (hours > 23 || minutes > 59) return null;
    return hours * 60 + minutes;
  }

  return null;
}

/**
 * Is the product inside its availability window right now?
 *
 * @param {Object} product
 * @param {Date} [now]
 * @returns {boolean} true when the product may be sold.
 */
export function isProductAvailableNow(product, now = new Date()) {
  if (!product) return true;

  const from = parseAvailabilityTime(product.available_from);
  const to = parseAvailabilityTime(product.available_to);

  // No window configured, or a window we cannot read.
  //
  // An unparseable window used to be treated as "closed", which is what made
  // the whole catalogue read OUT OF STOCK after the import corrupted the
  // column. A value we cannot understand must never be allowed to hide stock.
  if (from === null || to === null) return true;

  const current = now.getHours() * 60 + now.getMinutes();

  if (from <= to) {
    return current >= from && current <= to;
  }
  // Overnight window, e.g. 22:00 -> 02:00.
  return current >= from || current <= to;
}

/**
 * Filter a list of products to those that may be sold right now.
 */
export function filterAvailableProducts(products, now = new Date()) {
  if (!Array.isArray(products)) return [];
  return products.filter((p) => isProductAvailableNow(p, now));
}

/**
 * Human readable availability message.
 */
export function getAvailabilityMessage(product, now = new Date()) {
  if (!product?.available_from || !product?.available_to) {
    return "Available 24/7";
  }
  if (isProductAvailableNow(product, now)) {
    return `Available until ${product.available_to}`;
  }
  return `Available from ${product.available_from} to ${product.available_to}`;
}

/**
 * The availability window as a structured value, for the admin UI.
 * Returns null when there is no usable window.
 */
export function getAvailabilityWindow(product) {
  const from = parseAvailabilityTime(product?.available_from);
  const to = parseAvailabilityTime(product?.available_to);
  if (from === null || to === null) return null;
  return { from, to };
}
