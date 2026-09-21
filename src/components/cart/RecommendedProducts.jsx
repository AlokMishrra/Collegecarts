import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";
import CompactProductCard from "@/components/shop/CompactProductCard";

export default function RecommendedProducts({ onAddToCart, cartItems, amountNeededForFreeDelivery }) {
  const [recommendedProducts, setRecommendedProducts] = useState([]);

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
              <CompactProductCard
                key={product.id}
                product={product}
                cartQty={0}
                onAddToCart={onAddToCart}
                inStock={(product.stock_quantity || 0) > 0}
              />
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}