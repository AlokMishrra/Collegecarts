/**
 * Performance Monitoring Utility for CollegeCart
 * 
 * Tracks Web Vitals and custom performance metrics
 * Helps identify bottlenecks and optimization opportunities
 */

// Track page load performance
export function trackPageLoad(pageName) {
  if (typeof window === 'undefined' || !window.performance) return;

  try {
    const perfData = window.performance.timing;
    const pageLoadTime = perfData.loadEventEnd - perfData.navigationStart;
    const connectTime = perfData.responseEnd - perfData.requestStart;
    const renderTime = perfData.domComplete - perfData.domLoading;

    if (import.meta.env.DEV) {
      console.log(`[Performance] ${pageName}:`, {
        pageLoadTime: `${pageLoadTime}ms`,
        connectTime: `${connectTime}ms`,
        renderTime: `${renderTime}ms`,
      });
    }

    // In production, send to analytics service
    if (import.meta.env.PROD && pageLoadTime > 3000) {
      // Log slow page loads
      console.warn(`[Performance] Slow page load: ${pageName} took ${pageLoadTime}ms`);
    }
  } catch (error) {
    // Silently fail - don't break the app
  }
}

// Track API call performance
export function trackAPICall(endpoint, duration) {
  if (import.meta.env.DEV && duration > 1000) {
    console.warn(`[Performance] Slow API call: ${endpoint} took ${duration}ms`);
  }

  // In production, send to analytics
  if (import.meta.env.PROD && duration > 2000) {
    console.warn(`[Performance] Slow API: ${endpoint} - ${duration}ms`);
  }
}

// Track component render time
export function measureRender(componentName, callback) {
  if (typeof window === 'undefined' || !window.performance) {
    return callback();
  }

  const start = performance.now();
  const result = callback();
  const duration = performance.now() - start;

  if (import.meta.env.DEV && duration > 16) {
    // 16ms = 60fps threshold
    console.warn(`[Performance] Slow render: ${componentName} took ${duration.toFixed(2)}ms`);
  }

  return result;
}

// Track user interactions
export function trackInteraction(actionName) {
  if (typeof window === 'undefined' || !window.performance) return;

  const timestamp = performance.now();
  
  if (import.meta.env.DEV) {
    console.log(`[Performance] User action: ${actionName} at ${timestamp.toFixed(2)}ms`);
  }
}

// Measure Web Vitals (LCP, FID, CLS)
export function measureWebVitals() {
  if (typeof window === 'undefined' || !window.PerformanceObserver) return;

  try {
    // Largest Contentful Paint (LCP)
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];
      const lcp = lastEntry.renderTime || lastEntry.loadTime;
      
      if (import.meta.env.DEV) {
        console.log(`[Performance] LCP: ${lcp.toFixed(2)}ms`);
      }
      
      if (lcp > 2500) {
        console.warn(`[Performance] Poor LCP: ${lcp.toFixed(2)}ms (target: <2500ms)`);
      }
    });
    lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

    // First Input Delay (FID)
    const fidObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        const fid = entry.processingStart - entry.startTime;
        
        if (import.meta.env.DEV) {
          console.log(`[Performance] FID: ${fid.toFixed(2)}ms`);
        }
        
        if (fid > 100) {
          console.warn(`[Performance] Poor FID: ${fid.toFixed(2)}ms (target: <100ms)`);
        }
      });
    });
    fidObserver.observe({ entryTypes: ['first-input'] });

    // Cumulative Layout Shift (CLS)
    let clsScore = 0;
    const clsObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        if (!entry.hadRecentInput) {
          clsScore += entry.value;
        }
      });
      
      if (import.meta.env.DEV) {
        console.log(`[Performance] CLS: ${clsScore.toFixed(3)}`);
      }
      
      if (clsScore > 0.1) {
        console.warn(`[Performance] Poor CLS: ${clsScore.toFixed(3)} (target: <0.1)`);
      }
    });
    clsObserver.observe({ entryTypes: ['layout-shift'] });
  } catch (error) {
    // Silently fail
  }
}

// Memory usage tracking (for detecting memory leaks)
export function trackMemoryUsage() {
  if (typeof window === 'undefined' || !window.performance || !performance.memory) return;

  try {
    const memory = performance.memory;
    const usedMB = (memory.usedJSHeapSize / 1048576).toFixed(2);
    const totalMB = (memory.totalJSHeapSize / 1048576).toFixed(2);
    const limitMB = (memory.jsHeapSizeLimit / 1048576).toFixed(2);

    if (import.meta.env.DEV) {
      console.log(`[Performance] Memory: ${usedMB}MB / ${totalMB}MB (limit: ${limitMB}MB)`);
    }

    // Warn if memory usage is high
    const usagePercent = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;
    if (usagePercent > 90) {
      console.warn(`[Performance] High memory usage: ${usagePercent.toFixed(1)}%`);
    }
  } catch (error) {
    // Silently fail
  }
}

// Initialize performance monitoring
export function initPerformanceMonitoring() {
  if (typeof window === 'undefined') return;

  // Measure Web Vitals
  measureWebVitals();

  // Track memory usage every 30 seconds in development
  if (import.meta.env.DEV) {
    setInterval(trackMemoryUsage, 30000);
  }

  // Track page visibility changes
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      trackInteraction('page_visible');
    }
  });
}

// Debounce helper for performance
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Throttle helper for performance
export function throttle(func, limit) {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}
