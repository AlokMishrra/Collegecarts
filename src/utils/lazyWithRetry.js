import { lazy } from 'react';

/**
 * A robust wrapper around React.lazy that auto-retries chunk imports if they fail
 * due to network errors, deployment shifts, or missing assets.
 * If retries are exhausted, it reloads the window to retrieve the latest build assets.
 *
 * @param {Function} importFn - The dynamic import function, e.g., () => import('./MyComponent')
 * @param {number} retries - Number of retries before forcing page reload (default: 3)
 * @param {number} interval - Delay in ms between retries (default: 1000)
 */
export const lazyWithRetry = (importFn, retries = 3, interval = 1000) => {
  return lazy(() => 
    new Promise((resolve, reject) => {
      const execute = (remainingRetries) => {
        importFn()
          .then(resolve)
          .catch((error) => {
            const errorMessage = error?.message || '';
            const isChunkError = 
              errorMessage.includes('Failed to fetch dynamically imported module') ||
              errorMessage.includes('ChunkLoadError') ||
              errorMessage.includes('Loading chunk') ||
              error.name === 'ChunkLoadError' ||
              error.name === 'TypeError'; // Dynamic import failures can throw generic TypeErrors in older browsers

            if (isChunkError) {
              if (remainingRetries > 0) {
                console.warn(`Dynamic import failed. Retrying in ${interval}ms... (${remainingRetries} retries left)`, error);
                setTimeout(() => {
                  execute(remainingRetries - 1);
                }, interval);
              } else {
                console.error('All retries for dynamic import exhausted. Forcing window reload to fetch new build assets...', error);
                
                // Track in session storage so we don't end up in an infinite reload loop
                const reloadKey = 'cc_chunk_reload_count';
                const reloadCount = parseInt(sessionStorage.getItem(reloadKey) || '0', 10);
                
                if (reloadCount < 2) {
                  sessionStorage.setItem(reloadKey, String(reloadCount + 1));
                  window.location.reload();
                } else {
                  console.error('Forced reload loop detected. Rejecting import promise to show error boundary.', error);
                  sessionStorage.removeItem(reloadKey);
                  reject(error);
                }
              }
            } else {
              // If it's a regular JS compilation/runtime error inside the chunk, don't retry and fail fast
              reject(error);
            }
          });
      };
      
      execute(retries);
    })
  );
};
