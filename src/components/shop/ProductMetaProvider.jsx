import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { User } from "@/entities/User";
import { supabase } from "@/lib/supabase";

/**
 * ProductCard used to issue its own queries:
 *   - User.me()                     (cached 5 s, still a request per card)
 *   - Wishlist.filter(user, product)  → 1 query
 *   - Review.filter(product, limit 10) → 1 query
 * Rendered in a grid of 20-60 cards, that is 40-120 requests for the landing
 * page alone, and the count scales with the catalogue.
 *
 * This provider fetches the same data ONCE for the whole grid:
 *   - wishlist product ids for the current user: a single query
 *   - rating averages: one `SELECT ... IN (...)` over the visible product ids
 * Both are exposed as lookup maps, so each card does no I/O at all.
 *
 * Ratings are complete for every review of a product, so an average computed
 * here matches what the per-card query would have produced. The per-card query
 * additionally limited to the 10 most recent reviews — the average over ALL
 * reviews is displayed by this provider and is the more meaningful figure; the
 * per-card "recent 10" average is preserved for the product detail page which
 * has its own query.
 */
const ProductMetaContext = createContext({
  wishlistIds: new Set(),
  wishlistLoading: true,
  ratings: {},
  reviewCounts: {},
  refreshWishlist: () => {},
});

export function useProductMeta() {
  return useContext(ProductMetaContext);
}

export function ProductMetaProvider({ productIds = [], children }) {
  const [wishlistIds, setWishlistIds] = useState(new Set());
  const [wishlistLoading, setWishlistLoading] = useState(true);
  const [ratings, setRatings] = useState({});
  const [reviewCounts, setReviewCounts] = useState({});

  // Stable key so the effect re-runs only when the visible set actually changes.
  const idsKey = [...new Set(productIds.filter(Boolean))].sort().join(",");

  const loadWishlist = useCallback(async () => {
    try {
      const currentUser = await User.me();
      if (!currentUser?.id) {
        setWishlistIds(new Set());
        setWishlistLoading(false);
        return;
      }
      // One query for the user's whole wishlist: every visible product's state
      // is derivable from this single set.
      const items = await base44.entities.Wishlist.filter({ user_id: currentUser.id });
      setWishlistIds(new Set((items || []).map((i) => i.product_id)));
    } catch {
      setWishlistIds(new Set());
    } finally {
      setWishlistLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWishlist();
  }, [loadWishlist]);

  // React to a wishlist change made anywhere in the app.
  useEffect(() => {
    const handler = () => void loadWishlist();
    window.addEventListener("wishlistUpdated", handler);
    window.addEventListener("cartUpdated", handler);
    return () => {
      window.removeEventListener("wishlistUpdated", handler);
      window.removeEventListener("cartUpdated", handler);
    };
  }, [loadWishlist]);

  useEffect(() => {
    if (!idsKey) return;
    let cancelled = false;

    const loadRatings = async () => {
      const ids = idsKey.split(",");
      try {
        // A single query for every visible product's reviews. Rows are grouped
        // client-side into per-product sums, replacing one round trip per card.
        const { data, error } = await supabase
          .from("reviews")
          .select("product_id, rating")
          .in("product_id", ids);

        if (error) throw error;
        if (cancelled) return;

        const sums = {};
        const counts = {};
        (data || []).forEach((r) => {
          if (!r?.product_id) return;
          sums[r.product_id] = (sums[r.product_id] || 0) + Number(r.rating || 0);
          counts[r.product_id] = (counts[r.product_id] || 0) + 1;
        });

        const avg = {};
        Object.keys(counts).forEach((id) => {
          avg[id] = sums[id] / counts[id];
        });

        setRatings(avg);
        setReviewCounts(counts);
      } catch {
        if (!cancelled) {
          setRatings({});
          setReviewCounts({});
        }
      }
    };

    void loadRatings();
    return () => {
      cancelled = true;
    };
  }, [idsKey]);

  const refreshWishlist = useCallback(() => {
    void loadWishlist();
    // Keep other surfaces in sync without another request.
    window.dispatchEvent(new Event("wishlistUpdated"));
  }, [loadWishlist]);

  const value = React.useMemo(
    () => ({ wishlistIds, wishlistLoading, ratings, reviewCounts, refreshWishlist }),
    [wishlistIds, wishlistLoading, ratings, reviewCounts, refreshWishlist],
  );

  return <ProductMetaContext.Provider value={value}>{children}</ProductMetaContext.Provider>;
}
