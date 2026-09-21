import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ArrowLeft, Clock, Plus, SlidersHorizontal, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { deduplicatedFetch } from "@/utils/shopCache";
import { supabase } from "@/lib/supabase";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import FilterSheet from "@/components/shared/FilterSheet";
import { notifyCartUpdate } from "@/utils/cartEvents";
import { toast } from "sonner";

export default function CategoryProducts() {
  const navigate = useNavigate();
  const [allProducts, setAllProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategoryId, setActiveCategoryId] = useState("");
  const [activeCategoryName, setActiveCategoryName] = useState("");
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [cartItems, setCartItems] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({ availability: "all", rating: "all" });
  const [sortBy, setSortBy] = useState("relevance");
  const [categoryBanner, setCategoryBanner] = useState(null);
  const [subFilters, setSubFilters] = useState({ gourmet: false, brands: [], types: [], flavours: [], packaging: [], diet: [] });

  useEffect(() => {
    loadData();
    checkUser();
  }, []);

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

  const getHostelStock = (product) => {
    // Prefer enriched hostel_stock_quantity, then hostel map, fallback to total stock so Treats Corner etc remain orderable
    if (product.hostel_stock_quantity !== undefined && product.hostel_stock_quantity !== null) {
      if (product.hostel_stock_quantity > 0) return product.hostel_stock_quantity;
      // If hostel-specific is 0 but total stock exists, allow ordering (fallback)
      if ((product.stock_quantity || 0) > 0) return product.stock_quantity;
      return 0;
    }
    if (!user?.selected_hostel || user.selected_hostel === "Other") return product.stock_quantity || 0;
    const hostelVal = product.hostel_stock?.[user.selected_hostel];
    if (typeof hostelVal === "number") {
      if (hostelVal > 0) return hostelVal;
      if ((product.stock_quantity || 0) > 0) return product.stock_quantity;
      return 0;
    }
    return product.stock_quantity ?? product.stock ?? 0;
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
        const to = parse(product.available_to);
        if (from !== null && to !== null && !(cur >= from && cur <= to)) return false;
      } catch { /* ignore */ }
    }
    return getHostelStock(product) > 0 || getCartQuantity(product.id) > 0;
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams(window.location.search);
      const categoryId = params.get("categoryId");
      const categoryNameParam = params.get("categoryName");

      const { products: allProductsList, categories: rawCategories } = await deduplicatedFetch();
      const categoriesData = Array.isArray(rawCategories) ? rawCategories : [];
      const productsList = Array.isArray(allProductsList) ? allProductsList : [];

      const productCategoryIds = new Set(productsList.map(p => p.category_id).filter(Boolean));

      let catsWithProducts = categoriesData
        .filter(cat => productCategoryIds.has(cat.id))
        .sort((a, b) => (a.display_order || 0) - (b.display_order || 0));

      if (catsWithProducts.length === 0) {
        const fallbackMap = {};
        productsList.forEach(p => {
          if (p.category_id && p.category_name && !fallbackMap[p.category_id]) {
            fallbackMap[p.category_id] = {
              id: p.category_id,
              name: p.category_name,
              image_url: p.category_image || null,
              display_order: p.display_order || 0,
            };
          }
        });
        catsWithProducts = Object.values(fallbackMap).sort((a, b) => a.name.localeCompare(b.name));
      }

      catsWithProducts = catsWithProducts.map(cat => {
        if (!cat.image_url) {
          const sampleProd = productsList.find(p => p.category_id === cat.id && p.image_url);
          return { ...cat, image_url: sampleProd?.image_url || null };
        }
        return cat;
      });

      setCategories(catsWithProducts);
      setAllProducts(productsList);

      const targetId = categoryId || (catsWithProducts.length > 0 ? catsWithProducts[0].id : null);
      const targetName = categoryNameParam || (targetId ? catsWithProducts.find(c => c.id === targetId)?.name : "") || "Products";

      if (targetId) {
        setActiveCategoryId(targetId);
        setActiveCategoryName(targetName);
        const filtered = productsList
          .filter(p => p.category_id === targetId)
          .sort((a, b) => {
            const aS = a.stock_quantity || 0, bS = b.stock_quantity || 0;
            if (aS > 0 && bS === 0) return -1;
            if (aS === 0 && bS > 0) return 1;
            return (a.display_order || 0) - (b.display_order || 0);
          });
        setProducts(filtered);
      }
    } catch (err) {
      console.error("Error loading products:", err);
    }
    setIsLoading(false);
  };

  const handleCategorySelect = useCallback((catId, catName) => {
    setActiveCategoryId(catId);
    setActiveCategoryName(catName);
    const filtered = allProducts
      .filter(p => p.category_id === catId)
      .sort((a, b) => {
        const aS = a.stock_quantity || 0, bS = b.stock_quantity || 0;
        if (aS > 0 && bS === 0) return -1;
        if (aS === 0 && bS > 0) return 1;
        return (a.display_order || 0) - (b.display_order || 0);
      });
    setProducts(filtered);
    window.history.replaceState({}, "", createPageUrl(`CategoryProducts?categoryId=${catId}&categoryName=${encodeURIComponent(catName)}`));
  }, [allProducts]);

  // Load admin banner for current category (uses same banners table as Shop)
  useEffect(() => {
    if (!activeCategoryId) return;
    (async () => {
      try {
        const all = await base44.entities.Banner.filter({ is_active: true }, "display_order");
        const now = new Date();
        const filtered = all.filter((b) => {
          if (b.start_date && new Date(b.start_date) > now) return false;
          if (b.end_date && new Date(b.end_date) < now) return false;
          return true;
        });
        // Prefer banner linked to this category, otherwise first active banner
        const match =
          filtered.find((b) => b.link_type === "category" && String(b.link_target) === String(activeCategoryId)) ||
          filtered.find((b) => (b.title || "").toLowerCase().includes(activeCategoryName.toLowerCase().split(" ")[0])) ||
          filtered[0] ||
          null;
        setCategoryBanner(match);
      } catch {
        setCategoryBanner(null);
      }
    })();
  }, [activeCategoryId, activeCategoryName]);

  const updateCartQuantity = async (product, quantityChange) => {
    if (!user) { await base44.auth.redirectToLogin(); return; }
    const stock = getHostelStock(product);
    if (quantityChange > 0 && stock <= 0) {
      toast.error(`${product.name} is out of stock`);
      return;
    }
    const existingItem = cartItems.find(i => i.product_id === product.id);
    const newQty = (existingItem?.quantity ?? 0) + quantityChange;
    if (quantityChange > 0 && newQty > stock) {
      toast.warning(`Only ${stock} available`);
      return;
    }

    if (newQty <= 0) {
      setCartItems(prev => prev.filter(i => i.product_id !== product.id));
    } else if (existingItem) {
      setCartItems(prev => prev.map(i => i.product_id === product.id ? { ...i, quantity: newQty } : i));
    } else {
      setCartItems(prev => [...prev, { id: "temp-" + Date.now(), product_id: product.id, user_id: user.id, quantity: 1, product_name: product.name, price: product.price }]);
    }
    notifyCartUpdate();

    try {
      if (existingItem) {
        // Handle temp-id race: resolve to real DB row
        let realId = existingItem.id;
        if (String(realId).startsWith("temp-")) {
          const real = await base44.entities.CartItem.filter({ user_id: user.id, product_id: product.id }).catch(() => []);
          if (real.length > 0) {
            realId = real[0].id;
            setCartItems(prev => prev.map(i => i.product_id === product.id ? { ...i, id: realId } : i));
          } else {
            if (newQty > 0) {
              const created = await base44.entities.CartItem.create({ product_id: product.id, user_id: user.id, quantity: newQty });
              if (created) setCartItems(prev => prev.map(i => i.product_id === product.id ? { ...i, id: created.id, quantity: newQty } : i));
            }
            notifyCartUpdate();
            setTimeout(() => loadCartItems(user.id), 500);
            return;
          }
        }
        if (newQty <= 0) {
          try { await base44.entities.CartItem.delete(realId); } catch (e) { if (e.code !== "PGRST116" && !String(e.message).includes("0 rows")) throw e; }
        } else {
          try {
            await base44.entities.CartItem.update(realId, { quantity: newQty });
          } catch (e) {
            const isNotFound = e.code === "PGRST116" || String(e.message).includes("0 rows") || String(e.status) === "406";
            if (isNotFound) {
              const real = await base44.entities.CartItem.filter({ user_id: user.id, product_id: product.id }).catch(() => []);
              if (real.length > 0) await base44.entities.CartItem.update(real[0].id, { quantity: newQty });
              else await base44.entities.CartItem.create({ product_id: product.id, user_id: user.id, quantity: newQty });
            } else throw e;
          }
        }
      } else if (quantityChange > 0) {
        try {
          const created = await base44.entities.CartItem.create({ product_id: product.id, user_id: user.id, quantity: 1 });
          if (created) {
            setCartItems(prev => prev.map(i => i.id?.toString().startsWith("temp-") && i.product_id === product.id ? { ...i, id: created.id } : i));
          }
        } catch (e) {
          // Unique violation (already exists) -> update instead
          if (String(e.code) === "23505" || String(e.message).includes("duplicate") || String(e.message).includes("unique")) {
            const real = await base44.entities.CartItem.filter({ user_id: user.id, product_id: product.id }).catch(() => []);
            if (real.length > 0) await base44.entities.CartItem.update(real[0].id, { quantity: newQty });
          } else throw e;
        }
      }
      notifyCartUpdate();
      setTimeout(() => loadCartItems(user.id), 500);
    } catch (err) {
      console.error("Cart error:", err);
      loadCartItems(user.id);
      toast.error("Failed to update cart");
    }
  };

  const getCartQuantity = (productId) => cartItems.find(i => i.product_id === productId)?.quantity ?? 0;

  // Apply filters/sort to current category products (including drawer sub-filters)
  const displayedProducts = React.useMemo(() => {
    let list = [...products];
    if (filters.availability === "in_stock") list = list.filter((p) => isProductInStock(p));
    if (filters.rating === "4") list = list.filter((p) => (p.average_rating || 0) >= 4);
    if (filters.rating === "3") list = list.filter((p) => (p.average_rating || 0) >= 3);
    if (subFilters.gourmet) list = list.filter((p) => p.name.toLowerCase().includes("gourmet"));
    if (subFilters.brands.length > 0) list = list.filter((p) => subFilters.brands.some((b) => p.name.toLowerCase().includes(b.toLowerCase())));
    if (subFilters.types.length > 0) list = list.filter((p) => subFilters.types.some((t) => (p.description || "").toLowerCase().includes(t.toLowerCase())));
    if (subFilters.flavours.length > 0) list = list.filter((p) => subFilters.flavours.some((f) => p.name.toLowerCase().includes(f.toLowerCase())));
    if (subFilters.packaging.length > 0) list = list.filter((p) => subFilters.packaging.some((pkg) => (p.unit || "").toLowerCase().includes(pkg.toLowerCase())));
    if (subFilters.diet.length > 0) list = list.filter((p) => subFilters.diet.some((d) => (p.description || "").toLowerCase().includes(d.toLowerCase())));
    if (sortBy === "price_low") list = [...list].sort((a, b) => a.price - b.price);
    else if (sortBy === "price_high") list = [...list].sort((a, b) => b.price - a.price);
    else if (sortBy === "rating") list = [...list].sort((a, b) => (b.average_rating || 0) - (a.average_rating || 0));
    return list;
  }, [products, filters, sortBy, subFilters]);

  return (
    <>
      <div className="bg-white min-h-screen">
        {/* Top Header - Fixed */}
      <div className="bg-white border-b border-gray-100 px-3 py-2.5 flex items-center gap-3 fixed top-0 left-0 right-0 z-40 h-14">
        <button
          onClick={() => navigate(createPageUrl("Shop"))}
          className="p-1.5 rounded-full hover:bg-gray-100 text-gray-700 active:scale-90 transition-transform"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-sm font-bold text-gray-900 leading-tight">
            {activeCategoryName || "Products"}
          </h1>
          <p className="text-[11px] text-gray-500">
            {products.length} product{products.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Main Layout: Sticky sidebar + scrollable products */}
      <div className="pt-14 flex">
        {/* Left Sidebar - Subcategories like reference */}
        <div className="w-[84px] fixed top-14 left-0 bottom-0 bg-[#f8f8f8] border-r border-gray-100 overflow-y-auto scrollbar-hide z-30">
          <div className="flex flex-col py-2 gap-1">
            {categories.map((cat) => {
              const isActive = cat.id === activeCategoryId;
              return (
                <button
                  key={cat.id}
                  onClick={() => handleCategorySelect(cat.id, cat.name)}
                  className={`relative flex flex-col items-center py-2.5 px-1 mx-1 rounded-xl transition-all ${
                    isActive ? "bg-white shadow-sm" : "hover:bg-white/60"
                  }`}
                >
                  {isActive && (
                    <div className="absolute left-0 top-2 bottom-2 w-[3px] bg-[#a855f7] rounded-r" />
                  )}

                  <div className={`w-[56px] h-[56px] rounded-xl overflow-hidden flex items-center justify-center p-1.5 border-2 transition-all ${
                    isActive ? "bg-white border-[#f0abfc] shadow-sm" : "bg-white border-gray-200"
                  }`}>
                    {cat.image_url ? (
                      <img
                        src={cat.image_url}
                        alt={cat.name}
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          e.target.style.display = "none";
                          if (e.target.nextSibling) e.target.nextSibling.style.display = "flex";
                        }}
                      />
                    ) : null}
                    <div className={`w-full h-full items-center justify-center text-lg font-bold ${cat.image_url ? "hidden" : "flex"} ${isActive ? "bg-pink-50 text-[#a855f7]" : "bg-gray-50 text-gray-400"}`}>
                      {cat.name?.charAt(0) || "🛒"}
                    </div>
                  </div>

                  <span className={`text-[10px] text-center leading-tight mt-1.5 line-clamp-2 px-0.5 ${
                    isActive ? "font-bold text-[#a855f7]" : "font-medium text-gray-600"
                  }`}>
                    {cat.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Product Grid Area - Scrolls independently */}
        <div className="flex-1 ml-[84px] overflow-y-auto bg-[#f8f8f8] pb-20" style={{ height: "calc(100vh - 56px)" }}>
          {/* Admin banner for this category — shows only if you create one in Admin → Banners */}
          {categoryBanner && (
            <div className="bg-white p-2.5">
              <div
                className="rounded-2xl overflow-hidden relative h-[130px] flex items-center p-4"
                style={{
                  background: categoryBanner.background_color
                    ? `linear-gradient(135deg, ${categoryBanner.background_color} 0%, ${categoryBanner.background_color}cc 100%)`
                    : "linear-gradient(135deg, #fefce8 0%, #fef9c3 100%)",
                }}
              >
                <div className="w-[55%]">
                  <h3 className="text-sm font-extrabold text-gray-900 leading-tight whitespace-pre-line">
                    {categoryBanner.title || activeCategoryName}
                  </h3>
                  <p className="text-[11px] text-gray-600 mt-1 line-clamp-2">
                    {categoryBanner.subtitle || categoryBanner.description || `Best ${activeCategoryName} for you`}
                  </p>
                  <button
                    onClick={async () => {
                      try {
                        await base44.entities.Banner.update(categoryBanner.id, {
                          click_count: (categoryBanner.click_count || 0) + 1,
                        });
                      } catch {}
                      const t = categoryBanner.link_type;
                      const target = categoryBanner.link_target;
                      if (t === "internal" && target) navigate(createPageUrl(target));
                      else if (t === "category" && target) handleCategorySelect(target, categoryBanner.title || target);
                      else if (t === "product" && target) navigate(createPageUrl(`ProductDetails?id=${target}`));
                      else if (t === "external" && target) window.open(target, "_blank");
                      else document.getElementById("products-grid")?.scrollIntoView({ behavior: "smooth" });
                    }}
                    className="mt-2 bg-black text-white text-[11px] font-bold px-4 py-1.5 rounded-full active:scale-95 transition-transform"
                  >
                    {categoryBanner.cta_text || "BUY NOW"}
                  </button>
                </div>
                <div className="w-[45%] h-full flex items-center justify-center">
                  <img
                    src={categoryBanner.image_url}
                    alt={categoryBanner.title}
                    className="w-full h-full object-cover rounded-xl"
                    onError={(e) => (e.target.style.display = "none")}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Filters row */}
          <div className="flex gap-2 px-2.5 py-2 bg-[#f8f8f8] overflow-x-auto scrollbar-hide">
            <button
              onClick={() => setShowFilters(true)}
              className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-full px-3.5 py-1.5 text-xs font-semibold text-gray-700 whitespace-nowrap active:scale-95 transition-transform"
            >
              Filters <SlidersHorizontal className="w-3.5 h-3.5" />
              {(filters.availability !== "all" || filters.rating !== "all" || sortBy !== "relevance") && (
                <span className="w-2 h-2 rounded-full bg-[#0c831f]" />
              )}
            </button>
            <button
              onClick={() => toast.info(`${activeCategoryName} — showing all items`)}
              className="bg-white border border-gray-200 rounded-full px-3.5 py-1.5 text-xs font-semibold text-gray-700 whitespace-nowrap active:scale-95"
            >
              {activeCategoryName || "Category"} • {displayedProducts.length}
            </button>
          </div>

          <div className="px-2.5 pt-1">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-gray-900 mb-2">
                {activeCategoryName}
              </h2>
              <span className="text-xs text-gray-500">{displayedProducts.length} items</span>
            </div>
          </div>

          {isLoading ? (
            <div id="products-grid" className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 px-2.5">
              {Array(8).fill(0).map((_, i) => (
                <div key={i} className="bg-white rounded-xl p-2 border border-gray-100 space-y-1.5">
                  <Skeleton className="h-28 w-full rounded-xl" />
                  <Skeleton className="h-3 w-3/4 rounded" />
                  <Skeleton className="h-2.5 w-1/2 rounded" />
                  <Skeleton className="h-6 w-full rounded-lg" />
                </div>
              ))}
            </div>
          ) : displayedProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-2.5">
              <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center text-xl mb-2">📦</div>
              <p className="text-xs font-semibold text-gray-700">No products match filters</p>
              <button onClick={() => { setFilters({ availability: "all", rating: "all" }); setSortBy("relevance"); }} className="mt-3 text-xs text-[#0c831f] font-semibold">Clear filters</button>
            </div>
          ) : (
            <div id="products-grid" className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 px-2.5">
              {displayedProducts.map((product) => {
                const cartQty = getCartQuantity(product.id);
                const inStock = isProductInStock(product);
                const hasDiscount = product.original_price && product.original_price > product.price;
                const discountPct = hasDiscount ? Math.round(((product.original_price - product.price) / product.original_price) * 100) : 0;
                const optionsCount = product.dhaba_options?.length || 0;

                return (
                  <div key={product.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden flex flex-col">
                    {/* Image with blue + */}
                    <div className="relative h-32 bg-white p-2">
                      <Link to={createPageUrl(`ProductDetails?id=${product.id}`)} className="block w-full h-full">
                        <div className="w-full h-full flex items-center justify-center rounded-lg overflow-hidden bg-white">
                          {product.image_url ? (
                            <img
                              src={product.image_url}
                              alt={product.name}
                              className="max-h-full max-w-full object-contain"
                              loading="lazy"
                              onError={(e) => {
                                e.target.style.display = "none";
                                if (e.target.nextSibling) e.target.nextSibling.style.display = "flex";
                              }}
                            />
                          ) : null}
                          <div className={`w-full h-full items-center justify-center text-2xl bg-gray-50 rounded-lg ${product.image_url ? "hidden" : "flex"}`}>
                            🛍️
                          </div>
                        </div>
                      </Link>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (!inStock) {
                            toast.error(`${product.name} is out of stock`);
                            return;
                          }
                          updateCartQuantity(product, 1);
                        }}
                        className={`absolute top-2 right-2 w-7 h-7 bg-white border rounded-lg flex items-center justify-center shadow-sm active:scale-90 transition-transform ${inStock ? "border-[#2563eb] hover:bg-blue-50" : "border-gray-300 opacity-60 cursor-not-allowed"}`}
                      >
                        <Plus className={`w-4 h-4 ${inStock ? "text-[#2563eb]" : "text-gray-400"}`} strokeWidth={2.5} />
                      </button>
                      {hasDiscount && (
                        <div className="absolute top-2 left-2 bg-[#2563eb] text-white text-[8px] font-bold px-1 py-0.5 rounded">
                          {discountPct}% OFF
                        </div>
                      )}
                    </div>

                    {/* Details */}
                    <div className="p-2 pt-1 flex-1 flex flex-col">
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-medium">Ad</span>
                      </div>
                      <div className="flex items-center gap-1 mt-1 text-[10px] font-bold text-gray-500">
                        <Clock className="w-3 h-3" />
                        <span>17 MINS</span>
                      </div>
                      <Link to={createPageUrl(`ProductDetails?id=${product.id}`)}>
                        <h3 className="font-bold text-[12px] text-gray-900 line-clamp-2 leading-tight mt-1 min-h-[2.2rem]">
                          {product.name}
                        </h3>
                      </Link>
                      <div className="mt-auto pt-2 flex items-center justify-between">
                        <span className="font-bold text-sm text-gray-900">₹{product.price}</span>
                        {hasDiscount && (
                          <span className="text-[11px] font-bold text-emerald-600">{discountPct}% OFF</span>
                        )}
                      </div>
                      {cartQty > 0 && (
                        <div className="mt-2 flex items-center justify-between bg-emerald-50 rounded-lg h-7 px-1 border border-emerald-200">
                          <button
                            onClick={() => updateCartQuantity(product, -1)}
                            className="w-6 h-full flex items-center justify-center font-bold text-emerald-700 active:scale-90"
                          >
                            −
                          </button>
                          <span className="font-bold text-xs text-emerald-700 min-w-[16px] text-center">
                            {cartQty}
                          </span>
                          <button
                            onClick={() => updateCartQuantity(product, 1)}
                            className="w-6 h-full flex items-center justify-center font-bold text-emerald-700 active:scale-90"
                          >
                            +
                          </button>
                        </div>
                      )}
                  </div>
                </div>
                );
              })}
            </div>
            )}
          </div>
        </div>
      </div>

      <FilterSheet
        open={showFilters}
        onOpenChange={setShowFilters}
        products={products}
        filters={filters}
        onFilterChange={setFilters}
        sortBy={sortBy}
        onSortChange={setSortBy}
        subFilters={subFilters}
        setSubFilters={setSubFilters}
      />
      </>
  );
}
