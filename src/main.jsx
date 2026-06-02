import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

// Defer non-critical initialization
const initNonCritical = () => {
  // Performance monitoring - defer
  import('@/utils/performanceMonitor').then(({ initPerformanceMonitoring }) => {
    initPerformanceMonitoring();
  }).catch(() => {});

  // Passive touch events for scroll performance
  if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
    document.addEventListener('touchstart', () => {}, { passive: true });
    document.addEventListener('touchmove', () => {}, { passive: true });
  }

  // Proactively prefetch major lazy chunks in background to prevent dynamic import failures
  try {
    const prefetchRoutes = [
      () => import('@/pages/Cart'),
      () => import('@/pages/Wishlist'),
      () => import('@/pages/Referral'),
      () => import('@/pages/CCA'),
      () => import('@/pages/employee/EmployeeDashboard')
    ];
    // Prefetch sequentially to avoid locking the main thread
    prefetchRoutes.forEach((importFn, idx) => {
      setTimeout(() => {
        importFn().catch(() => {}); // Preload silently into cache
      }, 3000 + idx * 1500);
    });
  } catch (_) {}
};

// Global error tracking for uncaught runtime exceptions
window.addEventListener('error', (event) => {
  if (event.error) {
    try {
      import('@/utils/supabaseWithLogging').then(({ logErrorToDB }) => {
        logErrorToDB(
          'RuntimeUncaught',
          event.error.message || 'Uncaught JS error',
          window.location.pathname,
          event.error.stack || ''
        );
      }).catch(() => {});
    } catch (_) {}
  }
});

// Suppress known non-critical console errors in production, while logging serious ones
if (import.meta.env.PROD) {
  const originalError = console.error;
  console.error = (...args) => {
    const message = args[0]?.toString() || '';
    
    // Ignore benign/known noise
    if (
      message.includes('Lock broken by another request') ||
      message.includes('AbortError') ||
      message.includes('Error loading notifications') ||
      message.includes('Error checking delivered orders') ||
      message.includes('Google Maps') ||
      message.includes('Clarity')
    ) {
      return;
    }

    // Attempt database logging for serious, unexpected errors
    try {
      import('@/utils/supabaseWithLogging').then(({ logErrorToDB }) => {
        logErrorToDB('ConsoleError', message, window.location.pathname);
      }).catch(() => {});
    } catch (_) {}

    originalError.apply(console, args);
  };
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);

// Run non-critical init after first paint
if ('requestIdleCallback' in window) {
  requestIdleCallback(initNonCritical);
} else {
  setTimeout(initNonCritical, 100);
}

if (import.meta.hot) {
  import.meta.hot.on('vite:beforeUpdate', () => {
    window.parent?.postMessage({ type: 'sandbox:beforeUpdate' }, '*');
  });
  import.meta.hot.on('vite:afterUpdate', () => {
    window.parent?.postMessage({ type: 'sandbox:afterUpdate' }, '*');
  });
}
