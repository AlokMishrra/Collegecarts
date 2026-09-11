import React, { useState, useEffect, useCallback } from "react";
import { ChevronRight } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useNavigation } from "@/navigation/NavigationProvider";

export default function FloatingCartButton({ onCartStateChange }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useNavigation();
  const [cartItems, setCartItems] = useState([]);
  const [cartCount, setCartCount] = useState(0);
  const [visible, setVisible] = useState(false);

  const isOnCartPage = location.pathname === "/Cart";

  const loadCartCount = useCallback(async () => {
    if (!user?.id) {
      setCartItems([]);
      setCartCount(0);
      setVisible(false);
      onCartStateChange?.(false);
      return;
    }
    try {
      const items = await base44.entities.CartItem.filter({ user_id: user.id });
      const count = items.reduce((sum, item) => sum + (item.quantity || 1), 0);

      const productIds = [...new Set(items.map((item) => item.product_id))].slice(0, 4);
      const productPromises = productIds.map((id) =>
        base44.entities.Product.filter({ id }).then((results) => results[0]).catch(() => null)
      );
      const productsData = await Promise.all(productPromises);

      const productsMap = {};
      productsData.forEach((product) => {
        if (product) productsMap[product.id] = product;
      });

      const itemsWithImages = items.slice(0, 4).map((item) => ({
        ...item,
        image_url: productsMap[item.product_id]?.image_url || null,
        name: productsMap[item.product_id]?.name || item.name || "Item",
      }));

      setCartItems(itemsWithImages);
      setCartCount(count);
      const shouldShow = count > 0 && !isOnCartPage;
      setVisible(shouldShow);
      onCartStateChange?.(shouldShow);
    } catch (error) {
      setCartItems([]);
      setCartCount(0);
      setVisible(false);
      onCartStateChange?.(false);
    }
  }, [user?.id, onCartStateChange, isOnCartPage]);

  useEffect(() => {
    loadCartCount();
    const handler = () => loadCartCount();
    window.addEventListener("cartUpdated", handler);
    return () => window.removeEventListener("cartUpdated", handler);
  }, [loadCartCount]);

  useEffect(() => {
    const interval = setInterval(loadCartCount, 1000);
    return () => clearInterval(interval);
  }, [loadCartCount]);

  useEffect(() => {
    if (isOnCartPage) {
      setVisible(false);
      onCartStateChange?.(false);
    } else {
      loadCartCount();
    }
  }, [isOnCartPage, loadCartCount, onCartStateChange]);

  if (!visible || cartCount === 0 || isOnCartPage) return null;

  return (
    <div className="fixed bottom-[72px] left-1/2 -translate-x-1/2 z-[9998] lg:hidden">
      <div
        className="bg-emerald-600 text-white rounded-full shadow-lg shadow-emerald-700/40 cursor-pointer active:scale-95 transition-transform flex items-center gap-2 pr-3 pl-2 py-1.5 max-w-[85vw]"
        onClick={() => navigate("/Cart")}
      >
        {/* Product images stacked */}
        <div className="flex items-center">
          {cartItems.length > 0 ? (
            cartItems.map((item, i) => (
              <div
                key={item.id || i}
                className="w-10 h-10 rounded-full border-2 border-emerald-600 overflow-hidden bg-white flex-shrink-0"
                style={{ marginLeft: i > 0 ? "-10px" : "0", zIndex: cartItems.length - i }}
              >
                {item.image_url ? (
                  <img
                    src={item.image_url}
                    alt={item.name || "item"}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-white flex items-center justify-center">
                    <span className="text-lg">🛒</span>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              🛒
            </div>
          )}
        </div>

        {/* Text */}
        <div className="flex flex-col min-w-0">
          <span className="text-xs font-bold whitespace-nowrap leading-tight">View cart</span>
          <span className="text-[10px] text-emerald-100 whitespace-nowrap leading-tight">
            {cartCount} item{cartCount !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Arrow */}
        <div className="bg-white/20 rounded-full p-1 ml-1 flex-shrink-0">
          <ChevronRight className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
}
