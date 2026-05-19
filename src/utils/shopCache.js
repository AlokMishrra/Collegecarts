/**
 * shopCache.js — Production-grade browser cache for CollegeCart
 *
 * ═══════════════════════════════════════════════════════════════
 * ARCHITECTURE  (4-layer stack)
 * ═══════════════════════════════════════════════════════════════
 *
 *  Browser  ──►  CDN (Cloudflare)  ──►  Edge Function  ──►  Postgres
 *
 *  Layer 1 — This file (browser in-memory, per tab)
 *    fresh   0–60s  → serve instantly, zero network
 *    stale  60s–5m  → serve instantly + revalidate silently in bg
 *    expired  >5m   → show skeleton, fetch, render
 *
 *  Layer 2 — CDN  (Cache-Control: s-maxage=60, swr=120)
 *    All 10k users share ONE cached response per CDN PoP.
 *    DB is hit at most ~2–5 times/min regardless of user count.
 *
 *  Layer 3 — Edge Function  (get-shop-data)
 *    Runs only on CDN miss. 2 parallel queries, no row limit.
 *    ETag / 304 support — zero bandwidth when data unchanged.
 *
 *  Layer 4 — Postgres
 *    Only hit on CDN expiry. Indexed on category_id + display_order.
 *
 * ═══════════════════════════════════════════════════════════════
 * RATE LIMIT PROTECTION
 * ═══════════════════════════════════════════════════════════════
 *  • Request deduplication  — 1 in-flight fetch shared by all callers
 *  • Exponential backoff    — 1s → 2s → 4s on edge fn failure
 *  • 429 circuit-breaker    — 30s cooldown on rate-limit response
 *  • DB fallback            — direct query if edge fn unavailable
 *
 * ═══════════════════════════════════════════════════════════════
 * REALTIME — DISABLED FOR REGULAR USERS
 * ═══════════════════════════════════════════════════════════════
 *  Regular users rely on the 60s SWR cycle — no WebSocket connections.
 *  Admin changes are patched surgically via patchProduct / insertProduct
 *  / deleteProduct so the cache stays consistent without a full refetch.
 *  Realtime subscriptions are only opened in the admin dashboard.
 */

import { supabase } from "@/lib/supabase";

// ── TTL ───────────────────────────────────────────────────────────────────
// DISABLED CACHING FOR STOCK ACCURACY
// Stock changes in real-time, caching causes out-of-stock items to show as available
const FRESH_TTL          = 0;           // 0s   — ALWAYS fetch fresh (no cache)
const STALE_TTL          = 0;           // 0s   — ALWAYS fetch fresh (no cache)
const MAX_RETRIES        = 3;
const BASE_BACKOFF_MS    = 1000;        // 1s, 2s, 4s
const RATE_LIMIT_BACKOFF = 30_000;      // 30s cooldown on 429

// ── Exact columns the frontend uses — avoids SELECT * over the wire ───────
const PRODUCT_COLUMNS = [
  "id", "name", "description", "price", "original_price",
  "image_url", "category_id", "is_available", "stock_quantity",
  "hostel_stock", "average_rating", "review_count",
  "available_from", "available_to", "delivery_charge",
  "dhaba_options", "display_order", "created_at",
].join(",");

const CATEGORY_COLUMNS = "id,name,description,image_url,is_active,display_order";

// ── Module-level state (one copy per browser tab) ─────────────────────────
const _state = {
  products:      null,
  categories:    null,
  fetchedAt:     0,
  inflight:      null,   // deduplication — shared Promise
  failCount:     0,
  rateLimitedAt: 0,
  lastEtag:      null,
};

// ── Cache version — bump this when the edge function changes ──────────────
// On mismatch the browser cache is discarded and a fresh fetch is forced.
const CACHE_VERSION = "v6-no-cache-stock"; // CACHING DISABLED - Stock accuracy critical
const _storedVersion = sessionStorage.getItem("cc_cache_version");
if (_storedVersion !== CACHE_VERSION) {
  // Old cache is from a different version — discard it
  sessionStorage.setItem("cc_cache_version", CACHE_VERSION);
  // Clear all cached data immediately
  invalidateCache();
}

// ── Cache status ──────────────────────────────────────────────────────────
export function getCacheStatus() {
  if (!_state.products || !_state.categories) return "empty";
  const age = Date.now() - _state.fetchedAt;
  if (age < FRESH_TTL)  return "fresh";
  if (age < STALE_TTL)  return "stale";
  return "expired";
}

export function getCachedData() {
  return {
    products:   _state.products   ?? [],
    categories: _state.categories ?? [],
  };
}

