import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Sparkles, Loader2 } from "lucide-react";
import { enrichProductsWithHostelStock } from "@/utils/hostelStockHelper";
import CompactProductCard from "./CompactProductCard";

export default function RecommendationEngine({ user, onAddToCart, getCartQuantity, onUpdateQuantity, context = "shop" }) {
  const [recommendations, setRecommendations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    if (user) {
      loadSettings();
    }
  }, [user]);

  const loadSettings = async () => {
    try {
      // RecommendationSettings entity doesn't exist — use defaults
      const config = {
        strategy: "popular",
        use_purchase_history: true,
        use_browsing_behavior: true,
        use_loyalty_tier: true,
        max_recommendations: 8,
        boost_high_margin: false
      };
      setSettings(config);
      loadRecommendations(config);
    } catch (error) {
      console.error("Error loading settings:", error);
      loadRecommendations(null);
    }
  };

  const loadRecommendations = async (config) => {
    setIsLoading(true);
    try {
      const useAI = config?.strategy === "ai_powered";
      
      if (useAI) {
        await loadAIRecommendations(config);
      } else {
        await loadBasicRecommendations(config);
      }
    } catch (error) {
      console.error("Error loading recommendations:", error);
    }
    setIsLoading(false);
  };

  const loadAIRecommendations = async (config) => {
    try {
      const orders = config?.use_purchase_history ? await base44.entities.Order.filter({ user_id: user.id }) : [];
      const viewedProducts = config?.use_browsing_behavior ? JSON.parse(localStorage.getItem(`viewed_products_${user.id}`) || "[]") : [];
      let allProducts = await base44.entities.Product.filter({ is_available: true });
      
      // Enrich with hostel stock if user is logged in
      if (user?.selected_hostel) {
        allProducts = await enrichProductsWithHostelStock(allProducts, user.selected_hostel);
      } else {
        allProducts = allProducts.map(p => ({
          ...p,
          hostel_stock_quantity: p.stock_quantity || 0
        }));
      }
      // Only keep in-stock and available items
      allProducts = allProducts.filter(p => (p.hostel_stock_quantity || 0) > 0);
      
      // Build user context
      const purchasedProducts = [];
      const categoryFrequency = {};
      
      orders.forEach(order => {
        order.items?.forEach(item => {
          purchasedProducts.push(item.product_name);
          const product = allProducts.find(p => p.id === item.product_id);
          if (product) {
            categoryFrequency[product.category_id] = (categoryFrequency[product.category_id] || 0) + 1;
          }
        });
      });

      const recentlyViewed = viewedProducts.slice(0, 5).map(pid => 
        allProducts.find(p => p.id === pid)?.name
      ).filter(Boolean);

      const userTier = config?.use_loyalty_tier ? (user.loyalty_tier || "Bronze") : null;

      // Call AI for recommendations
      const prompt = `You are a product recommendation AI for CollegeCart grocery delivery.

User Profile:
- Loyalty Tier: ${userTier || "Not available"}
- Purchase History: ${purchasedProducts.slice(-10).join(", ") || "No previous purchases"}
- Recently Viewed: ${recentlyViewed.join(", ") || "None"}
- Selected Hostel: ${user.selected_hostel || "Not specified"}

Available Products:
${allProducts.map(p => `- ${p.name} (₹${p.price}, Category: ${p.category_id}, Margin: ${p.profit_margin || 0}%)`).slice(0, 50).join("\n")}

Context: ${context === "shop" ? "Main shop page" : context === "checkout" ? "Checkout page" : "Product detail page"}

Instructions:
- Recommend ${config?.max_recommendations || 8} products that match user preferences
- Consider purchase history and browsing patterns
${config?.use_loyalty_tier ? `- Tier-based: ${userTier === "Platinum" || userTier === "Gold" ? "Premium products" : "Value products"}` : ""}
${config?.boost_high_margin ? "- Prioritize products with profit margin > 15%" : ""}
${config?.boost_new_products ? "- Include newly added products" : ""}
- Only recommend available products
- Diversify across categories
- Avoid recently purchased items

Return ONLY a JSON array of product names: ["Product Name 1", "Product Name 2", ...]`;

      const aiResponse = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            recommendations: {
              type: "array",
              items: { type: "string" }
            }
          }
        }
      });

      const recommendedNames = aiResponse.recommendations || [];
      let recommendedProducts = recommendedNames
        .map(name => allProducts.find(p => p.name === name))
        .filter(Boolean);

      const limit = context === "checkout" ? 4 : (config?.max_recommendations || 8);

      // Backfill with high-margin/relevant items if we don't have enough recommendations
      if (recommendedProducts.length < limit) {
        const existingIds = new Set(recommendedProducts.map(p => p.id));
        
        const backfillItems = allProducts
          .filter(p => !existingIds.has(p.id))
          .map(product => {
            let score = Number(product.profit_margin || 0);
            if (categoryFrequency[product.category_id]) score += 50;
            if (viewedProducts.includes(product.id)) score += 20;
            if (product.rating >= 4) score += 15;
            return { ...product, score };
          })
          .sort((a, b) => b.score - a.score);

        const needed = limit - recommendedProducts.length;
        recommendedProducts = [...recommendedProducts, ...backfillItems.slice(0, needed)];
      }

      setRecommendations(recommendedProducts.slice(0, limit));
    } catch (error) {
      console.error("AI recommendation failed, falling back to basic:", error);
      await loadBasicRecommendations(config);
    }
  };

  const loadBasicRecommendations = async (config) => {
    try {
      const orders = config?.use_purchase_history ? await base44.entities.Order.filter({ user_id: user.id }) : [];
      const viewedProducts = config?.use_browsing_behavior ? JSON.parse(localStorage.getItem(`viewed_products_${user.id}`) || "[]") : [];
      let allProducts = await base44.entities.Product.filter({ is_available: true });
      
      // Enrich with hostel stock if user is logged in
      if (user?.selected_hostel) {
        allProducts = await enrichProductsWithHostelStock(allProducts, user.selected_hostel);
      } else {
        allProducts = allProducts.map(p => ({
          ...p,
          hostel_stock_quantity: p.stock_quantity || 0
        }));
      }
      // Only keep in-stock and available items
      allProducts = allProducts.filter(p => (p.hostel_stock_quantity || 0) > 0);
      
      const purchasedProductIds = new Set();
      const categoryFrequency = {};
      
      orders.forEach(order => {
        order.items?.forEach(item => {
          purchasedProductIds.add(item.product_id);
          const product = allProducts.find(p => p.id === item.product_id);
          if (product) {
            categoryFrequency[product.category_id] = (categoryFrequency[product.category_id] || 0) + 1;
          }
        });
      });

      const topCategories = Object.entries(categoryFrequency)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([categoryId]) => categoryId);

      const scoredProducts = allProducts.map(product => {
        // Base score is profit margin (higher margin is suggested first for new users)
        let score = Number(product.profit_margin || 0);
        
        // Boost based on purchases and browsing history
        if (topCategories.includes(product.category_id)) {
          score += 50;
        }
        
        const viewIndex = viewedProducts.indexOf(product.id);
        if (viewIndex !== -1) {
          score += 30 - viewIndex;
        }
        
        if (product.rating >= 4) {
          score += 15;
        }
        
        if (product.original_price && product.original_price > product.price) {
          score += 10;
        }

        // Slightly deprioritize already purchased items to encourage discovery, but keep them available
        if (purchasedProductIds.has(product.id)) {
          score -= 10;
        }

        return { ...product, score };
      });

      // Sort by score descending and take top N
      const limit = context === "checkout" ? 4 : (config?.max_recommendations || 8);
      const topRecommendations = scoredProducts
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      setRecommendations(topRecommendations);
    } catch (error) {
      console.error("Error loading recommendations:", error);
    }
  };

  if (!user || recommendations.length === 0) return null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
        <span className="ml-2 text-gray-600">Loading personalized recommendations...</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-0.5">
        <Sparkles className="w-4 h-4 text-[#0c831f]" />
        <h2 className="text-[15px] font-bold text-gray-900">
          {context === "checkout" ? "You May Also Like" : "Recommended For You"}
        </h2>
        {settings?.strategy === "ai_powered" && (
          <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-semibold">AI Powered</span>
        )}
      </div>
      
      <div className="relative -mx-1">
        <div className="flex gap-2.5 overflow-x-auto pb-3 px-1 scrollbar-hide snap-x snap-mandatory items-stretch product-scroll">
          {recommendations.map((product) => {
            const cartQuantity = getCartQuantity ? getCartQuantity(product.id) : 0;
            const stock = product.hostel_stock_quantity !== undefined ? product.hostel_stock_quantity : product.stock_quantity;
            const isInStock = (stock || 0) > 0 || cartQuantity > 0;
            const isMaxStock = cartQuantity >= (stock || 0);
            
            return (
              <div key={product.id} className="flex-shrink-0 w-[132px] snap-start">
                <CompactProductCard
                  product={product}
                  cartQty={cartQuantity}
                  onAddToCart={onAddToCart}
                  onUpdateQuantity={onUpdateQuantity}
                  inStock={isInStock}
                  maxReached={isMaxStock}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}