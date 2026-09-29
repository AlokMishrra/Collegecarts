import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useSEO } from "@/lib/useSEO";
import { ROUTE_META } from "@/route-meta";
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
import { enrichProductsWithHostelStock, getDisplayStock, isProductInStock as stockIsInStock } from "@/utils/hostelStockHelper";
import { toast } from "sonner";
import { ShoppingBag } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import CartPopup           from "../components/CartPopup";
import EnhancedShopHero    from "../components/shop/EnhancedShopHero";
import CategorySection     from "../components/shop/CategorySection";
import CategoryFilter      from "../components/shop/CategoryFilter";
import ProductCard         from "../components/shop/ProductCard";
import HostelSelector      from "../components/shop/HostelSelector";
import RecommendationEngine from "../components/shop/RecommendationEngine";
import EnhancedSearch      from "../components/shop/EnhancedSearch";
import BannerCarousel      from "../components/shop/BannerCarousel";
import ComboSection        from "../components/shop/ComboSection";
import PromoPopup           from "../components/shop/PromoPopup";

// ── Cart write debounce config ────────────────────────────────────────────
// Batches rapid +/- taps into a single DB write per product.
// e.g. user taps + 5 times quickly → 1 DB write with quantity=5
// Reduced to 150ms for instant feel while still batching
const CART_DEBOUNCE_MS = 150;

// ── Per-user action rate limit ────────────────────────────────────────────
// Prevents spam: max N cart actions per window
const RATE_LIMIT_MAX    = 20;   // max actions
const RATE_LIMIT_WINDOW = 10_000; // per 10s window

