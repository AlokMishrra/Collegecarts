import React, { useState, useEffect } from "react";
import { Product } from "@/entities/Product";
import { Category } from "@/entities/Category";
import { CartItem } from "@/entities/CartItem";
import { User } from "@/entities/User";
import { Notification } from "@/entities/Notification";
import { base44 } from "@/api/base44Client";
import { notifyCartUpdate } from "@/utils/cartEvents";
import { getProductHostelStock } from "@/utils/hostelStockHelper";
import { ArrowLeft, ShoppingCart, Plus, Minus, Star, Heart } from "lucide-react";
import ReviewSection from "../components/product/ReviewSection";
import RecommendationEngine from "../components/shop/RecommendationEngine";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { FALLBACK_IMG } from "@/components/ui/product-image";
import { useSafeImageSrc } from "@/hooks/useSafeImageSrc";

function ProductDetailImage({ src, alt, className }) {
  const safeSrc = useSafeImageSrc(src);
  if (!safeSrc) return <div className={`${className} bg-gray-200 animate-pulse rounded-lg`} />;
  return <img src={safeSrc} alt={alt} className={className} loading="lazy" />;
}

export default function ProductDetails() {
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [category, setCategory] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [cartQuantity, setCartQuantity] = useState(0);
  const [averageRating, setAverageRating] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [isInWishlist, setIsInWishlist] = useState(false);

  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  useEffect(() => {
    const init = async () => {
      await checkUser();
      // Load product after user check completes
      loadProduct();
    };
    init();
  }, []);

  // Reload product when hostel changes
  useEffect(() => {
    if (user?.selected_hostel) {
      console.log('[ProductDetails] Hostel changed, reloading product. Hostel:', user.selected_hostel);
      loadProduct();
    }
  }, [user?.selected_hostel]);

  const isProductAvailableNow = (product) => {
    if (!product.available_from || !product.available_to) return true;
    
    try {
      const now = new Date();
      const currentHours = now.getHours();
      const currentMinutes = now.getMinutes();
      const currentTime = currentHours * 60 + currentMinutes;
      
      // Parse 12-hour format with AM/PM (e.g., "08:00 AM" or "11:00 PM")
      const parseTime12Hour = (timeStr) => {
        const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
        if (!match) return null;
        
        let hours = parseInt(match[1], 10);
        const minutes = parseInt(match[2], 10);
        const period = match[3].toUpperCase();
        
        if (period === 'PM' && hours !== 12) hours += 12;
        if (period === 'AM' && hours === 12) hours = 0;
        
        return hours * 60 + minutes;
      };
      
      const fromTime = parseTime12Hour(product.available_from);
      const toTime = parseTime12Hour(product.available_to);
      
      if (fromTime === null || toTime === null) return true;
      
      return currentTime >= fromTime && currentTime <= toTime;
    } catch (error) {
      console.error("Error checking product availability time:", error, product);
      return true;
    }
  };

  const getHostelStock = (product) => {
    // Use enriched hostel stock if available
    if (product.hostel_stock_quantity !== undefined) {
      console.log('[getHostelStock] Using hostel_stock_quantity:', product.hostel_stock_quantity);
      return product.hostel_stock_quantity;
    }
    
    // Fallback to total stock
    console.log('[getHostelStock] Fallback to stock_quantity:', product.stock_quantity);
    return product.stock_quantity || 0;
  };

  const isProductInStock = (product) => {
    if (!isProductAvailableNow(product)) {
      console.log('[isProductInStock] Product not available now (time restriction)');
      return false;
    }
    const hostelStock = getHostelStock(product);
    console.log('[isProductInStock] Hostel stock:', hostelStock, 'In stock:', hostelStock > 0);
    return hostelStock > 0;
  };

  const checkUser = async () => {
    try {
      const currentUser = await User.me();
      setUser(currentUser);
      return currentUser;
    } catch (error) {
      // User not logged in
      setUser(null);
      return null;
    }
  };

  const checkWishlistStatus = async (userId, productId) => {
    try {
      const wishlistItems = await base44.entities.Wishlist.filter({
        user_id: userId,
        product_id: productId
      });
      setIsInWishlist(wishlistItems.length > 0);
    } catch (error) {
      console.error("Error checking wishlist:", error);
    }
  };

  const toggleWishlist = async () => {
    try {
      if (!user) {
        navigate('/login');
        return;
      }

      if (isInWishlist) {
        const wishlistItems = await base44.entities.Wishlist.filter({
          user_id: user.id,
          product_id: product.id
        });
        if (wishlistItems[0]) {
          await base44.entities.Wishlist.delete(wishlistItems[0].id);
          setIsInWishlist(false);
          await base44.entities.Notification.create({
            user_id: user.id,
            title: "Removed from Wishlist",
            message: `${product.name} removed from wishlist`,
            type: "info"
          });
        }
      } else {
        await base44.entities.Wishlist.create({
          user_id: user.id,
          product_id: product.id
        });
        setIsInWishlist(true);
        await base44.entities.Notification.create({
          user_id: user.id,
          title: "Added to Wishlist",
          message: `${product.name} added to wishlist`,
          type: "success"
        });
      }
    } catch (error) {
      console.error("Error toggling wishlist:", error);
    }
  };

  const loadProduct = async () => {
    try {
      setIsLoading(true);
      const urlParams = new URLSearchParams(window.location.search);
      const productId = urlParams.get('id');
      
      if (!productId) {
        navigate(createPageUrl('Shop'));
        return;
      }

      console.log('[ProductDetails] Loading product:', productId);

      const productData = await Product.filter({ id: productId });
      if (productData.length === 0) {
        navigate(createPageUrl('Shop'));
        return;
      }

      let prod = productData[0];
      
      console.log('[ProductDetails] Loaded product:', prod.name);
      console.log('[ProductDetails] Total stock from DB:', prod.stock_quantity);
      
      // Get current user (might be from state or need to fetch)
      let currentUser = user;
      if (!currentUser) {
        try {
          currentUser = await User.me();
          setUser(currentUser);
        } catch (error) {
          // Not logged in, use total stock
          console.log('[ProductDetails] No user logged in, using total stock');
        }
      }
      
      console.log('[ProductDetails] Current user hostel:', currentUser?.selected_hostel);
      
      // Enrich with hostel-specific stock
      if (currentUser?.selected_hostel && currentUser.selected_hostel !== 'Other') {
        console.log('[ProductDetails] Fetching hostel stock for:', currentUser.selected_hostel);
        const hostelStock = await getProductHostelStock(prod.id, currentUser.selected_hostel);
        console.log('[ProductDetails] Hostel stock received:', hostelStock);
        prod = {
          ...prod,
          hostel_stock_quantity: hostelStock
        };
      } else {
        console.log('[ProductDetails] Using total stock (no hostel or Other selected)');
        prod = {
          ...prod,
          hostel_stock_quantity: prod.stock_quantity
        };
      }
      
      console.log('[ProductDetails] Final product stock:', prod.hostel_stock_quantity);
      console.log('[ProductDetails] Product object:', prod);
      setProduct(prod);

      // Load category
      if (prod.category_id) {
        const categoryData = await Category.filter({ id: prod.category_id });
        if (categoryData.length > 0) {
          setCategory(categoryData[0]);
        }
      }

      // Load cart quantity if user is logged in
      if (currentUser) {
        const cartItems = await CartItem.filter({ 
          user_id: currentUser.id, 
          product_id: prod.id 
        });
        if (cartItems.length > 0) {
          setCartQuantity(cartItems[0].quantity);
        } else {
          setCartQuantity(0);
        }
        checkWishlistStatus(currentUser.id, prod.id);
      }

      // Load reviews (graceful fallback if table doesn't exist)
      try {
        const reviews = await base44.entities.Review.filter({ product_id: prod.id });
        setReviewCount(reviews.length);
        if (reviews.length > 0) {
          const avg = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
          setAverageRating(avg);
        }
      } catch (reviewErr) {
        console.warn("Reviews not available:", reviewErr.message);
        setReviewCount(0);
        setAverageRating(0);
      }
    } catch (error) {
      console.error("Error loading product:", error);
      navigate(createPageUrl('Shop'));
    } finally {
      setIsLoading(false);
    }
  };

  const addToCart = async () => {
    if (!user) {
      navigate('/login');
      return;
    }

    if (!isProductInStock(product)) {
      await Notification.create({
        user_id: user.id,
        title: "Out of Stock",
        message: `${product.name} is currently out of stock`,
        type: "error"
      });
      return;
    }

    try {
      const existingItems = await CartItem.filter({ 
        user_id: user.id, 
        product_id: product.id 
      });
      
      // Optimistic UI update - update immediately
      if (existingItems.length > 0) {
        const newQty = existingItems[0].quantity + 1;
        setCartQuantity(newQty); // Update UI immediately
        
        await CartItem.update(existingItems[0].id, {
          quantity: newQty
        });
      } else {
        setCartQuantity(1); // Update UI immediately
        
        await CartItem.create({
          product_id: product.id,
          user_id: user.id,
          quantity: 1
        });
      }

      // Notify Layout to update cart count
      notifyCartUpdate();

      // Create notification
      await Notification.create({
        user_id: user.id,
        title: "Added to Cart",
        message: `${product.name} has been added to your cart`,
        type: "success"
      });
    } catch (error) {
      console.error("Error adding to cart:", error);
      // Revert on error
      const existingItems = await CartItem.filter({ 
        user_id: user.id, 
        product_id: product.id 
      });
      setCartQuantity(existingItems.length > 0 ? existingItems[0].quantity : 0);
    }
  };

  const updateQuantity = async (newQuantity) => {
    if (!user || newQuantity < 0) return;

    if (newQuantity > 0 && !isProductInStock(product)) {
      await Notification.create({
        user_id: user.id,
        title: "Out of Stock",
        message: `${product.name} is currently out of stock`,
        type: "error"
      });
      return;
    }

    const hostelStock = getHostelStock(product);
    if (newQuantity > hostelStock) {
      await Notification.create({
        user_id: user.id,
        title: "Stock Limit Reached",
        message: `Only ${hostelStock} units available`,
        type: "warning"
      });
      return;
    }

    try {
      const existingItems = await CartItem.filter({ 
        user_id: user.id, 
        product_id: product.id 
      });
      
      if (existingItems.length > 0) {
        if (newQuantity === 0) {
          await CartItem.delete(existingItems[0].id);
        } else {
          await CartItem.update(existingItems[0].id, { quantity: newQuantity });
        }
        setCartQuantity(newQuantity);
      }
    } catch (error) {
      console.error("Error updating quantity:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-8 w-32" />
        <div className="grid md:grid-cols-2 gap-8">
          <Skeleton className="h-96 w-full rounded-lg" />
          <div className="space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) return null;

  const discountPercentage = product.original_price && product.original_price > product.price
    ? Math.round(((product.original_price - product.price) / product.original_price) * 100)
    : 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-tab-bar">
      {/* Back Button */}
      <Button
        variant="outline"
        onClick={() => navigate(createPageUrl('Shop'))}
        className="flex items-center gap-2"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Shop
      </Button>

      {/* Product Details */}
      <div className="grid md:grid-cols-2 gap-8">
        {/* Product Image */}
        <div className="relative">
          <ProductDetailImage
            src={product.image_url}
            alt={product.name}
            className="w-full h-96 object-cover rounded-lg shadow-lg"
          />
          {discountPercentage > 0 && (
            <Badge className="absolute top-4 left-4 bg-red-500 hover:bg-red-600">
              {discountPercentage}% OFF
            </Badge>
          )}
        </div>

        {/* Product Info */}
        <div className="space-y-6">
          <div>
            {category && (
              <Badge variant="outline" className="mb-2">
                {category.name}
              </Badge>
            )}
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {product.name}
            </h1>
            <div className="flex items-center gap-2 mb-4">
              <div className="flex items-center">
                {Array(5).fill(0).map((_, i) => (
                  <Star
                    key={i}
                    className={`w-4 h-4 ${i < Math.round(averageRating) ? 'text-yellow-400 fill-current' : 'text-gray-300'}`}
                  />
                ))}
              </div>
              <span className="text-sm text-gray-600">
                {averageRating > 0 ? averageRating.toFixed(1) : "No ratings"} ({reviewCount} reviews)
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-3xl font-bold text-emerald-600">
                ₹{product.price}
              </span>
              {product.original_price && product.original_price > product.price && (
                <span className="text-xl text-gray-400 line-through">
                  ₹{product.original_price}
                </span>
              )}
              <span className="text-lg text-gray-500">/{product.unit}</span>
            </div>
            {user && isProductInStock(product) && getHostelStock(product) < 10 && (
              <p className="text-orange-600 font-medium">
                Only {getHostelStock(product)} left in stock!
              </p>
            )}
          </div>

          <p className="text-gray-600 leading-relaxed">
            {product.description || "Fresh and high-quality product delivered straight to your doorstep."}
          </p>

          {/* Add to Cart Section */}
          <Card>
            <CardContent className="p-6">
              {!isProductInStock(product) ? (
                <Button disabled className="w-full h-12 bg-red-500 text-white cursor-not-allowed">
                  OUT OF STOCK
                </Button>
              ) : cartQuantity > 0 ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-center gap-4">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => updateQuantity(cartQuantity - 1)}
                      className="h-10 w-10"
                    >
                      <Minus className="w-4 h-4" />
                    </Button>
                    <span className="text-xl font-semibold px-4">{cartQuantity}</span>
                    <Button
                      size="icon"
                      onClick={() => updateQuantity(cartQuantity + 1)}
                      className="h-10 w-10 bg-emerald-600 hover:bg-emerald-700"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  <Button
                    onClick={() => navigate(createPageUrl('Cart'))}
                    className="w-full h-12 bg-emerald-600 hover:bg-emerald-700"
                  >
                    Go to Cart
                  </Button>
                </div>
                ) : (
                <div className="flex gap-2">
                 <Button
                   onClick={toggleWishlist}
                   variant="outline"
                   className="h-12 px-4"
                 >
                   <Heart className={`w-5 h-5 ${isInWishlist ? 'fill-red-500 text-red-500' : ''}`} />
                 </Button>
                 <Button
                   onClick={addToCart}
                   className="flex-1 h-12 bg-emerald-600 hover:bg-emerald-700"
                 >
                   <ShoppingCart className="w-5 h-5 mr-2" />
                   Add to Cart
                 </Button>
                </div>
                )}
            </CardContent>
          </Card>

          {/* Product Features */}
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 bg-emerald-50 rounded-lg">
              <div className="text-2xl mb-2">🚚</div>
              <p className="font-medium">Fast Delivery</p>
              <p className="text-sm text-gray-600">{product.delivery_time || "40 mins"}</p>
            </div>
            <div className="text-center p-4 bg-emerald-50 rounded-lg">
              <div className="text-2xl mb-2">🌱</div>
              <p className="font-medium">Fresh & Quality</p>
              <p className="text-sm text-gray-600">Hand-picked products</p>
            </div>
          </div>
        </div>
      </div>

      {/* Personalized Recommendations */}
      {user && (
        <RecommendationEngine
          user={user}
          onAddToCart={async (recommendedProduct) => {
            const cartItems = await CartItem.filter({ 
              user_id: user.id, 
              product_id: recommendedProduct.id 
            });
            if (cartItems.length > 0) {
              await CartItem.update(cartItems[0].id, {
                quantity: cartItems[0].quantity + 1
              });
            } else {
              await CartItem.create({
                product_id: recommendedProduct.id,
                user_id: user.id,
                quantity: 1
              });
            }
            notifyCartUpdate();
            await Notification.create({
              user_id: user.id,
              title: "Added to Cart",
              message: `${recommendedProduct.name} has been added to your cart`,
              type: "success"
            });
          }}
          getCartQuantity={(productId) => {
            return productId === product.id ? cartQuantity : 0;
          }}
          context="product_detail"
        />
      )}

      {/* Reviews Section */}
      <ReviewSection productId={product.id} product={product} />
    </div>
  );
}