import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSEO } from "@/lib/useSEO";
import { base44 } from "@/api/base44Client";
import { CartItem } from "@/entities/CartItem";
import { User } from "@/entities/User";
import { supabase } from "@/lib/supabase";
import { logErrorToDB } from "@/utils/supabaseWithLogging";
import { notifyCartUpdate } from "@/utils/cartEvents";
import {
  getCacheStatus, getCachedData,
  deduplicatedFetch, invalidateCache,
} from "@/utils/shopCache";
import { toast } from "sonner";
import { Building2, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import QuickAddToCart      from "../components/shop/QuickAddToCart";
import EnhancedShopHero    from "../components/shop/EnhancedShopHero";
import CategorySection     from "../components/shop/CategorySection";
import CategoryFilter      from "../components/shop/CategoryFilter";
import ProductCard         from "../components/shop/ProductCard";
import HostelSelector      from "../components/shop/HostelSelector";
import RecommendationEngine from "../components/shop/RecommendationEngine";
import EnhancedSearch      from "../components/shop/EnhancedSearch";
import BannerCarousel      from "../components/shop/BannerCarousel";
import ComboSection        from "../components/shop/ComboSection";

// ── Cart write debounce config ────────────────────────────────────────────
// Batches rapid +/- taps into a single DB write per product.
// e.g. user taps + 5 times quickly → 1 DB write with quantity=5
const CART_DEBOUNCE_MS = 400;

// ── Per-user action rate limit ────────────────────────────────────────────
// Prevents spam: max N cart actions per window
const RATE_LIMIT_MAX    = 20;   // max actions
const RATE_LIMIT_WINDOW = 10_000; // per 10s window

export default function Shop() {
  const [products, setProducts]                 = useState([]);
  const [categories, setCategories]             = useState([]);
  const [searchQuery, setSearchQuery]           = useState("");
  const [isLoading, setIsLoading]               = useState(true);
  const [user, setUser]                         = useState(null);
  const [cartItems, setCartItems]               = useState([]);
  const [categorizedProducts, setCategorizedProducts] = useState({});
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [showHostelSelector, setShowHostelSelector] = useState(false);
  const [filters, setFilters] = useState({
    availability: "all",
    rating:       "all",
    priceRange:   [0, 1000],
  });
  const [sortBy, setSortBy] = useState("relevance");

  // Infinite scroll
  const [displayedProducts, setDisplayedProducts] = useState([]);
  const [page, setPage]           = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore]     = useState(true);
  const observerTarget            = useRef(null);
  const PRODUCTS_PER_PAGE         = 12;

  // ── Debounced cart write refs ─────────────────────────────────────────
  // pendingCart: { [productId]: { quantity, timer, existingItemId } }
  const pendingCart = useRef({});

  // ── Rate limiter state ────────────────────────────────────────────────
  const rateLimitRef = useRef({ count: 0, windowStart: Date.now() });

  // ── Mount: load data + user (NO realtime for regular users) ──────────
  useEffect(() => {
    useSEO({
      title: "Shop – Groceries, Snacks & Essentials",
      description: "Order groceries, snacks, beverages, and daily essentials for delivery to your hostel room in 10 minutes. Student-friendly prices. CollegeCart.",
      url: "/Shop",
    });

    const abortController = new AbortController();
    checkUser();
    loadData(abortController.signal);

    // Invalidate cache on logout (cross-tab)
    const handleStorageChange = () => {
      if (!localStorage.getItem("sb-collegecart-auth")) invalidateCache();
    };
    window.addEventListener("storage", handleStorageChange);

    return () => {
      abortController.abort();
      window.removeEventListener("storage", handleStorageChange);
      // Flush any pending debounced cart writes on unmount
      Object.values(pendingCart.current).forEach(p => {
        clearTimeout(p.timer);
        if (p.flush) p.flush();
      });
    };
  }, []);

  // ── Group products by category (in-stock first per category) ─────────
  useEffect(() => {
    const categorized = {};
    categories.forEach(cat => {
      categorized[cat.id] = [...products]
        .filter(p => p.category_id === cat.id)
        .sort((a, b) => {
          const aS = a.stock_quantity || 0, bS = b.stock_quantity || 0;
          if (aS > 0 && bS === 0) return -1;
          if (aS === 0 && bS > 0) return 1;
          return (a.display_order || 0) - (b.display_order || 0);
        });
    });
    setCategorizedProducts(categorized);
  }, [products, categories]);

  // ── Infinite scroll slice ─────────────────────────────────────────────
  useEffect(() => {
    const filtered = applyFiltersAndSort(products);
    setDisplayedProducts(filtered.slice(0, PRODUCTS_PER_PAGE));
    setPage(1);
    setHasMore(filtered.length > PRODUCTS_PER_PAGE);
  }, [products, searchQuery, selectedCategory, filters, sortBy]);

  // ── IntersectionObserver ──────────────────────────────────────────────
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting && hasMore && !isLoadingMore) loadMoreProducts(); },
      { threshold: 0.1 }
    );
    if (observerTarget.current) observer.observe(observerTarget.current);
    return () => { if (observerTarget.current) observer.unobserve(observerTarget.current); };
  }, [hasMore, isLoadingMore, page]);

  const loadMoreProducts = () => {
    setIsLoadingMore(true);
    const filtered = applyFiltersAndSort(products);
    const start = page * PRODUCTS_PER_PAGE;
    const end   = start + PRODUCTS_PER_PAGE;
    setTimeout(() => {
      setDisplayedProducts(prev => [...prev, ...filtered.slice(start, end)]);
      setPage(p => p + 1);
      setHasMore(end < filtered.length);
      setIsLoadingMore(false);
    }, 300);
  };

  // ── User ──────────────────────────────────────────────────────────────
  const checkUser = async () => {
    try {
      const currentUser = await User.me();
      setUser(currentUser);
      if (!currentUser.selected_hostel) setShowHostelSelector(true);
      loadCartItems(currentUser.id);
    } catch {
      // not logged in
    }
  };

  const handleHostelSelected = hostel => {
    setShowHostelSelector(false);
    setUser(prev => ({ ...prev, selected_hostel: hostel }));
    invalidateCache();
    loadData();
  };

  // ── Stock helpers ─────────────────────────────────────────────────────
  const getHostelStock = useCallback((product) => {
    if (!user?.selected_hostel || user.selected_hostel === "Other")
      return product.stock_quantity || 0;
    if (product.hostel_stock && typeof product.hostel_stock[user.selected_hostel] === "number")
      return product.hostel_stock[user.selected_hostel];
    return product.stock_quantity || 0;
  }, [user]);

  const isProductInStock = useCallback((product) => {
    const stock = getHostelStock(product);
    if (product.available_from && product.available_to) {
      try {
        const now = new Date();
        const cur = now.getHours() * 60 + now.getMinutes();
        const parse = t => {
          if (!t) return null;
          const m12 = t.match(/(\d+):(\d+)\s*(AM|PM)/i);
          if (m12) {
            let h = parseInt(m12[1], 10);
            const min = parseInt(m12[2], 10);
            if (m12[3].toUpperCase() === "PM" && h !== 12) h += 12;
            if (m12[3].toUpperCase() === "AM" && h === 12) h = 0;
            return h * 60 + min;
          }
          const m24 = t.match(/^(\d{1,2}):(\d{2})$/);
          return m24 ? parseInt(m24[1], 10) * 60 + parseInt(m24[2], 10) : null;
        };
        const from = parse(product.available_from);
        const to   = parse(product.available_to);
        if (from !== null && to !== null && !(cur >= from && cur <= to)) return false;
      } catch { /* ignore */ }
    }
    return stock > 0;
  }, [getHostelStock]);

  // ── Data loading — SWR via edge function (CDN-cached) ─────────────────
  /**
   * loadData implements Stale-While-Revalidate:
   *   fresh  → serve cache instantly, no network
   *   stale  → serve cache instantly + revalidate in background
   *   empty/expired → show skeleton, fetch, render
   *
   * Primary path: Edge Function (CDN s-maxage=60)
   * Fallback path: Direct DB (handled inside deduplicatedFetch)
   * All 10k users share the CDN response — DB hit ≤ 5 times/min.
   */
  const applyData = useCallback((rawProducts, rawCategories) => {
    // Sort all products: in-stock first, then by display_order.
    // Do NOT filter by activeCatIds — that was silently dropping products
    // whose category_id didn't match the is_active=true categories list.
    // CategorySection only renders categories that have products, so
    // products with no matching active category simply won't appear.
    const sorted = [...rawProducts].sort((a, b) => {
      const aS = a.stock_quantity || 0, bS = b.stock_quantity || 0;
      if (aS > 0 && bS === 0) return -1;
      if (aS === 0 && bS > 0) return 1;
      return (a.display_order || 0) - (b.display_order || 0);
    });

    if (import.meta.env.DEV) {
      const counts = {};
      sorted.forEach(p => { counts[p.category_id] = (counts[p.category_id] || 0) + 1; });
      rawCategories.forEach(c =>
        console.debug(`[Shop] "${c.name}": ${counts[c.id] || 0} products`)
      );
      console.debug(`[Shop] Total: ${sorted.length} products, ${rawCategories.length} categories`);
    }

    setProducts(sorted);
    setCategories(rawCategories);
  }, []);

  const loadData = useCallback(async (signal) => {
    const status = getCacheStatus();

    // Serve stale data immediately — zero perceived latency
    if (status === "fresh" || status === "stale") {
      const { products: p, categories: c } = getCachedData();
      applyData(p, c);
      setIsLoading(false);

      if (status === "stale") {
        // Revalidate silently in background
        deduplicatedFetch()
          .then(({ products: p2, categories: c2 }) => {
            if (!signal?.aborted) applyData(p2, c2);
          })
          .catch(() => {}); // user already has stale data — silent fail
      }
      return;
    }

    // Cache empty or expired — must fetch before showing content
    setIsLoading(true);
    try {
      const { products: p, categories: c } = await deduplicatedFetch();
      if (signal?.aborted) return;
      applyData(p, c);
    } catch (err) {
      if (signal?.aborted) return;
      await logErrorToDB("API", err.message, "/shop", err.stack).catch(() => {});
      console.error("[Shop] load failed:", err);
      toast.error("Failed to load products. Please refresh.");
    }
    if (!signal?.aborted) setIsLoading(false);
  }, [applyData]);

  // ── Cart ──────────────────────────────────────────────────────────────
  const loadCartItems = async (userId) => {
    try {
      const items = await CartItem.filter({ user_id: userId }, "-created_date", 50).catch(() => []);
      setCartItems(items);
    } catch (err) {
      await logErrorToDB("API", err.message, "/shop/cart", err.stack).catch(() => {});
      setCartItems([]);
    }
  };

  // ── Rate limiter ──────────────────────────────────────────────────────
  const checkRateLimit = useCallback(() => {
    const rl = rateLimitRef.current;
    const now = Date.now();
    if (now - rl.windowStart > RATE_LIMIT_WINDOW) {
      rl.count = 0;
      rl.windowStart = now;
    }
    if (rl.count >= RATE_LIMIT_MAX) {
      toast.warning("Slow down — too many actions. Please wait a moment.");
      return false;
    }
    rl.count++;
    return true;
  }, []);

  // ── Debounced cart write ──────────────────────────────────────────────
  /**
   * Instead of writing to DB on every tap, we accumulate quantity changes
   * for 400ms and then fire a single DB write. This reduces DB writes by
   * ~80% for users who tap + multiple times quickly.
   */
  const flushCartWrite = useCallback(async (productId, targetQty, existingItemId) => {
    delete pendingCart.current[productId];
    try {
      if (targetQty <= 0 && existingItemId) {
        await CartItem.delete(existingItemId);
      } else if (existingItemId) {
        await CartItem.update(existingItemId, { quantity: targetQty });
      } else if (targetQty > 0) {
        const created = await CartItem.create({
          product_id: productId,
          user_id: user.id,
          quantity: targetQty,
        });
        // Replace temp id with real id
        if (created) {
          setCartItems(prev => prev.map(item =>
            item.id?.toString().startsWith("temp-") && item.product_id === productId
              ? { ...item, id: created.id }
              : item
          ));
        }
      }
      notifyCartUpdate();
      // Background sync to confirm DB state
      setTimeout(() => loadCartItems(user.id), 600);
    } catch (err) {
      await logErrorToDB("API", err.message, "/shop/cart/write", err.stack).catch(() => {});
      console.error("[Cart] write failed:", err);
      // Revert optimistic update
      loadCartItems(user.id);
    }
  }, [user]);

  const updateCartQuantity = useCallback(async (product, quantityChange) => {
    if (!user) { navigate('/login'); return; }
    if (!checkRateLimit()) return;

    if (quantityChange > 0 && !isProductInStock(product)) {
      toast.error(`${product.name} is currently out of stock`);
      return;
    }

    const existingItem = cartItems.find(i => i.product_id === product.id);
    const hostelStock  = getHostelStock(product);
    const currentQty   = existingItem?.quantity ?? 0;
    const newQty       = currentQty + quantityChange;

    if (newQty > hostelStock && quantityChange > 0) {
      toast.warning(`Only ${hostelStock} unit${hostelStock === 1 ? "" : "s"} available`);
      return;
    }

    // ── Optimistic UI update ──────────────────────────────────
    if (newQty <= 0) {
      setCartItems(prev => prev.filter(i => i.product_id !== product.id));
    } else if (existingItem) {
      setCartItems(prev => prev.map(i =>
        i.product_id === product.id ? { ...i, quantity: newQty } : i
      ));
    } else {
      setCartItems(prev => [...prev, {
        id:           "temp-" + Date.now(),
        product_id:   product.id,
        user_id:      user.id,
        quantity:     1,
        product_name: product.name,
        price:        product.price,
        created_date: new Date().toISOString(),
      }]);
    }

    // ── Debounced DB write ────────────────────────────────────
    const pending = pendingCart.current[product.id];
    if (pending) clearTimeout(pending.timer);

    const targetQty    = newQty;
    const existingId   = existingItem?.id ?? pending?.existingItemId ?? null;
    const timer = setTimeout(
      () => flushCartWrite(product.id, targetQty, existingId),
      CART_DEBOUNCE_MS
    );
    pendingCart.current[product.id] = {
      timer,
      existingItemId: existingId,
      flush: () => flushCartWrite(product.id, targetQty, existingId),
    };
  }, [user, cartItems, getHostelStock, isProductInStock, checkRateLimit, flushCartWrite]);

  const addToCart = useCallback(product => updateCartQuantity(product, 1), [updateCartQuantity]);

  const getCartQuantity = useCallback(productId => {
    const item = cartItems.find(i => i.product_id === productId);
    return item?.quantity ?? 0;
  }, [cartItems]);

  // ── Filters + sort ────────────────────────────────────────────────────
  const applyFiltersAndSort = useCallback((list) => {
    let out = [...list];

    if (searchQuery.trim()) {
      const terms = searchQuery.toLowerCase().split(" ");
      out = out.filter(p => {
        const text = `${p.name} ${p.description || ""}`.toLowerCase();
        return terms.some(t => text.includes(t));
      });
    }
    if (selectedCategory) out = out.filter(p => p.category_id === selectedCategory);
    out = out.filter(p => p.price >= filters.priceRange[0] && p.price <= filters.priceRange[1]);

    if (filters.availability === "in_stock") {
      out = out.filter(p => {
        if (user?.selected_hostel && user.selected_hostel !== "Other")
          return (p.hostel_stock?.[user.selected_hostel] || 0) > 0;
        return p.stock_quantity > 0;
      });
    }
    if (filters.rating !== "all") {
      const min = parseFloat(filters.rating);
      out = out.filter(p => (p.average_rating || 0) >= min);
    }

    switch (sortBy) {
      case "price_low":  out.sort((a, b) => a.price - b.price); break;
      case "price_high": out.sort((a, b) => b.price - a.price); break;
      case "rating":     out.sort((a, b) => (b.average_rating || 0) - (a.average_rating || 0)); break;
      default: break;
    }
    return out;
  }, [searchQuery, selectedCategory, filters, sortBy, user]);

  const filteredProducts = useMemo(
    () => applyFiltersAndSort(products),
    [products, applyFiltersAndSort]
  );

  // ── Render ────────────────────────────────────────────────────────────
  const isFiltered = searchQuery.trim() || selectedCategory ||
    filters.availability !== "all" || filters.rating !== "all" || sortBy !== "relevance";

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto space-y-8 pb-tab-bar page-enter">

        {showHostelSelector && (
          <HostelSelector
            onHostelSelected={handleHostelSelected}
            onClose={() => setShowHostelSelector(false)}
            currentHostel={user?.selected_hostel}
          />
        )}

        <EnhancedShopHero />
        <BannerCarousel />

        <ComboSection onAddComboToCart={async (combo) => {
          if (!user) { await base44.auth.redirectToLogin(); return; }
          const { CartItem: CI } = await import("@/entities/CartItem");
          for (const pid of (combo.product_ids || [])) {
            const existing = cartItems.find(i => i.product_id === pid);
            if (existing) await CI.update(existing.id, { quantity: existing.quantity + 1 });
            else await CI.create({ product_id: pid, user_id: user.id, quantity: 1 });
          }
          notifyCartUpdate();
          loadCartItems(user.id);
        }} />

        {user?.selected_hostel && (
          <div className="flex items-center justify-between bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                <Building2 className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-gray-600">Delivering to</p>
                <p className="text-sm font-semibold text-gray-900">{user.selected_hostel} Hostel</p>
              </div>
            </div>
            <Button
              variant="outline" size="sm"
              onClick={() => setShowHostelSelector(true)}
              className="border-emerald-300 text-emerald-700 hover:bg-emerald-100 rounded-full px-4"
            >
              Change
            </Button>
          </div>
        )}

        <EnhancedSearch
          products={products}
          onSearch={setSearchQuery}
          filters={filters}
          onFilterChange={setFilters}
          sortBy={sortBy}
          onSortChange={setSortBy}
        />

        <CategoryFilter
          categories={categories}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
        />

        {!isFiltered && user && (
          <RecommendationEngine
            user={user}
            onAddToCart={addToCart}
            onUpdateQuantity={updateCartQuantity}
            getCartQuantity={getCartQuantity}
            context="shop"
          />
        )}

        {/* ── Loading skeleton ── */}
        {isLoading ? (
          <div className="space-y-10">
            {Array(3).fill(0).map((_, i) => (
              <div key={i} className="space-y-4">
                <Skeleton className="h-10 w-64 mb-6 rounded-xl" />
                <div className="flex gap-4">
                  {Array(5).fill(0).map((_, j) => (
                    <Skeleton key={j} className="h-56 w-40 flex-shrink-0 rounded-2xl" />
                  ))}
                </div>
              </div>
            ))}
          </div>

        /* ── Filtered / search view ── */
        ) : isFiltered ? (
          <div className="space-y-4">
            {filteredProducts.length === 0 ? (
              <Card className="p-12 text-center">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <ShoppingBag className="w-10 h-10 text-gray-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No products found</h3>
                <p className="text-gray-600">Try adjusting your filters or search terms</p>
              </Card>
            ) : (
              <>
                <p className="text-sm text-gray-600">
                  Found <span className="font-semibold text-gray-900">{filteredProducts.length}</span> products
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {displayedProducts.map(product => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      cartQuantity={getCartQuantity(product.id)}
                      onAddToCart={addToCart}
                      onUpdateQuantity={updateCartQuantity}
                      hostelStock={getHostelStock(product)}
                      isInStock={isProductInStock(product)}
                    />
                  ))}
                </div>
                {hasMore && (
                  <div ref={observerTarget} className="py-8">
                    {isLoadingMore && (
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                        {Array(4).fill(0).map((_, i) => (
                          <div key={i} className="animate-pulse">
                            <div className="bg-gray-200 h-48 rounded-2xl mb-3" />
                            <div className="bg-gray-200 h-4 rounded mb-2" />
                            <div className="bg-gray-200 h-4 w-2/3 rounded" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

        /* ── Category sections (default view) ── */
        ) : (
          <div className="space-y-12">
            {categories
              .filter(cat => (categorizedProducts[cat.id] || []).length > 0)
              .map(cat => (
                <CategorySection
                  key={cat.id}
                  category={cat}
                  products={categorizedProducts[cat.id] || []}
                  onAddToCart={addToCart}
                  onUpdateQuantity={updateCartQuantity}
                  getCartQuantity={getCartQuantity}
                  getHostelStock={getHostelStock}
                  isProductInStock={isProductInStock}
                />
              ))}
          </div>
        )}

        {user && cartItems.length > 0 && <QuickAddToCart cartItems={cartItems} />}
      </div>
    </div>
  );
}
