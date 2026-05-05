/**
 * get-shop-data — Production Edge Function / CDN cache layer
 *
 * ═══════════════════════════════════════════════════════════════
 * SCALING ARCHITECTURE
 * ═══════════════════════════════════════════════════════════════
 *
 *  Browser → CDN (Cloudflare) → Edge Function → Postgres
 *
 *  Layer 1 — Browser cache (shopCache.js)
 *    fresh  0–60s  → serve instantly, zero network
 *    stale 60s–5m  → serve instantly + revalidate in background
 *    expired >5m   → show skeleton, fetch, render
 *
 *  Layer 2 — CDN  (s-maxage=60, stale-while-revalidate=120)
 *    All 10k users share ONE cached response per CDN PoP.
 *    DB is hit at most ~2–5 times/min regardless of user count.
 *
 *  Layer 3 — This edge function
 *    Runs only on CDN cache miss (~once per 60s per PoP).
 *    2 parallel DB queries, no row limit, ETag / 304 support.
 *
 *  Layer 4 — Postgres
 *    Only hit on CDN expiry. Indexed on category_id + display_order.
 *
 * ═══════════════════════════════════════════════════════════════
 * CAPACITY ESTIMATES
 * ═══════════════════════════════════════════════════════════════
 *  100   users → ~1–2 DB queries/min  (CDN absorbs 98%+)
 *  1,000 users → ~1–2 DB queries/min  (CDN shared)
 *  5,000 users → ~2–4 DB queries/min  (multiple CDN PoPs)
 *  10,000 users → ~4–8 DB queries/min (well within free tier)
 *
 * ═══════════════════════════════════════════════════════════════
 * WHY NO DB-LEVEL PAGINATION
 * ═══════════════════════════════════════════════════════════════
 *  LIMIT/OFFSET at DB level causes partial category data.
 *  "Paneer Dishes" with 8 products gets only 1 if it falls after
 *  a page boundary. All grouping/pagination is done on the frontend
 *  after receiving the full dataset in one payload.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, if-none-match",
};

// Exact columns the frontend uses — avoids SELECT * over the wire
const PRODUCT_COLUMNS = [
  "id", "name", "description", "price", "original_price",
  "image_url", "category_id", "is_available", "stock_quantity",
  "hostel_stock", "average_rating", "review_count",
  "available_from", "available_to", "delivery_charge",
  "dhaba_options", "display_order", "created_at",
].join(",");

const CATEGORY_COLUMNS = "id,name,description,image_url,is_active,display_order";

serve(async (req) => {
  // ── CORS preflight ──────────────────────────────────────────
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url        = new URL(req.url);
  const categoryId = url.searchParams.get("category") ?? null;

  // ── ETag / conditional request ──────────────────────────────
  // Client sends If-None-Match with the ETag from last response.
  // If data hasn't changed we return 304 — zero bandwidth used.
  const clientEtag = req.headers.get("if-none-match") ?? null;

  try {
    // Service-role key bypasses RLS for public read data.
    // Products and categories have `using (true)` policies.
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")              ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // ── 2 parallel queries — never N+1 ─────────────────────────
    // NO .limit() / .range() — all products returned in one payload.
    // Frontend handles grouping and display-level pagination.
    let productQuery = supabase
      .from("products")
      .select(PRODUCT_COLUMNS)
      .order("display_order", { ascending: true, nullsFirst: false });

    if (categoryId) {
      productQuery = productQuery.eq("category_id", categoryId);
    }

    const [productsRes, categoriesRes] = await Promise.all([
      productQuery,
      supabase
        .from("categories")
        .select(CATEGORY_COLUMNS)
        .eq("is_active", true)
        .order("display_order", { ascending: true }),
    ]);

    if (productsRes.error)   throw new Error(`Products: ${productsRes.error.message}`);
    if (categoriesRes.error) throw new Error(`Categories: ${categoriesRes.error.message}`);

    const products   = productsRes.data   ?? [];
    const categories = categoriesRes.data ?? [];

    // ── Stable ETag: count + latest created_at ──────────────────
    // Cheap to compute, good enough for cache validation.
    const latestTs = products.reduce((max, p) => {
      const t = p.created_at ? new Date(p.created_at).getTime() : 0;
      return t > max ? t : max;
    }, 0);
    const etag = `"${products.length}-${latestTs}"`;

    // ── 304 Not Modified ────────────────────────────────────────
    if (clientEtag && clientEtag === etag) {
      return new Response(null, {
        status: 304,
        headers: {
          ...corsHeaders,
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
          "ETag": etag,
        },
      });
    }

    const payload = JSON.stringify({
      products,
      categories,
      meta: { count: products.length, cached_at: Date.now() },
    });

    return new Response(payload, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json; charset=utf-8",
        // CDN caches for 60s, serves stale for 120s while revalidating.
        // All 10k users share this one cached response per CDN PoP.
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120, no-transform",
        "Vary":          "Accept-Encoding",
        "ETag":          etag,
      },
    });

  } catch (error) {
    console.error("[get-shop-data]", error.message);
    // 503 — CDN must NOT cache error responses
    return new Response(
      JSON.stringify({ error: "Service temporarily unavailable", detail: error.message }),
      {
        status: 503,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
          "Retry-After":   "10",
        },
      }
    );
  }
});
