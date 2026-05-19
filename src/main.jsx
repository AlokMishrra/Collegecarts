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
};

// Suppress known non-critical console errors in production
if (import.meta.env.PROD) {
  const originalError = console.error;
  console.error = (...args) => {
    const message = args[0]?.toString() || '';
    if (
      message.includes('Lock broken by another request') ||
      message.includes('AbortError') ||
      message.includes('Error loading notifications') ||
      message.includes('Error checking delivered orders')
    ) {
      return;
    }
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
