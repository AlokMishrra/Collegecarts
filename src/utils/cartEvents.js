/**
 * Dispatch a custom event to notify that the cart has been updated.
 *
 * `source` is optional and is only used by pages that keep their own copy of
 * the cart in state. A page that reloads its cart on this event must skip
 * events it emitted itself, otherwise its own optimistic update gets
 * overwritten by a refetch mid-write. Listeners that only need a badge count
 * (Layout, CartPopup, FloatingCartButton) can ignore the detail entirely.
 */
export const notifyCartUpdate = (source) => {
  window.dispatchEvent(new CustomEvent('cartUpdated', { detail: { source } }));
};
