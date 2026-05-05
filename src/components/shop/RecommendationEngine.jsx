import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, Loader2 } from "lucide-react";
import ProductCard from "./ProductCard";

export default function RecommendationEngine({ user, onAddToCart, getCartQuantity, onUpdateQuantity, context = "shop" }) {
  const [recommendations, setRecommendations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [settings, setSettings] = useState(null);
  const [imageLoaded, setImageLoaded] = useState({});

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
      const allProducts = await base44.entities.Product.filter({ is_available: true });
      
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
      const recommendedProducts = recommendedNames
        .map(name => allProducts.find(p => p.name === name))
        .filter(Boolean)
        .slice(0, context === "checkout" ? 4 : (config?.max_recommendations || 8));

      setRecommendations(recommendedProducts);
    } catch (error) {
      console.error("AI recommendation failed, falling back to basic:", error);
      await loadBasicRecommendations(config);
    }
  };

  const loadBasicRecommendations = async (config) => {
    try {
      const orders = config?.use_purchase_history ? await base44.entities.Order.filter({ user_id: user.id }) : [];
      const viewedProducts = config?.use_browsing_behavior ? JSON.parse(localStorage.getItem(`viewed_products_${user.id}`) || "[]") : [];
      const allProducts = await base44.entities.Product.filter({ is_available: true });
      
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
        let score = 0;
        
        if (purchasedProductIds.has(product.id)) score -= 100;
        if (topCategories.includes(product.category_id)) score += 30;
        
        const viewIndex = viewedProducts.indexOf(product.id);
        if (viewIndex !== -1) score += 20 - viewIndex;
        
        if (product.rating >= 4) score += 15;
        if (config?.boost_high_margin && product.profit_margin > 20) score += 10;
        if (product.original_price && product.original_price > product.price) score += 8;

        return { ...product, score };
      });

      const topRecommendations = scoredProducts
        .sort((a, b) => b.score - a.score)
        .filter(p => p.score > 0)
        .slice(0, context === "checkout" ? 4 : (config?.max_recommendations || 8));

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
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-emerald-600" />
        <h2 className="text-xl font-bold text-gray-900">
          {context === "checkout" ? "You May Also Like" : "Recommended For You"}
        </h2>
        {settings?.strategy === "ai_powered" && (
          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">AI Powered</span>
        )}
      </div>
      
      <Card className="bg-gradient-to-r from-emerald-50 to-blue-50 border-emerald-200">
        <CardContent className="p-4">
          <p className="text-sm text-gray-600 mb-4">
            {settings?.strategy === "ai_powered" 
              ? "Personalized by AI based on your preferences and shopping patterns"
              : "Based on your preferences and purchase history"}
          </p>
          <div className="relative -mx-2">
            <div className="flex gap-3 overflow-x-auto pb-4 px-2 scrollbar-hide snap-x snap-mandatory items-start">
              {recommendations.map((product, index) => {
                const cartQuantity = getCartQuantity ? getCartQuantity(product.id) : 0;
                const isInStock = product.stock_quantity > 0;
                
                return (
                  <div key={product.id} className="flex-shrink-0 w-[140px] snap-start">
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
                          src={product.image_url}
                          alt={product.name}
                          loading="lazy"
                          onLoad={() => setImageLoaded(prev => ({ ...prev, [product.id]: true }))}
                          className={`w-full h-20 object-contain transition-all duration-500 ${
                            imageLoaded[product.id] ? 'opacity-100' : 'opacity-0'
                          }`}
                          style={{ transition: 'opacity 200ms ease-in' }}
                        />
                        
                        {/* Out of Stock Overlay */}
                        {!isInStock && (
                          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center">
                            <span className="bg-red-500 text-white text-[10px] px-2 py-1 rounded font-semibold">
                              OUT OF STOCK
                            </span>
                          </div>
                        )}
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
                          {!isInStock ? (
                            <button
                              disabled
                              className="w-full bg-gray-300 text-gray-500 text-xs font-semibold py-1.5 rounded-lg cursor-not-allowed"
                            >
                              OUT OF STOCK
                            </button>
                          ) : cartQuantity > 0 ? (
                            <div className="flex items-center gap-1 bg-emerald-50 rounded-lg p-0.5">
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  if (onUpdateQuantity) {
                                    onUpdateQuantity(product, -1);
                                  }
                                }}
                                className="flex-1 hover:bg-emerald-100 rounded text-emerald-700 font-bold text-sm py-1"
                              >
                                −
                              </button>
                              <span className="font-bold text-emerald-700 text-xs min-w-[1.5rem] text-center">{cartQuantity}</span>
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  if (onUpdateQuantity) {
                                    onUpdateQuantity(product, 1);
                                  } else {
                                    onAddToCart(product);
                                  }
                                }}
                                className="flex-1 bg-emerald-600 hover:bg-emerald-700 rounded text-white font-bold text-sm py-1"
                              >
                                +
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                onAddToCart(product);
                              }}
                              className="w-full bg-white hover:bg-emerald-50 border-2 border-emerald-600 text-emerald-600 text-xs font-semibold py-1.5 rounded-lg transition-all"
                            >
                              ADD
                            </button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}