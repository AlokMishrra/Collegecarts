# CollegeCart Performance Commands & Scripts

Quick reference for performance testing, monitoring, and optimization tasks.

## Build & Analysis

### Build for Production
```bash
npm run build
```

### Analyze Bundle Size
```bash
# Install analyzer
npm install --save-dev rollup-plugin-visualizer

# Add to vite.config.js
import { visualizer } from 'rollup-plugin-visualizer';

plugins: [
  visualizer({ open: true, gzipSize: true, brotliSize: true })
]

# Build and view
npm run build
```

### Check Bundle Sizes
```bash
# After build
ls -lh dist/assets/
```

## Performance Testing

### Lighthouse (Chrome DevTools)
```bash
# Open Chrome DevTools
# Navigate to Lighthouse tab
# Run audit for Performance, Accessibility, Best Practices, SEO
```

### Test on Slow Network
```bash
# Chrome DevTools → Network tab → Throttling → Slow 3G
```

### Memory Profiling
```bash
# Chrome DevTools → Memory tab → Take heap snapshot
# Compare snapshots to detect memory leaks
```

## Database Performance

### Apply Performance Indexes
```sql
-- Run in Supabase SQL Editor
\i supabase/migrations/20260513000001_performance_indexes.sql
```

### Check Index Usage
```sql
-- Check if indexes are being used
EXPLAIN ANALYZE 
SELECT * FROM products 
WHERE category_id = 'some-id' 
ORDER BY display_order;
```

### Analyze Tables
```sql
-- Update statistics for query planner
ANALYZE products;
ANALYZE categories;
ANALYZE cart_items;
ANALYZE orders;
```

### Check Slow Queries
```sql
-- Enable slow query logging in Supabase dashboard
-- Settings → Database → Query Performance
```

## Cache Management

### Clear Browser Cache
```javascript
// In browser console
localStorage.clear();
sessionStorage.clear();
caches.keys().then(names => names.forEach(name => caches.delete(name)));
location.reload();
```

### Invalidate Shop Cache
```javascript
// In browser console
import { invalidateCache } from '@/utils/shopCache';
invalidateCache();
```

### Clear Image Cache
```javascript
// In browser console
import { clearImageCache } from '@/utils/imageOptimization';
await clearImageCache();
```

## Development

### Start Dev Server with Performance Monitoring
```bash
npm run dev
# Performance logs will appear in console
```

### Check for Unused Dependencies
```bash
npx depcheck
```

### Check for Security Issues
```bash
npm audit
npm audit fix
```

### Update Dependencies
```bash
# Check outdated packages
npm outdated

# Update all to latest
npm update

# Update specific package
npm install package-name@latest
```

## Production Monitoring

### Check Web Vitals (Browser Console)
```javascript
// LCP - Largest Contentful Paint
new PerformanceObserver((list) => {
  const entries = list.getEntries();
  const lastEntry = entries[entries.length - 1];
  console.log('LCP:', lastEntry.renderTime || lastEntry.loadTime);
}).observe({ entryTypes: ['largest-contentful-paint'] });

// FID - First Input Delay
new PerformanceObserver((list) => {
  list.getEntries().forEach((entry) => {
    console.log('FID:', entry.processingStart - entry.startTime);
  });
}).observe({ entryTypes: ['first-input'] });

// CLS - Cumulative Layout Shift
let cls = 0;
new PerformanceObserver((list) => {
  list.getEntries().forEach((entry) => {
    if (!entry.hadRecentInput) cls += entry.value;
  });
  console.log('CLS:', cls);
}).observe({ entryTypes: ['layout-shift'] });
```

### Check Memory Usage
```javascript
// In browser console
if (performance.memory) {
  const used = (performance.memory.usedJSHeapSize / 1048576).toFixed(2);
  const total = (performance.memory.totalJSHeapSize / 1048576).toFixed(2);
  const limit = (performance.memory.jsHeapSizeLimit / 1048576).toFixed(2);
  console.log(`Memory: ${used}MB / ${total}MB (limit: ${limit}MB)`);
}
```

### Check API Response Times
```javascript
// In browser console
performance.getEntriesByType('resource')
  .filter(r => r.name.includes('supabase'))
  .forEach(r => console.log(r.name, `${r.duration.toFixed(2)}ms`));
```

