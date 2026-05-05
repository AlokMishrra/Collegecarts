/**
 * Dispatch a custom event to notify that the cart has been updated
 * This will trigger cart count refresh in the Layout component
 */
export const notifyCartUpdate = () => {
  window.dispatchEvent(new CustomEvent('cartUpdated'));
};
