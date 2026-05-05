import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useSEO } from "@/lib/useSEO";
import { Product } from "@/entities/Product";
import { base44 } from "@/api/base44Client";
import { Category } from "@/entities/Category";
import { CartItem } from "@/entities/CartItem";
import { User } from "@/entities/User";
import { logErrorToDB } from "@/utils/supabaseWithLogging";
import { notifyCartUpdate } from "@/utils/cartEvents";
import { toast } from "sonner";
import { Building2, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import QuickAddToCart from "../components/shop/QuickAddToCart";
  import EnhancedShopHero from "../components/shop/EnhancedShopHero";
  import CategorySection from "../components/shop/CategorySection";
  import CategoryFilter from "../components/shop/CategoryFilter";
  import ProductCard from "../components/shop/ProductCard";
  import HostelSelector from "../components/shop/HostelSelector";
  import RecommendationEngine from "../components/shop/RecommendationEngine";
  import EnhancedSearch from "../components/shop/EnhancedSearch";
  import BannerCarousel from "../components/shop/BannerCarousel";
  import ComboSection from "../components/shop/ComboSection";

export default function Shop() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [cartItems, setCartItems] = useState([]);
  const [categorizedProducts, setCategorizedProducts] = useState({});
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [showHostelSelector, setShowHostelSelector] = useState(false);
  const [filters, setFilters] = useState({
    availability: "all",
    rating: "all",
    priceRange: [0, 1000]
  });
  const [sortBy, setSortBy] = useState("relevance");
  
  // Infinite scroll states
  const [displayedProducts, setDisplayedProducts] = useState([]);
  const [page, setPage] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const observerTarget = React.useRef(null);
  const PRODUCTS_PER_PAGE = 12;

  useEffect(() => {
    useSEO({
      title: "Shop – Groceries, Snacks & Essentials",
      description: "Order groceries, snacks, beverages, and daily essentials for delivery to your hostel room in 10 minutes. Student-friendly prices. CollegeCart.",
      url: "/Shop",
    });
    checkUser();
    loadData();
    // Real-time product stock subscription — handles both updates and new products
    const unsubscribe = Product.subscribe((event) => {
      if (event.type === 'update' && event.data) {
        // Bust the cache so next load gets fresh data
        sessionStorage.removeItem('cc_products_cache');
        // Update in-memory state immediately — no reload needed
        setProducts(prev => prev.map(p => p.id === event.id ? { ...p, ...event.data } : p));
      }
      if (event.type === 'create' && event.data) {
        // New product added — bust cache and add to list
        sessionStorage.removeItem('cc_products_cache');
        setProducts(prev => {
          if (prev.find(p => p.id === event.id)) return prev;
          return [event.data, ...prev];
        });
      }
      if (event.type === 'delete') {
        sessionStorage.removeItem('cc_products_cache');
        setProducts(prev => prev.filter(p => p.id !== event.id));
      }
    });
    
    // Clear cache on logout
    const handleStorageChange = () => {
      const savedUser = localStorage.getItem('user');
      if (!savedUser) {
        sessionStorage.removeItem('cc_products_cache');
        sessionStorage.removeItem('cc_categories_cache');
      }
    };
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      unsubscribe();
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  useEffect(() => {
    // Categorize products
    const categorized = {};
    categories.forEach(category => {
      categorized[category.id] = products.filter(p => p.category_id === category.id);
    });
    setCategorizedProducts(categorized);
  }, [products, categories]);
  
  // Infinite scroll effect
  useEffect(() => {
    const filtered = applyFiltersAndSort(products);
    const initialProducts = filtered.slice(0, PRODUCTS_PER_PAGE);
    setDisplayedProducts(initialProducts);
    setPage(1);
    setHasMore(filtered.length > PRODUCTS_PER_PAGE);
  }, [products, searchQuery, selectedCategory, filters, sortBy]);
  
  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          loadMoreProducts();
        }
      },
      { threshold: 0.1 }
    );
    
    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }
    
    return () => {
      if (observerTarget.current) {
        observer.unobserve(observerTarget.current);
      }
    };
  }, [hasMore, isLoadingMore, page]);
  
  const loadMoreProducts = () => {
    setIsLoadingMore(true);
    const filtered = applyFiltersAndSort(products);
    const nextPage = page + 1;
    const startIndex = page * PRODUCTS_PER_PAGE;
    const endIndex = startIndex + PRODUCTS_PER_PAGE;
    const nextProducts = filtered.slice(startIndex, endIndex);
    
    setTimeout(() => {
      setDisplayedProducts(prev => [...prev, ...nextProducts]);
      setPage(nextPage);
      setHasMore(endIndex < filtered.length);
      setIsLoadingMore(false);
    }, 300);
  };

  const checkUser = async () => {
    try {
      const currentUser = await User.me();
      setUser(currentUser);
      
      // Check if user has selected hostel
      if (!currentUser.selected_hostel) {
        setShowHostelSelector(true);
      }
      
      loadCartItems(currentUser.id);
    } catch (error) {
      // User not logged in - clear cache
      sessionStorage.removeItem('cc_products_cache');
      sessionStorage.removeItem('cc_categories_cache');
    }
  };

  const handleHostelSelected = (hostel) => {
    setShowHostelSelector(false);
    setUser(prev => ({ ...prev, selected_hostel: hostel }));
    loadData();
  };

  const getHostelStock = (product) => {
    if (!user?.selected_hostel || user.selected_hostel === 'Other') {
      return product.stock_quantity || 0;
    }
    // Check if hostel_stock exists and has a value for this hostel
    if (product.hostel_stock && typeof product.hostel_stock[user.selected_hostel] === 'number') {
      return product.hostel_stock[user.selected_hostel];
    }
    // If no hostel-specific stock defined, fall back to total stock
    return product.stock_quantity || 0;
  };

  const isProductInStock = (product) => {
    // Check database is_available flag (updated by cron job based on schedule)
    if (product.is_available === false) {
      return false; // Out of stock if marked unavailable
    }
    
    const hostelStock = getHostelStock(product);
    return hostelStock > 0;
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Check session storage cache first
      const productsCache = sessionStorage.getItem('cc_products_cache');
      const categoriesCache = sessionStorage.getItem('cc_categories_cache');
      const now = Date.now();
      const CACHE_DURATION = 30 * 1000; // 30 seconds — realtime handles the rest
      
      let productsData = null;
      let categoriesData = null;
      
      // Try to use cached products
      if (productsCache) {
        try {
          const cached = JSON.parse(productsCache);
          if (cached.timestamp && (now - cached.timestamp) < CACHE_DURATION) {
            productsData = cached.data;
          }
        } catch (e) {
          sessionStorage.removeItem('cc_products_cache');
        }
      }
      
      // Try to use cached categories
      if (categoriesCache) {
        try {
          const cached = JSON.parse(categoriesCache);
          if (cached.timestamp && (now - cached.timestamp) < CACHE_DURATION) {
            categoriesData = cached.data;
          }
        } catch (e) {
          sessionStorage.removeItem('cc_categories_cache');
        }
      }
      
      // Fetch fresh data if cache is stale or missing
      const fetchPromises = [];
      if (!productsData) {
        fetchPromises.push(
          Product.list('-created_date', 500).catch(() => [])
            .then(data => {
              productsData = data;
              sessionStorage.setItem('cc_products_cache', JSON.stringify({ data, timestamp: now }));
              return data;
            })
        );
      }
      
      if (!categoriesData) {
        fetchPromises.push(
          Category.filter({ is_active: true }, 'display_order', 50).catch(() => [])
            .then(data => {
              categoriesData = data;
              sessionStorage.setItem('cc_categories_cache', JSON.stringify({ data, timestamp: now }));
              return data;
            })
        );
      }
      
      if (fetchPromises.length > 0) {
        await Promise.all(fetchPromises);
      }

      const activeCategoryIds = categoriesData.map(cat => cat.id);
      
      // Filter products by active categories only (don't filter by time)
      const productsWithActiveCategories = productsData.filter(product => 
        activeCategoryIds.includes(product.category_id)
      );

      setProducts(productsWithActiveCategories);
      setCategories(categoriesData);
    } catch (error) {
      await logErrorToDB('API', error.message, '/shop', error.stack);
      console.error("Error loading data:", error);
      setProducts([]);
      setCategories([]);
    }
    setIsLoading(false);
  };

  const loadCartItems = async (userId) => {
    try {
      const items = await CartItem.filter({ user_id: userId }, '-created_date', 50).catch(() => []);
      setCartItems(items);
    } catch (error) {
      await logErrorToDB('API', error.message, '/shop/cart', error.stack);
      console.error("Error loading cart:", error);
      setCartItems([]);
    }
  };

  const updateCartQuantity = useCallback(async (product, quantityChange) => {
    if (!user) {
      window.location.href = '/login';
      return;
    }

    if (quantityChange > 0 && !isProductInStock(product)) {
      toast.error(`${product.name} is currently out of stock`);
      return;
    }

    const existingItem = cartItems.find(item => item.product_id === product.id);
    const hostelStock = getHostelStock(product);
    const newQuantity = existingItem ? existingItem.quantity + quantityChange : 1;
    
    if (newQuantity > hostelStock) {
      toast.warning(`Only ${hostelStock} unit${hostelStock === 1 ? '' : 's'} available`);
      return;
    }

    // Optimistic update - update UI immediately with full product data
    if (existingItem) {
      if (newQuantity <= 0) {
        setCartItems(prev => prev.filter(item => item.product_id !== product.id));
      } else {
        setCartItems(prev => prev.map(item => 
          item.product_id === product.id ? { ...item, quantity: newQuantity } : item
        ));
      }
    } else if (quantityChange > 0) {
      // Create a temporary cart item with all necessary data
      const tempCartItem = {
        id: 'temp-' + Date.now(),
        product_id: product.id,
        user_id: user.id,
        quantity: 1,
        product_name: product.name,
        price: product.price,
        created_date: new Date().toISOString()
      };
      setCartItems(prev => [...prev, tempCartItem]);
    }

    // Background API call
    try {
      let createdItem = null;
      if (existingItem) {
        if (newQuantity <= 0) {
          await CartItem.delete(existingItem.id);
        } else {
          await CartItem.update(existingItem.id, { quantity: newQuantity });
        }
      } else if (quantityChange > 0) {
        createdItem = await CartItem.create({
          product_id: product.id,
          user_id: user.id,
          quantity: 1
        });
        
        // Replace temp item with real item from database
        if (createdItem) {
          setCartItems(prev => prev.map(item => 
            item.id.toString().startsWith('temp-') && item.product_id === product.id
              ? { ...item, id: createdItem.id }
              : item
          ));
        }
      }
      
      // Notify Layout component to update cart count
      notifyCartUpdate();
      
      // Refresh cart in background to ensure sync
      setTimeout(() => loadCartItems(user.id), 500);
    } catch (error) {
      await logErrorToDB('API', error.message, '/shop/updateCart', error.stack);
      console.error("Error updating cart:", error);
      // Revert optimistic update on error
      loadCartItems(user.id);
    }
  }, [user, cartItems, getHostelStock, isProductInStock, loadCartItems]);

  const addToCart = useCallback(async (product) => {
    await updateCartQuantity(product, 1);
  }, [updateCartQuantity]);

  const getCartQuantity = useCallback((productId) => {
    const item = cartItems.find(item => item.product_id === productId);
    return item ? item.quantity : 0;
  }, [cartItems]);

  const applyFiltersAndSort = (productList) => {
    let filtered = [...productList];

    // Apply search
    if (searchQuery.trim()) {
      const terms = searchQuery.toLowerCase().split(" ");
      filtered = filtered.filter(p => {
        const text = `${p.name} ${p.description || ""}`.toLowerCase();
        return terms.some(term => text.includes(term));
      });
    }

    // Apply category filter
    if (selectedCategory) {
      filtered = filtered.filter(p => p.category_id === selectedCategory);
    }

    // Apply price range filter
    filtered = filtered.filter(p => 
      p.price >= filters.priceRange[0] && p.price <= filters.priceRange[1]
    );

    // Apply availability filter
    if (filters.availability === "in_stock") {
      filtered = filtered.filter(p => {
        if (user?.selected_hostel && user.selected_hostel !== 'Other') {
          return (p.hostel_stock?.[user.selected_hostel] || 0) > 0;
        }
        return p.stock_quantity > 0;
      });
    }

    // Apply rating filter
    if (filters.rating !== "all") {
      const minRating = parseFloat(filters.rating);
      filtered = filtered.filter(p => (p.average_rating || 0) >= minRating);
    }

    // Apply sorting
    switch (sortBy) {
      case "price_low":
        filtered.sort((a, b) => a.price - b.price);
        break;
      case "price_high":
        filtered.sort((a, b) => b.price - a.price);
        break;
      case "rating":
        filtered.sort((a, b) => (b.average_rating || 0) - (a.average_rating || 0));
        break;
      default:
        // relevance - keep original order
        break;
    }

    return filtered;
  };

  const filteredProducts = useMemo(() => applyFiltersAndSort(products), [
    products,
    searchQuery,
    selectedCategory,
    filters,
    sortBy
  ]);

  const handleRefresh = async () => {
    await loadData();
    if (user) {
      await loadCartItems(user.id);
    }
  };

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto space-y-8 pb-tab-bar page-enter">
      {/* Hostel Selector Modal — rendered via portal so it always overlays everything */}
      {showHostelSelector && (
        <HostelSelector
          onHostelSelected={handleHostelSelected}
          onClose={() => setShowHostelSelector(false)}
          currentHostel={user?.selected_hostel}
        />
      )}

      {/* Enhanced Header */}
      <EnhancedShopHero />

      {/* Banner Carousel */}
      <BannerCarousel />

      {/* Combos at TOP */}
      <ComboSection onAddComboToCart={async (combo) => {
        if (!user) { await base44.auth.redirectToLogin(); return; }
        // Add each product in the combo to cart
        const { CartItem } = await import("@/entities/CartItem");
        for (const pid of (combo.product_ids || [])) {
          const existing = cartItems.find(i => i.product_id === pid);
          if (existing) {
            await CartItem.update(existing.id, { quantity: existing.quantity + 1 });
          } else {
            await CartItem.create({ product_id: pid, user_id: user.id, quantity: 1 });
          }
        }
        notifyCartUpdate();
        loadCartItems(user.id);
      }} />

      {/* Change Hostel Button */}
      {user?.selected_hostel && (
        <div className="flex items-center justify-between bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
              <Building2 className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-gray-600">Delivering to</p>
              <p className="text-sm font-semibold text-gray-900">
                {user.selected_hostel} Hostel
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowHostelSelector(true)}
            className="border-emerald-300 text-emerald-700 hover:bg-emerald-100 rounded-full px-4"
          >
            Change
          </Button>
        </div>
      )}

      {/* Enhanced Search */}
      <EnhancedSearch
        products={products}
        onSearch={setSearchQuery}
        filters={filters}
        onFilterChange={setFilters}
        sortBy={sortBy}
        onSortChange={setSortBy}
      />

      {/* Category Filter */}
      <CategoryFilter
        categories={categories}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
      />

      {/* Personalized Recommendations */}
      {!searchQuery.trim() && !selectedCategory && filters.availability === "all" && filters.rating === "all" && user && (
        <div>
          <RecommendationEngine 
            user={user} 
            onAddToCart={addToCart}
            onUpdateQuantity={updateCartQuantity}
            getCartQuantity={getCartQuantity}
            context="shop"
          />
        </div>
      )}

      {/* Category Sections */}
      {isLoading ? (
        <div className="space-y-10">
          {Array(3).fill(0).map((_, i) => (
            <div key={i} className="space-y-4">
              <Skeleton className="h-10 w-64 mb-6 rounded-xl" />
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {Array(5).fill(0).map((_, j) => (
                  <Skeleton key={j} className="h-80 rounded-2xl" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : searchQuery.trim() || selectedCategory || filters.availability !== "all" || filters.rating !== "all" || sortBy !== "relevance" ? (
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
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-gray-600">
                  Found <span className="font-semibold text-gray-900">{filteredProducts.length}</span> products
                </p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {displayedProducts.map((product) => (
                  <div key={product.id}>
                    <ProductCard
                      product={product}
                      cartQuantity={getCartQuantity(product.id)}
                      onAddToCart={addToCart}
                      onUpdateQuantity={updateCartQuantity}
                      hostelStock={getHostelStock(product)}
                      isInStock={isProductInStock(product)}
                    />
                  </div>
                ))}
              </div>
              
              {/* Infinite Scroll Trigger */}
              {hasMore && (
                <div ref={observerTarget} className="py-8">
                  {isLoadingMore && (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                      {[...Array(4)].map((_, i) => (
                        <div key={i} className="animate-pulse">
                          <div className="bg-gray-200 h-48 rounded-2xl mb-3"></div>
                          <div className="bg-gray-200 h-4 rounded mb-2"></div>
                          <div className="bg-gray-200 h-4 w-2/3 rounded"></div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="space-y-12">
          {categories.filter(category => (categorizedProducts[category.id] || []).length > 0).map((category) => (
            <div
              key={category.id}
            >
              <CategorySection
                category={category}
                products={categorizedProducts[category.id] || []}
                onAddToCart={addToCart}
                onUpdateQuantity={updateCartQuantity}
                getCartQuantity={getCartQuantity}
                getHostelStock={getHostelStock}
                isProductInStock={isProductInStock}
              />
            </div>
          ))}
        </div>
      )}

      {/* Quick Add to Cart */}
      {user && cartItems.length > 0 && (
        <QuickAddToCart cartItems={cartItems} />
      )}
      </div>
    </div>
  );
}