// Order utility functions for retry logic and idempotency
import { logErrorToDB } from './supabaseWithLogging';

export async function withRetry(fn, retries = 3, delays = [1000, 2000, 4000], onRetry = null) {
  let lastError;
  
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt < retries - 1) {
        // Notify caller of retry attempt
        if (onRetry) {
          onRetry(attempt + 2);
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delays[attempt] || 4000));
      }
    }
  }
  
  // Log error after all retries failed
  await logErrorToDB(
    'API',
    `Order failed after ${retries} attempts: ${lastError.message}`,
    window.location.pathname,
    lastError.stack || ''
  );
  
  throw new Error(`Order failed after ${retries} attempts. Please check your connection and try again.`);
}

export function generateIdempotencyKey() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export function checkDuplicateOrder(orders, userId) {
  const sixtySecondsAgo = new Date(Date.now() - 60 * 1000);
  
  const recentOrder = orders.find(order => 
    order.user_id === userId &&
    new Date(order.created_at) > sixtySecondsAgo &&
    order.status !== 'cancelled'
  );
  
  return recentOrder;
}
