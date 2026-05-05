import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

// ═══════════════════════════════════════════════════════════════
// MOBILE SCROLL PERFORMANCE OPTIMIZATION
// ═══════════════════════════════════════════════════════════════

// Passive touch event listeners for better scroll performance
if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
  // Enable passive touch events for smooth scrolling
  document.addEventListener('touchstart', () => {}, { passive: true });
  document.addEventListener('touchmove', () => {}, { passive: true });
  document.addEventListener('touchend', () => {}, { passive: true });
}

// ═══════════════════════════════════════════════════════════════
// ERROR SUPPRESSION
// ═══════════════════════════════════════════════════════════════

// Suppress console errors in production (keep console.error for actual debugging)
const originalError = console.error;
console.error = (...args) => {
  // Suppress known non-critical errors
  const message = args[0]?.toString() || '';
  if (
    message.includes('Lock broken by another request') ||
    message.includes('AbortError') ||
    message.includes('Error loading notifications') ||
    message.includes('Error checking delivered orders')
  ) {
    return; // Silently ignore
  }
  originalError.apply(console, args);
};

ReactDOM.createRoot(document.getElementById('root')).render(
  // <React.StrictMode>
  <App />
  // </React.StrictMode>,
)

if (import.meta.hot) {
  import.meta.hot.on('vite:beforeUpdate', () => {
    window.parent?.postMessage({ type: 'sandbox:beforeUpdate' }, '*');
  });
  import.meta.hot.on('vite:afterUpdate', () => {
    window.parent?.postMessage({ type: 'sandbox:afterUpdate' }, '*');
  });
}
