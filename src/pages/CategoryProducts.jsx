import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ArrowLeft, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { getCacheStatus, getCachedData, deduplicatedFetch } from "@/utils/shopCache";
import { FALLBACK_IMG } from "@/components/ui/product-image";
import { useSafeImageSrc } from "@/hooks/useSafeImageSrc";

// Sub-component so the hook can be called per product card
function ProductThumb({ src, alt }) {
  const safeSrc = useSafeImageSrc(src);
  if (!safeSrc) return <div className="w-full h-36 bg-gray-200 animate-pulse" />;
  return <img src={safeSrc} alt={alt} className="w-full h-36 object-cover" loading="lazy" />;
}

export default function CategoryProducts() {
  const navigate = useNavigate();
  const [products, setProducts]       = useState([]);
  const [categoryName, setCategoryName] = useState("");
  const [isLoading, setIsLoading]     = useState(true);
  const [user, setUser]               = useState(null);
  const [cartItems, setCartItems]     = useState([]);

  useEffect(() => {
    loadData();
    checkUser();
  }, []);

  // ── Auth ────────────────────────────────────────────────────────────────
  const checkUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      loadCartItems(currentUser.id);
    } catch { /* not logged in */ }
  };

  const loadCartItems = async (userId) => {
    try {
      const items = await base44.entities.CartItem.filter({ user_id: userId });
      setCartItems(items);
    } catch { setCartItems([]); }
  };

  // ── Stock helpers ────────────────────────────────────────────────────────
  const getHostelStock = (product) => {
    if (!user?.selected_hostel || user.selected_hostel === "Other")
      return product.stock_quantity || 0;
    if (product.hostel_stock && typeof product.hostel_stock[user.selected_hostel] === "number")
      return product.hostel_stock[user.selected_hostel];
    return product.stock_quantity || 0;
  };

  const isProductInStock = (product) => {
    if (product.available_from && product.available_to) {
      try {
        const now = new Date();
        const cur = now.getHours() * 60 + now.getMinutes();
        const parse = (t) => {
          const m12 = t?.match(/(\d+):(\d+)\s*(AM|PM)/i);
          if (m12) {
            let h = parseInt(m12[1], 10);
            const min = parseInt(m12[2], 10);
            if (m12[3].toUpperCase() === "PM" && h !== 12) h += 12;
            if (m12[3].toUpperCase() === "AM" && h === 12) h = 0;
            return h * 60 + min;
          }
          const m24 = t?.match(/^(\d{1,2}):(\d{2})$/);
          return m24 ? parseInt(m24[1], 10) * 60 + parseInt(m24[2], 10) : null;
        };
        const from = parse(product.available_from);
        const to   = parse(product.available_to);
        if (from !== null && to !== null && !(cur >= from && cur <= to)) return false;
      } catch { /* ignore */ }
    }
    return getHostelStock(product) > 0 || getCartQuantity(product.id) > 0;
  };

  // ── Data ─────────────────────────────────────────────────────────────────
  const loadData = async () => {
    setIsLoading(true);
    try {
      const params          = new URLSearchParams(window.location.search);
      const categoryId      = params.get("categoryId");
      const categoryNameParam = params.get("categoryName");
      setCategoryName(categoryNameParam || "Products");

      if (!categoryId) { setIsLoading(false); return; }

      // Use shopCache — edge function → CDN → DB fallback
      let allProducts;
      const status = getCacheStatus();
      if (status === "fresh" || status === "stale") {
        ({ products: allProducts } = getCachedData());
      } else {
        ({ products: allProducts } = await deduplicatedFetch());
      }

      const sorted = allProducts
        .filter(p => p.category_id === categoryId)
        .sort((a, b) => {
          const aS = a.stock_quantity || 0, bS = b.stock_quantity || 0;
          if (aS > 0 && bS === 0) return -1;
          if (aS === 0 && bS > 0) return 1;
          return (a.display_order || 0) - (b.display_order || 0);
        });

      setProducts(sorted);
    } catch (err) {
      console.error("Error loading products:", err);
    }
    setIsLoading(false);
  };

  // ── Cart ─────────────────────────────────────────────────────────────────
  const updateCartQuantity = async (product, quantityChange) => {
    if (!user) { await base44.auth.redirectToLogin(); return; }

    const existingItem = cartItems.find(i => i.product_id === product.id);
    const newQty = (existingItem?.quantity ?? 0) + quantityChange;

    // Optimistic update
    if (newQty <= 0) {
      setCartItems(prev => prev.filter(i => i.product_id !== product.id));
    } else if (existingItem) {
      setCartItems(prev => prev.map(i =>
        i.product_id === product.id ? { ...i, quantity: newQty } : i
      ));
    } else {
      setCartItems(prev => [...prev, {
        id: "temp-" + Date.now(),
        product_id: product.id,
        user_id: user.id,
        quantity: 1,
        product_name: product.name,
        price: product.price,
      }]);
    }

    try {
      if (existingItem) {
        if (newQty <= 0) await base44.entities.CartItem.delete(existingItem.id);
        else await base44.entities.CartItem.update(existingItem.id, { quantity: newQty });
      } else if (quantityChange > 0) {
        const created = await base44.entities.CartItem.create({
          product_id: product.id, user_id: user.id, quantity: 1,
        });
        if (created) {
          setCartItems(prev => prev.map(i =>
            i.id?.toString().startsWith("temp-") && i.product_id === product.id
              ? { ...i, id: created.id } : i
          ));
        }
      }
      setTimeout(() => loadCartItems(user.id), 500);
    } catch (err) {
      console.error("Cart error:", err);
      loadCartItems(user.id);
    }
  };

  const getCartQuantity = (productId) =>
    cartItems.find(i => i.product_id === productId)?.quantity ?? 0;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-tab-bar px-4">

      {/* Header */}
      <div className="flex items-center gap-4 pt-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => navigate(createPageUrl("Shop"))}
          className="rounded-full"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{categoryName}</h1>
          <p className="text-sm text-gray-500">{products.length} products available</p>
        </div>
      </div>

      {/* Loading skeleton */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {Array(10).fill(0).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-36 w-full rounded-xl" />
              <Skeleton className="h-4 w-3/4 rounded" />
              <Skeleton className="h-4 w-1/2 rounded" />
              <Skeleton className="h-8 w-full rounded-lg" />
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          No products available in this category.
        </div>
      ) : (
        /* Product grid — same card style as main shop CategorySection */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {products.map((product) => {
            const cartQty    = getCartQuantity(product.id);
            const inStock    = isProductInStock(product);
            const hasDiscount = product.original_price && product.original_price > product.price;

            return (
              <div key={product.id} className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow border border-gray-100 overflow-hidden flex flex-col">

                {/* Image */}
                <Link to={createPageUrl(`ProductDetails?id=${product.id}`)}>
                  <div className="relative">
                    <ProductThumb src={product.image_url} alt={product.name} />

                    {/* Free delivery badge */}
                    {product.delivery_charge === 0 && (
                      <div className="absolute top-2 left-2 bg-emerald-500 text-white text-xs px-2 py-0.5 rounded-full font-medium">
                        Free Delivery
                      </div>
                    )}

                    {/* Time badge */}
                    <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Clock className="w-3 h-3 text-gray-500" />
                      <span className="text-xs font-medium text-gray-700">
                        {product.delivery_time || "13 mins"}
                      </span>
                    </div>

                    {/* Out of stock overlay */}
                    {!inStock && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <span className="bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                          OUT OF STOCK
                        </span>
                      </div>
                    )}
                  </div>
                </Link>

                {/* Info */}
                <div className="p-3 flex flex-col flex-1 gap-1">
                  <Link to={createPageUrl(`ProductDetails?id=${product.id}`)}>
                    <h3 className="font-medium text-sm text-gray-900 line-clamp-2 leading-snug min-h-[2.5rem]">
                      {product.name}
                    </h3>
                  </Link>

                  {product.unit && (
                    <p className="text-xs text-gray-400">{product.unit}</p>
                  )}

                  {/* Price */}
                  <div className="flex items-center gap-2 mt-auto pt-1">
                    <span className="font-bold text-gray-900">₹{product.price}</span>
                    {hasDiscount && (
                      <span className="text-xs text-gray-400 line-through">
                        ₹{product.original_price}
                      </span>
                    )}
                  </div>

                  {/* Cart button */}
                  {!inStock ? (
                    <Button
                      size="sm"
                      disabled
                      className="w-full mt-1 h-8 text-xs font-semibold bg-gray-200 text-gray-500 cursor-not-allowed rounded-lg"
                    >
                      OUT OF STOCK
                    </Button>
                  ) : cartQty > 0 ? (
                    <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-1 mt-1">
                      <button
                        onClick={() => updateCartQuantity(product, -1)}
                        className="w-6 h-6 flex items-center justify-center text-emerald-600 font-bold text-lg active:scale-90"
                      >
                        −
                      </button>
                      <span className="font-bold text-emerald-700 text-sm">{cartQty}</span>
                      <button
                        onClick={() => updateCartQuantity(product, 1)}
                        className="w-6 h-6 flex items-center justify-center text-emerald-600 font-bold text-lg active:scale-90"
                      >
                        +
                      </button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => updateCartQuantity(product, 1)}
                      className="w-full mt-1 h-8 text-xs font-semibold bg-white border-2 border-emerald-600 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-lg active:scale-95 transition-all"
                    >
                      ADD
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