export function setCache(products, categories) {
  _state.products   = products;
  _state.categories = categories;
  _state.fetchedAt  = Date.now();
  _state.inflight   = null;
  _state.failCount  = 0;
}

export function invalidateCache() {
  _state.products   = null;
  _state.categories = null;
  _state.fetchedAt  = 0;
  _state.inflight   = null;
  _state.lastEtag   = null;
  // intentionally keep failCount / rateLimitedAt — circuit-breaker state
  console.log('[shopCache] Cache invalidated - will fetch fresh data');
}

// ── Helpers ───────────────────────────────────────────────────────────────
function isRateLimited() {
  return Date.now() - _state.rateLimitedAt < RATE_LIMIT_BACKOFF;
}
function backoffDelay(attempt) {
  return BASE_BACKOFF_MS * Math.pow(2, attempt);
}

// ── PRIMARY: Edge Function (CDN-cached) ───────────────────────────────────
async function fetchFromEdge() {
  const headers = {
    apikey:        import.meta.env.VITE_SUPABASE_ANON_KEY,
    Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    Accept:        "application/json",
  };
  if (_state.lastEtag) headers["If-None-Match"] = _state.lastEtag;

  // bust=3 forces a new CDN cache key after the edge fn was redeployed.
  // Increment this whenever the edge function is redeployed.
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-shop-data?bust=3`,
    { headers }
  );

  if (res.status === 429) {
    _state.rateLimitedAt = Date.now();
    throw new Error("RATE_LIMITED");
  }
  if (!res.ok) throw new Error(`Edge fn ${res.status}`);

  // 304 Not Modified — existing cache is still valid
  if (res.status === 304) return getCachedData();

  const etag = res.headers.get("etag");
  if (etag) _state.lastEtag = etag;

  const data = await res.json();
  if (data.error) throw new Error(data.error);

  return {
    products:   data.products   ?? [],
    categories: data.categories ?? [],
  };
}

// ── FALLBACK: Direct Supabase DB (edge fn unavailable) ────────────────────
// Uses exact column list — no SELECT *, keeps payload tight.
async function fetchFromDB() {
  const [pr, cr] = await Promise.all([
    supabase
      .from("products")
      .select(PRODUCT_COLUMNS)
      .order("display_order", { ascending: true, nullsFirst: false }),
    supabase
      .from("categories")
      .select(CATEGORY_COLUMNS)
      .eq("is_active", true)
      .order("display_order", { ascending: true }),
  ]);

  if (pr.error) throw new Error(`DB products: ${pr.error.message}`);
  if (cr.error) throw new Error(`DB categories: ${cr.error.message}`);

  return {
    products:   (pr.data ?? []).map(p => ({ ...p, created_date: p.created_at })),
    categories: (cr.data ?? []).map(c => ({ ...c, created_date: c.created_at })),
  };
}

// ── Retry + fallback orchestration ────────────────────────────────────────
async function fetchWithFallback() {
  if (!isRateLimited()) {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const result = await fetchFromEdge();
        _state.failCount = 0;
        return result;
      } catch (err) {
        if (err.message === "RATE_LIMITED" || attempt === MAX_RETRIES - 1) break;
        await new Promise(r => setTimeout(r, backoffDelay(attempt)));
      }
    }
  }
  console.warn("[shopCache] Edge fn unavailable — falling back to DB");
  _state.failCount++;
  return fetchFromDB();
}

// ── Public: deduplicated fetch ────────────────────────────────────────────
/**
 * The ONLY external entry point for fetching shop data.
 * If 50 components call this simultaneously, exactly 1 network request fires.
 * All 50 share the same Promise and resolve together.
 */
export function deduplicatedFetch() {
  if (_state.inflight) return _state.inflight;

  _state.inflight = fetchWithFallback()
    .then(({ products, categories }) => {
      setCache(products, categories);
      return { products, categories };
    })
    .catch(err => {
      _state.inflight = null;
      throw err;
    });

  return _state.inflight;
}

// ── Surgical cache patches (admin realtime only) ──────────────────────────
// Called from admin dashboard realtime channel — NOT from user-facing pages.
export function patchProduct(updated) {
  if (!_state.products) return;
  _state.products = _state.products.map(p =>
    p.id === updated.id ? { ...p, ...updated } : p
  );
}
export function insertProduct(product) {
  if (!_state.products) return;
  if (_state.products.some(p => p.id === product.id)) return;
  _state.products = [product, ..._state.products];
}
export function deleteProduct(productId) {
  if (!_state.products) return;
  _state.products = _state.products.filter(p => p.id !== productId);
}
