import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";

export default function RecommendedProducts({ onAddToCart, cartItems, amountNeededForFreeDelivery }) {
  const [recommendedProducts, setRecommendedProducts] = useState([]);
  const [imageLoaded, setImageLoaded] = useState({});

  useEffect(() => {
    loadRecommendedProducts();
  }, [cartItems, amountNeededForFreeDelivery]);

  const loadRecommendedProducts = async () => {
    try {
      // Get categories from current cart items
      const cartProductIds = cartItems.map(item => item.product_id);
      const cartProducts = await Promise.all(
        cartProductIds.map(id => base44.entities.Product.filter({ id }).then(results => results[0]))
      );
      const cartCategoryIds = [...new Set(cartProducts.map(p => p?.category_id).filter(Boolean))];

      // Get all products
      const allProducts = await base44.entities.Product.filter(
        { is_available: true },
        '-profit_margin'
      );
      
      // Filter out products that are out of stock
      const inStockProducts = allProducts.filter(p => p.stock_quantity > 0);
      
      let filtered;
      
      // If user needs specific amount for free delivery, recommend products at or near that price
      if (amountNeededForFreeDelivery && amountNeededForFreeDelivery > 0) {
        // Get products within ±5 of the needed amount, prioritizing exact matches
        filtered = inStockProducts.filter(p => 
          !cartProductIds.includes(p.id) &&
          Math.abs(p.price - amountNeededForFreeDelivery) <= 5
        ).sort((a, b) => {
          const diffA = Math.abs(a.price - amountNeededForFreeDelivery);
          const diffB = Math.abs(b.price - amountNeededForFreeDelivery);
          return diffA - diffB;
        }).slice(0, 8);
        
        // If not enough products found in that range, add more from same categories
        if (filtered.length < 8) {
          const additional = inStockProducts.filter(p => 
            cartCategoryIds.includes(p.category_id) &&
            p.profit_margin > 0 &&
            !cartProductIds.includes(p.id) &&
            !filtered.find(f => f.id === p.id)
          ).slice(0, 8 - filtered.length);
          
          filtered = [...filtered, ...additional];
        }
      } else {
        // Show all recommended products with higher profit from same categories
        filtered = inStockProducts.filter(p => 
          cartCategoryIds.includes(p.category_id) &&
          p.profit_margin > 0 &&
          !cartProductIds.includes(p.id)
        ).slice(0, 8);
      }
      
      setRecommendedProducts(filtered);
    } catch (error) {
      console.error("Error loading recommended products:", error);
    }
  };

  if (recommendedProducts.length === 0) return null;

  return (
    <Card className="mt-3 sm:mt-6 border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-white">
      <CardHeader className="p-3 sm:p-4 pb-2">
        <CardTitle className="flex items-center gap-2 text-emerald-800 text-sm sm:text-base flex-wrap">
          <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
          <span className="flex-1 min-w-0">
            {amountNeededForFreeDelivery > 0 
              ? `Add ₹${amountNeededForFreeDelivery.toFixed(0)} more for FREE Delivery!`
              : 'Perfect Match For You'}
          </span>
          <Badge className="bg-emerald-600 text-[10px] sm:text-xs px-2 py-0.5">
            {amountNeededForFreeDelivery > 0 ? 'Perfect Match' : 'Best Deals'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 sm:p-4 pt-0">
        <p className="text-xs text-gray-600 mb-3">Based on your preferences and purchase history</p>
        
        <div className="grid grid-cols-2 gap-3">
          {recommendedProducts.map((product) => {
            return (
              <div key={product.id}>
                <Card className="group overflow-hidden hover:shadow-lg transition-all duration-300 border border-gray-200 bg-white rounded-xl flex flex-col h-[220px]">
                  <div className="relative overflow-hidden bg-white p-2 flex-shrink-0">
                    {/* Free Delivery Badge */}
                    <div className="absolute top-1 left-1 bg-emerald-500 text-white text-[9px] font-semibold px-1.5 py-0.5 rounded-full flex items-center gap-1 z-10">
                      <span>Free Delivery</span>
                      <span className="text-[8px]">⏱ {product.delivery_time || '10 mins'}</span>
                    </div>
                    
                    {/* Product Image */}
                    {!imageLoaded[product.id] && (
                      <div className="w-full h-20 bg-gray-200 skeleton animate-pulse rounded" />
                    )}
                    <img
                      src={product.image_url || "https://images.unsplash.com/photo-1542838132-92c53300491e?w=100"}
                      alt={product.name}
                      loading="lazy"
                      onLoad={() => setImageLoaded(prev => ({ ...prev, [product.id]: true }))}
                      onError={(e) => e.target.src = "https://images.unsplash.com/photo-1542838132-92c53300491e?w=100"}
                      className={`w-full h-20 object-contain transition-all duration-500 ${
                        imageLoaded[product.id] ? 'opacity-100' : 'opacity-0'
                      }`}
                      style={{ transition: 'opacity 200ms ease-in' }}
                    />
                  </div>

                  <CardContent className="p-2 flex flex-col flex-1 justify-between">
                    <div className="flex-shrink-0">
                      <h3 className="font-semibold text-xs mb-0.5 line-clamp-1 text-gray-900 leading-tight h-4">
                        {product.name}
                      </h3>
                      <p className="text-[10px] text-gray-500 mb-1.5 h-3">{product.unit || '100'}</p>
                      
                      <div className="flex items-baseline gap-1 mb-2 h-5">
                        <span className="text-base font-bold text-gray-900">₹{product.price}</span>
                        {product.original_price && product.original_price > product.price && (
                          <span className="text-[10px] text-gray-400 line-through">₹{product.original_price}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex-shrink-0">
                      <button
                        onClick={() => onAddToCart(product)}
                        className="w-full bg-white hover:bg-emerald-50 border-2 border-emerald-600 text-emerald-600 text-xs font-semibold py-1.5 rounded-lg transition-all"
                      >
                        ADD
                      </button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}