export default function Shop() {
  const navigate = useNavigate();
  // ── Sitelinks searchbox: index.html's SearchAction targets /Shop?q={q} ──
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts]                 = useState([]);
  const [categories, setCategories]             = useState([]);
  // Read ?q= exactly once, on mount (lazy initializer → never re-reads per render)
  const [searchQuery, setSearchQuery]           = useState(() => {
    const q = new URLSearchParams(window.location.search).get("q");
    return q ? q : "";
  });
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
  
  // Ref to keep cartItems stable for getCartQuantity callback to prevent cascading re-renders
  const cartItemsRef = useRef(cartItems);
  useEffect(() => {
    cartItemsRef.current = cartItems;
  }, [cartItems]);

  // Ref for stock polling to avoid stale closure
  const productsRef = useRef(products);
  useEffect(() => { productsRef.current = products; }, [products]);

  // ── URL ↔ searchQuery sync ────────────────────────────────────────────
  // searchQuery stays the source of truth for filtering; we only mirror it
  // into ?q= (replace, so the back button isn't polluted with keystrokes).

  // Skip the mount run: searchQuery already came from ?q=, writing it straight
  // back would be a no-op replace. Deps are [searchQuery] only, so writing the
  // URL re-renders the route but never re-triggers this effect → no loop.
  const searchUrlSynced = useRef(false);
  useEffect(() => {
    if (!searchUrlSynced.current) {
      searchUrlSynced.current = true;
      return;
    }
    const currentQ = searchParams.get("q") || "";
    if (currentQ === searchQuery) return;
    const next = new URLSearchParams(searchParams);
    if (searchQuery) next.set("q", searchQuery);
    else next.delete("q");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  // EnhancedSearch owns its own input text and reports "" back on mount
  // (and whenever its internal query is empty). Ignore that empty echo until
  // the user has actually typed, otherwise a ?q= seed would be wiped at once.
  const searchBoxTouched = useRef(false);
  const handleSearchFromBox = useCallback((value) => {
    if (value) searchBoxTouched.current = true;
    if (!value && !searchBoxTouched.current) return;
    setSearchQuery(value);
  }, []);

  const getCartQuantity = useCallback(productId => {
    const item = cartItemsRef.current.find(i => i.product_id === productId);
    return item ? item.quantity : 0;
  }, []);

  // ── Debounced cart write refs ─────────────────────────────────────────
  // pendingCart: { [productId]: { quantity, timer, existingItemId } }
  const pendingCart = useRef({});

  // ── Rate limiter state ────────────────────────────────────────────────
  const rateLimitRef = useRef({ count: 0, windowStart: Date.now() });

  // ── Mount: load data + user + REALTIME stock updates ──────────
  useEffect(() => {
    useSEO(ROUTE_META["/Shop"]);

    const abortController = new AbortController();
    checkUser();
    loadData(abortController.signal);

    // Invalidate cache on logout (cross-tab)
    const handleStorageChange = () => {
      if (!localStorage.getItem("sb-collegecart-auth")) invalidateCache();
    };
    window.addEventListener("storage", handleStorageChange);

    // ═══════════════════════════════════════════════════════════════
    // REALTIME: Listen for hostel_stock changes - INSTANT UPDATES
    // Only re-enrich products, don't do full reload
    // ═══════════════════════════════════════════════════════════════
    console.log('[Shop] Setting up Realtime subscription for hostel_stock');
    
    let reloadTimeout = null;
    const hostelStockChannel = supabase
      .channel('hostel_stock_changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'hostel_stock'
        },
        (payload) => {
          console.log('[Shop] ⚡ REALTIME: Hostel stock changed!', payload);
          // Debounce - wait 2 seconds then re-enrich existing products
          if (reloadTimeout) clearTimeout(reloadTimeout);
          reloadTimeout = setTimeout(async () => {
            console.log('[Shop] Re-enriching products after stock change...');
            // Get current user hostel from localStorage as fallback
            const currentUser = JSON.parse(localStorage.getItem('sb-collegecart-auth') || '{}');
            const hostel = user?.selected_hostel || currentUser?.user?.user_metadata?.selected_hostel;
            
            if (hostel && hostel !== 'Other') {
              setProducts(prev => {
                if (prev.length === 0) return prev;
                // Re-enrich asynchronously
                enrichProductsWithHostelStock(prev, hostel).then(enriched => {
                  const sorted = [...enriched].sort((a, b) => {
                    const aS = a.hostel_stock_quantity !== undefined ? a.hostel_stock_quantity : 0;
                    const bS = b.hostel_stock_quantity !== undefined ? b.hostel_stock_quantity : 0;
                    if (aS > 0 && bS === 0) return -1;
                    if (aS === 0 && bS > 0) return 1;
                    return (a.display_order || 0) - (b.display_order || 0);
                  });
                  setProducts(sorted);
                });
                return prev;
              });
            }
          }, 2000);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Shop] ✅ Realtime subscription active - stock updates will be instant!');
        } else {
          console.log('[Shop] Realtime subscription status:', status);
        }
      });

    return () => {
      abortController.abort();
      window.removeEventListener("storage", handleStorageChange);
      
      // Clear reload timeout
      if (reloadTimeout) clearTimeout(reloadTimeout);
      
      // Unsubscribe from realtime
      console.log('[Shop] Unsubscribing from Realtime');
      supabase.removeChannel(hostelStockChannel);
      
      // Flush any pending debounced cart writes on unmount
      Object.values(pendingCart.current).forEach(p => {
        clearTimeout(p.timer);
        if (p.flush) p.flush();
      });
    };
  }, []);

  // ── Reload data when hostel changes ───────────────────────────────────
  // Use ref to track previous hostel to prevent unnecessary reloads
  const prevHostelRef = useRef(null);
  
  useEffect(() => {
    // Re-enrich when hostel is set or changes (including first time after user loads)
    if (user?.selected_hostel && prevHostelRef.current !== user.selected_hostel && products.length > 0) {
      console.log('[Shop] Hostel set/changed:', prevHostelRef.current, '→', user.selected_hostel);
      console.log('[Shop] Re-enriching products with hostel stock...');
      
      // Re-enrich products with new hostel stock
      enrichProductsWithHostelStock(products, user.selected_hostel).then(enriched => {
        // Sort: in-stock first
        const sorted = [...enriched].sort((a, b) => {
          const aS = a.hostel_stock_quantity !== undefined ? a.hostel_stock_quantity : (a.stock_quantity || 0);
          const bS = b.hostel_stock_quantity !== undefined ? b.hostel_stock_quantity : (b.stock_quantity || 0);
          if (aS > 0 && bS === 0) return -1;
          if (aS === 0 && bS > 0) return 1;
          return (a.display_order || 0) - (b.display_order || 0);
        });
        
        setProducts(sorted);
        console.log('[Shop] Products re-enriched for hostel:', user.selected_hostel);
      });
    }
    
    // Always update the ref
    prevHostelRef.current = user?.selected_hostel;
  }, [user?.selected_hostel, products.length]);

  // ── Group products by category (show all, out-of-stock at end with label) ─────────
  useEffect(() => {
    const categorized = {};
    categories.forEach(cat => {
      categorized[cat.id] = [...products]
        .filter(p => p.category_id === cat.id)
        .sort((a, b) => {
          // In-stock items first, out-of-stock at end
          const aS = a.hostel_stock_quantity !== undefined ? a.hostel_stock_quantity : (a.stock_quantity || 0);
          const bS = b.hostel_stock_quantity !== undefined ? b.hostel_stock_quantity : (b.stock_quantity || 0);
          
          const aQty = getCartQuantity(a.id);
          const bQty = getCartQuantity(b.id);
          
          const aInStock = aS > 0 || aQty > 0;
          const bInStock = bS > 0 || bQty > 0;
          
          if (aInStock && !bInStock) return -1;
          if (!aInStock && bInStock) return 1;
          return (a.display_order || 0) - (b.display_order || 0);
        });
    });
    setCategorizedProducts(categorized);
  }, [products, categories, getCartQuantity]);

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

    if (filters.rating !== "all") {
      const min = parseFloat(filters.rating);
      out = out.filter(p => (p.average_rating || 0) >= min);
    }

    // Sort: in-stock first, then out-of-stock
    out.sort((a, b) => {
      const aS = a.hostel_stock_quantity !== undefined ? a.hostel_stock_quantity : (a.stock_quantity || 0);
      const bS = b.hostel_stock_quantity !== undefined ? b.hostel_stock_quantity : (b.stock_quantity || 0);
      if (aS > 0 && bS === 0) return -1;
      if (aS === 0 && bS > 0) return 1;
      return 0;
    });

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

  // ── Infinite scroll slice ─────────────────────────────────────────────
  useEffect(() => {
    setPage(1);
  }, [searchQuery, selectedCategory, filters, sortBy]);

  useEffect(() => {
    const filtered = applyFiltersAndSort(products);
    const currentEnd = Math.max(page * PRODUCTS_PER_PAGE, PRODUCTS_PER_PAGE);
    setDisplayedProducts(filtered.slice(0, currentEnd));
    setHasMore(filtered.length > currentEnd);
  }, [products, applyFiltersAndSort, page]);

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
    console.log('[Shop] Hostel selected:', hostel);
    setShowHostelSelector(false);
    setUser(prev => ({ ...prev, selected_hostel: hostel }));
    // The useEffect watching user.selected_hostel will handle the re-enrichment
    // No need to invalidate cache or reload here
  };

  // ── Stock helpers ─────────────────────────────────────────────────────
  const getHostelStock = useCallback((product) => {
    // Single source of truth. This previously fell back to the global
    // stock_quantity when the hostel figure was 0, which rendered an enabled ADD
    // button for items that were sold out in the selected hostel.
    return getDisplayStock(product, user?.selected_hostel);
  }, [user?.selected_hostel]);

  const isProductInStock = useCallback((product) => {
    // Availability window check, layered on the shared per-hostel stock rule.
    const stock = stockIsInStock(product, user?.selected_hostel);
    
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
        if (from !== null && to !== null && !(cur >= from && cur <= to)) {
          return false;
        }
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
  const applyData = useCallback(async (rawProducts, rawCategories) => {
    console.log('[Shop] ========================================');
    console.log('[Shop] applyData called with', rawProducts.length, 'products');
    
    // Get hostel from state OR localStorage (for when component re-mounts)
    let hostel = user?.selected_hostel;
    if (!hostel) {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser) {
          const { data: profile } = await supabase
            .from('users')
            .select('selected_hostel')
            .eq('id', authUser.id)
            .maybeSingle();
          hostel = profile?.selected_hostel;
        }
      } catch (e) { /* ignore */ }
    }
    
    console.log('[Shop] Using hostel:', hostel);
    
    // CRITICAL: Fetch fresh hostel stock directly from database
    let enrichedProducts = rawProducts;
    if (hostel && hostel !== 'Other') {
      console.log('[Shop] 🔄 Enriching with hostel stock for:', hostel);
      
      // Direct database query - ALWAYS FRESH
      enrichedProducts = await enrichProductsWithHostelStock(rawProducts, hostel);
      
      // Log detailed summary
      const inStock = enrichedProducts.filter(p => (p.hostel_stock_quantity || 0) > 0);
      const outOfStock = enrichedProducts.filter(p => (p.hostel_stock_quantity || 0) === 0);
      
      console.log(`[Shop] ✅ Enrichment complete:`);
      console.log(`[Shop]    - ${inStock.length} products IN STOCK`);
      console.log(`[Shop]    - ${outOfStock.length} products OUT OF STOCK`);
      
      // Log first 3 in-stock and first 3 out-of-stock for verification
      console.log('[Shop] Sample IN STOCK products:');
      inStock.slice(0, 3).forEach(p => {
        console.log(`[Shop]    ✓ ${p.name}: hostel_stock=${p.hostel_stock_quantity}`);
      });
      
      console.log('[Shop] Sample OUT OF STOCK products:');
      outOfStock.slice(0, 3).forEach(p => {
        console.log(`[Shop]    ✗ ${p.name}: hostel_stock=${p.hostel_stock_quantity}`);
      });
    } else {
      console.log('[Shop] No hostel selected or Other, using total stock');
      enrichedProducts = rawProducts.map(p => ({
        ...p,
        hostel_stock_quantity: p.stock_quantity || 0
      }));
    }
    
    // Sort all products: in-stock first, then by display_order
    const sorted = [...enrichedProducts].sort((a, b) => {
      const aS = a.hostel_stock_quantity !== undefined ? a.hostel_stock_quantity : (a.stock_quantity || 0);
      const bS = b.hostel_stock_quantity !== undefined ? b.hostel_stock_quantity : (b.stock_quantity || 0);
      if (aS > 0 && bS === 0) return -1;
      if (aS === 0 && bS > 0) return 1;
      return (a.display_order || 0) - (b.display_order || 0);
    });

    console.log('[Shop] Setting', sorted.length, 'products to state');
    console.log('[Shop] ========================================');
    
    setProducts(sorted);
    // Enrich categories: fall back to a sample product image when the
    // category itself has no image, so pills always show a real thumbnail
    const enrichedCategories = (rawCategories || []).map(cat => {
      if (cat.image_url) return cat;
      const sample = sorted.find(p => p.category_id === cat.id && p.image_url);
      return sample ? { ...cat, image_url: sample.image_url } : cat;
    });
    setCategories(enrichedCategories);
  }, [user?.selected_hostel]);

  // ── Blinkit-style stock polling: refresh hostel stock every 25s + on focus ─
  // Keeps egress low (one small hostel_stock query) but never shows stale out-of-stock.
  // Product metadata stays cached 5m, stock is always fresh — matches Blinkit/Zepto listing.
  useEffect(() => {
    if (isLoading || !productsRef.current.length) return;
    const hostel = user?.selected_hostel;
    if (!hostel || hostel === 'Other') return;

    const refreshStock = async () => {
      try {
        const current = productsRef.current;
        if (!current.length) return;
        const enriched = await enrichProductsWithHostelStock(current, hostel);
        const sorted = [...enriched].sort((a, b) => {
          const aS = a.hostel_stock_quantity ?? a.stock_quantity ?? 0;
          const bS = b.hostel_stock_quantity ?? b.stock_quantity ?? 0;
          if (aS > 0 && bS === 0) return -1;
          if (aS === 0 && bS > 0) return 1;
          return (a.display_order || 0) - (b.display_order || 0);
        });
        const changed = sorted.some((p, i) => p.hostel_stock_quantity !== current[i]?.hostel_stock_quantity);
        if (changed) setProducts(sorted);
      } catch {}
    };

    const interval = setInterval(refreshStock, 60000);
    const onFocus = () => { if (document.visibilityState === 'visible') refreshStock(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [user?.selected_hostel, isLoading]);

  const loadData = useCallback(async (signal, forceRefresh = false) => {
    // Only invalidate cache if force refresh is requested
    if (forceRefresh) {
      invalidateCache();
      console.log('[Shop] Cache invalidated - fetching fresh data');
    }
    
    setIsLoading(true);
    try {
      const { products: p, categories: c } = await deduplicatedFetch();
      if (signal?.aborted) return;
      await applyData(p, c);
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
      if (targetQty <= 0) {
        // Deleting item - match by user & product to avoid stale ID race conditions
        const { error: deleteErr } = await supabase
          .from('cart_items')
          .delete()
          .eq('product_id', productId)
          .eq('user_id', user.id);

        if (deleteErr) throw deleteErr;
        notifyCartUpdate();
      } else {
        // Use the id we already know about. Re-querying introduced a race and,
        // worse, the old code did `.catch(() => [])` on the lookup: a failed read
        // looked like "no such row", so it tried to INSERT a second row for a
        // product already in the cart. That is what produced "Failed to update
        // cart. Please try again." over and over.
        let existingId = existingItemId;
        if (!existingId) {
          const { data: existing, error: findErr } = await supabase
            .from('cart_items')
            .select('id')
            .eq('product_id', productId)
            .eq('user_id', user.id)
            .limit(1);

          if (findErr) throw findErr;
          existingId = existing && existing[0] ? existing[0].id : null;
        }

        if (existingId) {
          const { error: updateErr } = await supabase
            .from('cart_items')
            .update({ quantity: targetQty, updated_at: new Date().toISOString() })
            .eq('id', existingId)
            .eq('user_id', user.id);

          if (updateErr) throw updateErr;

          setCartItems(prev => prev.map(item =>
            item.product_id === productId
              ? { ...item, id: existingId, quantity: targetQty }
              : item
          ));
        } else {
          const { data: created, error: createErr } = await supabase
            .from('cart_items')
            .insert({ product_id: productId, user_id: user.id, quantity: targetQty })
            .select()
            .single();

          if (createErr) throw createErr;

          setCartItems(prev => prev.map(item =>
            item.product_id === productId
              ? { ...item, id: created.id, quantity: targetQty }
              : item
          ));
        }
        notifyCartUpdate();
      }
      
      // Silent background sync - don't reload immediately to prevent flicker
      setTimeout(() => {
        if (user?.id) loadCartItems(user.id);
      }, 1000);
    } catch (err) {
      await logErrorToDB("API", `${err?.message || err}${err?.code ? ` [${err.code}]` : ""}`, "/shop/cart/write", err.stack).catch(() => {});
      console.error("[Cart] write failed:", err);
      // Only reload on error to revert optimistic update
      if (user?.id) loadCartItems(user.id);
      // Surface the real reason. The old generic message hid every distinct
      // failure behind one string, which is why this kept recurring undiagnosed.
      const reason = err?.message || String(err);
      toast.error("Couldn't update your cart", {
        description: reason.length > 120 ? `${reason.slice(0, 120)}…` : reason,
      });
    }
  }, [user]);

  const updateCartQuantity = useCallback(async (product, quantityChange) => {
    if (!user) { navigate('/login'); return; }
    if (checkRateLimit()) return;

    // Always read the authoritative per-hostel figure. The product object in
    // state can be stale, and getHostelStock now refuses to invent stock that the
    // selected hostel does not have.
    const currentHostelStock = getHostelStock(product);

    if (quantityChange > 0 && currentHostelStock <= 0) {
      toast.error(`${product.name} is out of stock in ${user.selected_hostel || 'your hostel'}`);
      return;
    }

    if (quantityChange > 0 && !isProductInStock(product)) {
      toast.error(`${product.name} is currently unavailable`);
      return;
    }

    const existingItem = cartItems.find(i => i.product_id === product.id);
    const hostelStock  = currentHostelStock;
    const currentQty   = existingItem?.quantity ?? 0;
    const newQty       = currentQty + quantityChange;

    if (newQty > hostelStock && quantityChange > 0) {
      toast.warning(`Only ${hostelStock} unit${hostelStock === 1 ? "" : "s"} left in ${user.selected_hostel || 'your hostel'}`);
      return;
    }

    // Don't allow negative quantities
    if (newQty < 0) return;

    // ── Optimistic UI update (instant, no flicker) ────────────
    const tempId = "temp-" + Date.now() + "-" + product.id;
    
    if (newQty <= 0) {
      // Remove item immediately
      setCartItems(prev => prev.filter(i => i.product_id !== product.id));
      notifyCartUpdate();
    } else if (existingItem) {
      // Update existing item immediately
      setCartItems(prev => prev.map(i =>
        i.product_id === product.id ? { ...i, quantity: newQty } : i
      ));
      notifyCartUpdate();
    } else {
      // Add new item immediately
      setCartItems(prev => [...prev, {
        id:           tempId,
        product_id:   product.id,
        user_id:      user.id,
        quantity:     newQty,
        product_name: product.name,
        price:        product.price,
        created_date: new Date().toISOString(),
      }]);
      notifyCartUpdate();
    }

    // ── Optimistic stock update in products list ──────────────
    // Immediately reduce hostel stock in UI
    setProducts(prev => prev.map(p => {
      if (p.id === product.id && p.hostel_stock_quantity !== undefined) {
        const newHostelStock = Math.max(0, p.hostel_stock_quantity - quantityChange);
        return {
          ...p,
          hostel_stock_quantity: newHostelStock
        };
      }
      return p;
    }));

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
      quantity: targetQty,
      existingItemId: existingId,
      flush: () => flushCartWrite(product.id, targetQty, existingId),
    };
  }, [user, cartItems, getHostelStock, isProductInStock, checkRateLimit, flushCartWrite, navigate]);

  const addToCart = useCallback(product => updateCartQuantity(product, 1), [updateCartQuantity]);

  // ── Render ────────────────────────────────────────────────────────────
  const isFiltered = searchQuery.trim() || selectedCategory ||
    filters.availability !== "all" || filters.rating !== "all" || sortBy !== "relevance";

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto space-y-4 pb-tab-bar page-enter">

        {showHostelSelector && (
          <HostelSelector
            onHostelSelected={handleHostelSelected}
            onClose={() => setShowHostelSelector(false)}
            currentHostel={user?.selected_hostel}
          />
        )}

        {/* SEO H1 — visually hidden but indexable, preserves design */}
        <h1 className="sr-only">Shop Groceries & Essentials — 10 Minute Hostel Delivery | CollegeCart</h1>
        {/* Header with delivery promise + address */}
        <EnhancedShopHero
          hostelName={user?.selected_hostel}
          onChangeHostel={() => setShowHostelSelector(true)}
        />

        {/* Search — now with shop-customized filter sheet */}
        <EnhancedSearch
          products={products}
          onSearch={handleSearchFromBox}
          filters={filters}
          onFilterChange={setFilters}
          sortBy={sortBy}
          onSortChange={setSortBy}
          categories={categories}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
        />

        {/* Promo banners — right below search, admin-managed */}
        <BannerCarousel />

        {/* Category pills */}
        <CategoryFilter
          categories={categories}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
        />

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
          <div className="space-y-6">
            {Array(3).fill(0).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="h-6 w-48 mb-3 rounded-lg" />
                <div className="flex gap-2.5">
                  {Array(5).fill(0).map((_, j) => (
                    <Skeleton key={j} className="h-52 w-[132px] flex-shrink-0 rounded-xl" />
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
          <div className="space-y-6">
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

        {user && <CartPopup />}
        {/* Promo popup — mobile only, admin-managed, CollegeCart green theme */}
        <PromoPopup />
      </div>
    </div>
  );
}