## Image Optimization

### Convert Images to WebP
```bash
# Install sharp
npm install sharp

# Create conversion script
node scripts/convert-images-to-webp.js
```

### Compress Images
```bash
# Using ImageOptim (Mac)
# Or use online tools: tinypng.com, squoosh.app
```

### Generate Responsive Images
```bash
# Using sharp
node scripts/generate-responsive-images.js
```

## Testing

### Load Testing
```bash
# Install artillery
npm install -g artillery

# Create load test config
artillery quick --count 100 --num 10 https://your-app.vercel.app

# Or use k6, Apache JMeter, or Gatling
```

### Stress Testing
```bash
# Test with 1000 concurrent users
artillery quick --count 1000 --num 50 https://your-app.vercel.app
```

## Debugging

### React DevTools Profiler
```bash
# Install React DevTools extension
# Open DevTools → Profiler tab
# Click Record → Interact with app → Stop
# Analyze component render times
```

### Network Waterfall Analysis
```bash
# Chrome DevTools → Network tab
# Reload page
# Analyze waterfall chart for:
# - Blocking resources
# - Large files
# - Slow requests
# - Unnecessary requests
```

### Performance Timeline
```bash
# Chrome DevTools → Performance tab
# Click Record → Interact with app → Stop
# Analyze:
# - Long tasks (>50ms)
# - Layout thrashing
# - Forced reflows
# - JavaScript execution time
```

## Optimization Scripts

### Remove Unused CSS
```bash
# Install PurgeCSS
npm install -D @fullhuman/postcss-purgecss

# Configure in postcss.config.js
```

### Tree Shaking Check
```bash
# Build and check for unused exports
npm run build
# Review bundle analyzer output
```

### Code Splitting Analysis
```bash
# Check chunk sizes after build
npm run build
ls -lh dist/assets/js/
```

## Continuous Monitoring

### Setup Sentry (Error Tracking)
```bash
npm install @sentry/react

# Add to main.jsx
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: "your-sentry-dsn",
  environment: import.meta.env.MODE,
  tracesSampleRate: 1.0,
});
```

### Setup PostHog (Analytics)
```bash
npm install posthog-js

# Add to main.jsx
import posthog from 'posthog-js';

posthog.init('your-api-key', {
  api_host: 'https://app.posthog.com',
  capture_pageview: true,
  capture_pageleave: true,
});
```

## Quick Fixes

### Fix Memory Leak
```javascript
// Always cleanup in useEffect
useEffect(() => {
  const subscription = someObservable.subscribe();
  
  return () => {
    subscription.unsubscribe(); // Cleanup!
  };
}, []);
```

### Fix Unnecessary Re-renders
```javascript
// Use React.memo
const MyComponent = React.memo(({ data }) => {
  return <div>{data}</div>;
});

// Use useMemo for expensive computations
const expensiveValue = useMemo(() => {
  return computeExpensiveValue(data);
}, [data]);

// Use useCallback for functions
const handleClick = useCallback(() => {
  doSomething(id);
}, [id]);
```

### Fix Slow List Rendering
```javascript
// Use key prop correctly
{items.map(item => (
  <Item key={item.id} data={item} />
))}

// Or use virtual scrolling for large lists
import { FixedSizeList } from 'react-window';
```

## Emergency Performance Fixes

### If Site is Slow
1. Check Supabase dashboard for slow queries
2. Check Vercel analytics for errors
3. Clear CDN cache
4. Check for memory leaks in browser
5. Review recent deployments

### If Database is Slow
1. Run ANALYZE on tables
2. Check for missing indexes
3. Review slow query log
4. Check connection pool usage
5. Consider read replicas

### If Images are Slow
1. Check CDN cache hit rate
2. Verify WebP format is used
3. Check image sizes
4. Enable lazy loading
5. Use image CDN (Cloudinary)

## Useful Links

- [Chrome DevTools Performance](https://developer.chrome.com/docs/devtools/performance/)
- [React Profiler](https://react.dev/reference/react/Profiler)
- [Web Vitals](https://web.dev/vitals/)
- [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci)
- [Bundle Analyzer](https://www.npmjs.com/package/rollup-plugin-visualizer)

---

**Pro Tip:** Run performance audits regularly, not just before deployment!
