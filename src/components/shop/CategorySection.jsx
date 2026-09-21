import React, { memo, useRef, useEffect } from "react";
import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import CompactProductCard from "./CompactProductCard";

// memo — prevents re-render when parent re-renders with same props
const CategorySection = memo(function CategorySection({
  category, products,
  onAddToCart, onUpdateQuantity, getCartQuantity,
  getHostelStock, isProductInStock,
}) {
  // Ref for scroll container to reset scroll position
  const scrollContainerRef = useRef(null);

  // getHostelStock and isProductInStock are always passed from Shop.jsx
  // which has the user context. These fallbacks are only for safety.
  const checkProductInStock = isProductInStock || ((product) => {
    return (product.stock_quantity || 0) > 0;
  });

  const getStock = getHostelStock || ((product) => {
    return product.stock_quantity || 0;
  });

  // Reset scroll position to show in-stock items first when category changes
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft = 0;
    }
  }, [category.id]);
  
  if (!products || products.length === 0) {
    return (
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">{category.name}</h2>
        </div>
        <div className="bg-gray-50 rounded-xl p-8 text-center">
          <p className="text-gray-500">No products available in this category</p>
        </div>
      </div>
    );
  }

  const sortedProducts = [...products].sort((a, b) => {
    const aQty = getCartQuantity(a.id);
    const bQty = getCartQuantity(b.id);
    const aInStock = checkProductInStock(a) || aQty > 0;
    const bInStock = checkProductInStock(b) || bQty > 0;
    
    if (aInStock && !bInStock) return -1;
    if (!aInStock && bInStock) return 1;
    return 0;
  });

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3 px-0.5">
        <h2 className="text-[15px] font-bold text-gray-900">{category.name}</h2>
        <Link 
          to={createPageUrl(`CategoryProducts?categoryId=${category.id}&categoryName=${category.name}`)}
          className="text-[#0c831f] hover:text-[#0a6b19] text-[13px] font-semibold flex items-center gap-0.5"
        >
          see all
          <ChevronRight className="w-4 h-4" strokeWidth={2.5} />
        </Link>
      </div>
      
      <div className="relative">
        <div 
          ref={scrollContainerRef}
          className="flex gap-2.5 overflow-x-auto pb-3 snap-x snap-mandatory -webkit-overflow-scrolling-touch product-scroll px-0.5"
        >
          {sortedProducts.map((product) => {
            const cartQty = getCartQuantity(product.id);
            const hostelStock = getStock(product);
            const inStock = checkProductInStock(product);
            const isMaxStock = cartQty >= hostelStock;
            
            return (
              <div
                key={product.id}
                className="flex-shrink-0 w-[132px] snap-start"
              >
                <CompactProductCard
                  product={product}
                  cartQty={cartQty}
                  onAddToCart={onAddToCart}
                  onUpdateQuantity={onUpdateQuantity}
                  inStock={inStock}
                  maxReached={isMaxStock}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});

export default CategorySection;
