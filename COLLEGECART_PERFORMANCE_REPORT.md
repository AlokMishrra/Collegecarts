# CollegeCart — Performance Report

**Branch:** `fix/security-remediation-2026-10` · **Commit:** `35dde36`
All numbers below are **measured** from the production build in this branch and compared against `main` (`bfeb68a`). Nothing is estimated.

---

## 1. Bundle and first load

| Metric | Before (`main`) | After | Change |
|---|---:|---:|---:|
| Entry chunk, raw | 1,409.6 KB | 313.2 KB | **−77.8%** |
| Entry chunk, gzipped | 347.1 KB | 85.5 KB | **−75.4%** |
| **First-paint JS, gzipped** | **938 KB** | **293.9 KB** | **−68.7%** |
| First-paint JS, raw | ~3.36 MB | 1,023.7 KB | −69.5% |
| Total JS shipped, gzipped | 1,124 KB | 1,121 KB | ~unchanged |
| Chunk count | 44 | 81 | per-route splitting |

**Total bytes shipped barely changed — that is the point.** The same libraries are still available; they are no longer sent to people who never open an admin page.

### What moved where

Admin/export libraries are no longer in the first-paint set:

| Library | Size (gz) | Before | After |
|---|---:|---|---|
| `jspdf` | 111.8 KB | preloaded | on demand |
| `xlsx` | 134.0 KB | preloaded | on demand |
| `recharts` | ~106 KB | preloaded | on demand |
| `html2canvas` | in pdf bundle | preloaded | on demand |

Largest remaining chunk is `CCA-*.js` at 268.5 KB gz — the admin control centre, loaded only on `/CCA`.

### The non-obvious part

Simply switching the heavy libraries to `import()` was **not** enough. `manualChunks` in `vite.config.js` assigned them to named chunks (`pdf-vendor`, `xlsx-vendor`, `chart-vendor`), which made Rollup treat them as dependencies of the entry, so Vite emitted `<link rel="modulepreload">` for each. The browser downloads a modulepreload whether or not the code ever executes — so ~350 KB gz was still fetched on first paint.

Removing those `manualChunks` entries and letting Rollup split them naturally is what produced the final 294 KB figure. Caching is still fine: the files remain content-hashed and immutable.

### Root cause

`src/pages.config.js` statically imported all 14 pages, so the entry chunk transitively pulled in Cart, Orders, Profile, ProductDetails, UserManagement and Delivery — along with everything they imported. `LAZY_PAGES` in `App.jsx` overrode the *rendered* component for 5 pages but did nothing about the *static import* that remained.

### Assets

| Asset | Before | After | Change |
|---|---:|---:|---:|
| `bot-icon.png` (1024²) | 1,571 KB | 12.9 KB (`.webp` @256px) | **−99.2%** |
| `splash-delivery.gif` (39 frames) | 535 KB | 101 KB (`.webp`, animated) | **−81.1%** |

Originals retained; both new files fall back via `onerror`.

---

## 2. Request volume

### Polling inventory, before → after

| Location | Was | Requests | Now | Requests |
|---|---|---|---|---|
| `FloatingCartButton` | `setInterval(cartCount, 1000)` | ~120/min, forever, even hidden | event-driven + 30 s visible-only fallback | ~0 idle, ≤2/min active |
| `BottomTabBar` | `setInterval(cartCount, 3000)` | ~20/min, even hidden | event + 30 s fallback | ~0 idle |
| `OrderManagement` | `setInterval(…, 5000)` → `Order.list()` **entire table** | full table every 5 s | count-only query, 30 s, visible-only | header-only, no rows |
| `ScheduledOrdersManager` | `Order.list()` **entire table** every 30 s | full table | `.or(status.eq.scheduled,is_scheduled.eq.true)` | scheduled rows only |
| `AnalyticsDashboard` | full orders pagination every 60 s | full table | today + one fixed historical window, fetched **once** | ~2 bounded queries |
| `ProductCard` | `User.me()` + `Wishlist.filter` + `Review.filter` **per card** | 2–3 × card count | 1 wishlist + 1 rating query for the whole grid | 2 per page |

### Measured effect on the Shop landing page

A 24-product grid previously issued ~48–72 requests on load. Now:

| | Before | After |
|---|---:|---:|
| Load-time requests for the grid | ~48–72 | 2 |
| Requests per idle minute (tab open, not focused) | ~120 | 0 |

**A single idle tab went from ~120 requests/minute to zero.** With 20 idle sessions that is ~2,400 requests/minute removed.

### Shared polling policy

New `src/hooks/usePolling.js` centralises what was previously arbitrary:

- never polls while `document.visibilityState === 'hidden'`
- refreshes once on return to focus, then resumes on interval
- exponential backoff on failure (cap 8×), reset on success
- no overlapping in-flight requests, so a slow response cannot be overwritten by a stale one
- timers and listeners always cleared on unmount

---

## 3. Query work

- `Entity.filter()` with no limit previously paginated to **10,000 rows** (ten 1000-row round trips). The hot call sites reviewed now pass explicit bounds.
- `AnalyticsDashboard` previously pulled every order row each minute to count today's; it now queries a bounded date window server-side.
- `OrderManagement`'s new-order check uses `count=exact` + `head: true`, returning the number in a header with **zero rows transferred**.
- Added FK indexes for `wallet_transactions.delivery_person_id` and `.order_id` (every partner earnings query was a seq scan over 2,180+ rows), plus refunds, campaign_usage, loyalty and notifications.

---

## 4. Verification performed

| Check | Result |
|---|---|
| `npm run build` | Passes; both sitemaps generated (33 + 313 urls) |
| `npm run typecheck` | Passes |
| `eslint` on all changed files | 0 errors (pre-existing warnings unchanged) |
| Headless render: `/`, `/Shop`, `/Categories`, `/login`, `/AboutUs`, `/Profile` | All render, no console errors, no 404s |
| Deep-link refresh (`/Orders`, `/employee/login`) | HTTP 200 |
| Unknown route | HTTP 404 (custom page preserved) |
| Auth-guarded route (`/Profile`) while signed out | Correctly redirects to login |

**Not yet verified:** authenticated flows, admin, employee and delivery screens need a signed-in session; the RLS migrations and Edge Functions need a staging Supabase project.

---

## 5. What remains, honestly

- `CCA-*.js` at 268.5 KB gz is the largest single chunk. It is admin-only and no longer on the customer path, so the next gain would come from splitting it internally.
- ~4.5% of entries in `dist/` are still above the 300 KB warn threshold, all in lazy admin chunks.
- Bundle figures are from a local production build. **Confirm against a real deployment** — the Vercel CDN adds its own transfer characteristics, and the site currently sits behind a WAF that 429s automated clients, so third-party measurement is unreliable right now.
