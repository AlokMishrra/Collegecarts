import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ArrowLeft, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { deduplicatedFetch } from "@/utils/shopCache";

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

  const updateCartQuantity = async (product, quantityChange) => {
    if (!user) { await base44.auth.redirectToLogin(); return; }
    const existingItem = cartItems.find(i => i.product_id === product.id);
    const newQty = (existingItem?.quantity ?? 0) + quantityChange;

    if (newQty <= 0) {
      setCartItems(prev => prev.filter(i => i.product_id !== product.id));
    } else if (existingItem) {
      setCartItems(prev => prev.map(i => i.product_id === product.id ? { ...i, quantity: newQty } : i));
    } else {
      setCartItems(prev => [...prev, { id: "temp-" + Date.now(), product_id: product.id, user_id: user.id, quantity: 1, product_name: product.name, price: product.price }]);
    }

    try {
      if (existingItem) {
        if (newQty <= 0) await base44.entities.CartItem.delete(existingItem.id);
        else await base44.entities.CartItem.update(existingItem.id, { quantity: newQty });
      } else if (quantityChange > 0) {
        const created = await base44.entities.CartItem.create({ product_id: product.id, user_id: user.id, quantity: 1 });
        if (created) {
          setCartItems(prev => prev.map(i => i.id?.toString().startsWith("temp-") && i.product_id === product.id ? { ...i, id: created.id } : i));
        }
      }
      setTimeout(() => loadCartItems(user.id), 500);
    } catch (err) {
      console.error("Cart error:", err);
      loadCartItems(user.id);
    }
  };

  const getCartQuantity = (productId) => cartItems.find(i => i.product_id === productId)?.quantity ?? 0;

  return (
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
        {/* Left Sidebar - Sticky, independent scroll */}
        <div className="w-[84px] fixed top-14 left-0 bottom-0 bg-white border-r border-gray-100 overflow-y-auto scrollbar-hide z-30">
          <div className="flex flex-col py-1">
            {categories.map((cat) => {
              const isActive = cat.id === activeCategoryId;
              return (
                <button
                  key={cat.id}
                  onClick={() => handleCategorySelect(cat.id, cat.name)}
                  className={`relative flex flex-col items-center py-2 px-1 transition-all ${
                    isActive ? "bg-emerald-50/50" : "hover:bg-gray-50"
                  }`}
                >
                  {isActive && (
                    <div className="absolute right-0 top-1 bottom-1 w-[3px] bg-emerald-600 rounded-l" />
                  )}

                  <div className={`w-[60px] h-[60px] rounded-2xl overflow-hidden flex items-center justify-center p-1 border transition-all ${
                    isActive ? "bg-white border-emerald-500 shadow-xs" : "bg-gray-50 border-gray-100"
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
                    <div className={`w-full h-full items-center justify-center text-lg bg-emerald-50 text-emerald-700 font-bold ${cat.image_url ? "hidden" : "flex"}`}>
                      {cat.name?.charAt(0) || "🛒"}
                    </div>
                  </div>

                  <span className={`text-[9px] text-center leading-tight mt-1 line-clamp-2 px-0.5 ${
                    isActive ? "font-bold text-gray-900" : "font-medium text-gray-500"
                  }`}>
                    {cat.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Product Grid Area - Scrolls independently */}
        <div className="flex-1 ml-[84px] overflow-y-auto p-2.5 bg-white pb-20" style={{ height: "calc(100vh - 56px)" }}>
          <h2 className="text-sm font-bold text-gray-900 mb-2 px-0.5">
            {activeCategoryName}
          </h2>

          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {Array(8).fill(0).map((_, i) => (
                <div key={i} className="bg-white rounded-2xl p-2.5 border border-gray-100 space-y-1.5">
                  <Skeleton className="h-28 w-full rounded-xl" />
                  <Skeleton className="h-3 w-3/4 rounded" />
                  <Skeleton className="h-2.5 w-1/2 rounded" />
                  <Skeleton className="h-6 w-full rounded-lg" />
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center text-xl mb-2">📦</div>
              <p className="text-xs font-semibold text-gray-700">No products in this category</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {products.map((product) => {
                const cartQty = getCartQuantity(product.id);
                const inStock = isProductInStock(product);
                const hasDiscount = product.original_price && product.original_price > product.price;
                const discountPct = hasDiscount ? Math.round(((product.original_price - product.price) / product.original_price) * 100) : 0;
                const optionsCount = product.dhaba_options?.length || 0;

                return (
                  <div key={product.id} className="bg-white rounded-2xl border border-gray-100 p-2.5 flex flex-col justify-between shadow-xs hover:shadow-sm transition-shadow relative">
                    
                    <div>
                      <Link to={createPageUrl(`ProductDetails?id=${product.id}`)} className="block relative">
                        {hasDiscount && (
                          <div className="absolute top-0 left-0 bg-blue-600 text-white text-[8px] font-bold px-1 py-0.5 rounded-br-lg rounded-tl-xl z-10">
                            {discountPct}% OFF
                          </div>
                        )}

                        <div className="w-full h-28 sm:h-32 flex items-center justify-center p-1 bg-white rounded-xl overflow-hidden">
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
                          <div className={`w-full h-full items-center justify-center text-2xl bg-gray-50 rounded-xl ${product.image_url ? "hidden" : "flex"}`}>
                            🛍️
                          </div>
                        </div>

                        <div className="mt-1 flex items-center gap-1 text-[8px] font-bold text-gray-500 uppercase tracking-tight">
                          <Clock className="w-2.5 h-2.5" />
                          <span>{product.delivery_time || "9 MINS"}</span>
                        </div>
                      </Link>

                      <div className="mt-1">
                        <Link to={createPageUrl(`ProductDetails?id=${product.id}`)}>
                          <h3 className="font-semibold text-[11px] text-gray-900 line-clamp-2 leading-tight min-h-[2rem]">
                            {product.name}
                          </h3>
                        </Link>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {product.unit || "1 pc"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-2 pt-1 border-t border-gray-50">
                      <div className="flex items-end justify-between">
                        <div className="flex flex-col">
                          <span className="font-bold text-[11px] text-gray-900">
                            ₹{product.price}
                          </span>
                          {hasDiscount && (
                            <span className="text-[8px] text-gray-400 line-through leading-none">
                              ₹{product.original_price}
                            </span>
                          )}
                        </div>

                        <div>
                          {!inStock ? (
                            <span className="text-[8px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded">
                              Out of stock
                            </span>
                          ) : cartQty > 0 ? (
                            <div className="flex items-center bg-emerald-600 text-white rounded-md h-6 px-0.5">
                              <button
                                onClick={() => updateCartQuantity(product, -1)}
                                className="w-5 h-full flex items-center justify-center font-bold text-xs active:scale-90"
                              >
                                −
                              </button>
                              <span className="font-bold text-[10px] px-1 min-w-[14px] text-center">
                                {cartQty}
                              </span>
                              <button
                                onClick={() => updateCartQuantity(product, 1)}
                                className="w-5 h-full flex items-center justify-center font-bold text-xs active:scale-90"
                              >
                                +
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-col items-end">
                              <button
                                onClick={() => updateCartQuantity(product, 1)}
                                className="bg-white border border-emerald-500 text-emerald-600 hover:bg-emerald-50 font-bold text-[10px] px-3 py-0.5 rounded-md shadow-xs active:scale-95 transition-all"
                              >
                                ADD
                              </button>
                              {optionsCount > 0 && (
                                <span className="text-[8px] text-gray-400 mt-0.5">
                                  {optionsCount} options
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
