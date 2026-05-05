import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ShoppingBag, ShoppingCart, Package, User, Truck, Settings, Crown } from "lucide-react";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";

export default function BottomTabBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [cartItemCount, setCartItemCount] = useState(0);
  const [userRole, setUserRole] = useState(null);
  const [isDeliveryPartner, setIsDeliveryPartner] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkUser();
    checkDeliveryPartner();
  }, []);

  useEffect(() => {
    if (user) {
      loadCartCount();
      // Set up real-time cart updates
      const interval = setInterval(loadCartCount, 3000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const checkUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      
      // Check if user has any assigned roles
      if (currentUser.assigned_role_ids && currentUser.assigned_role_ids.length > 0) {
        const rolePromises = currentUser.assigned_role_ids.map(roleId => 
          base44.entities.Role.filter({ id: roleId })
        );
        const roleResults = await Promise.all(rolePromises);
        const allRoles = roleResults.flat();
        if (allRoles.length > 0) {
          setUserRole(allRoles[0]);
        }
      }
    } catch (error) {
      // User not logged in
    } finally {
      setIsLoading(false);
    }
  };

  const checkDeliveryPartner = () => {
    const savedDeliveryPerson = localStorage.getItem('deliveryPerson');
    setIsDeliveryPartner(!!savedDeliveryPerson);
  };

  const loadCartCount = async () => {
    if (!user) return;
    try {
      const cartItems = await base44.entities.CartItem.filter({ user_id: user.id });
      const totalCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
      setCartItemCount(totalCount);
    } catch (error) {
      console.error("Error loading cart count:", error);
    }
  };

  // Check if user has multiple roles
  const hasMultipleRoles = user?.assigned_role_ids && user.assigned_role_ids.length > 1;

  // Check if user is a delivery person (single role only)
  const isDeliveryOnlyRole = !hasMultipleRoles && userRole && (
    userRole.name.toLowerCase().includes("delivery") ||
    userRole.permissions?.includes("view_delivery_portal")
  );

  // Check if user is admin
  const isAdmin = user?.role === "admin" || (userRole && !isDeliveryOnlyRole && user?.assigned_role_ids?.length > 0);

  const tabs = [];

  // Always show Shop
  tabs.push({ name: "Shop", icon: ShoppingBag, path: createPageUrl("Shop") });

  // Show Cart for non-delivery users
  if (!isDeliveryOnlyRole) {
    tabs.push({ 
      name: "Cart", 
      icon: ShoppingCart, 
      path: createPageUrl("Cart"),
      badge: cartItemCount > 0 ? cartItemCount : null
    });
  }

  // Show Orders for everyone
  tabs.push({ name: "Orders", icon: Package, path: createPageUrl("Orders") });

  // Show Delivery Portal for delivery partners
  if (isDeliveryOnlyRole || (hasMultipleRoles && userRole?.permissions?.includes("view_delivery_portal"))) {
    tabs.push({ name: "Delivery", icon: Truck, path: createPageUrl("Delivery") });
  }

  // Show Premium for non-delivery users
  if (!isDeliveryOnlyRole) {
    tabs.push({ name: "Premium", icon: Crown, path: createPageUrl("Subscription") });
  }

  // Show Admin for admin users
  if (isAdmin) {
    tabs.push({ name: "Admin", icon: Settings, path: createPageUrl("CCA") });
  }

  // Always show Profile
  tabs.push({ name: "Profile", icon: User, path: createPageUrl("Profile") });

  const isActive = (path) => location.pathname === path;

  // Don't render footer during initial load
  if (isLoading) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 md:hidden z-50 safe-area-bottom">
      {/* Glassy background with blur */}
      <div className="backdrop-blur-xl bg-white/80 border-t border-gray-200/50 shadow-lg">
        <div className="flex items-center justify-around px-2 py-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = isActive(tab.path);
            
            return (
              <button
                key={tab.name}
                onClick={() => navigate(tab.path)}
                className={`
                  relative flex flex-col items-center justify-center flex-1 py-2 px-1 rounded-xl transition-all duration-300 select-none
                  ${active 
                    ? "bg-emerald-100/60 backdrop-blur-sm" 
                    : "hover:bg-gray-100/40"
                  }
                `}
              >
                <div className="relative">
                  <Icon 
                    className={`w-6 h-6 transition-all duration-300 ${
                      active 
                        ? "text-emerald-600 stroke-[2.5]" 
                        : "text-gray-600 stroke-2"
                    }`} 
                  />
                  {tab.badge && (
                    <Badge className="absolute -top-2 -right-2 h-5 min-w-[20px] flex items-center justify-center p-0 px-1 bg-emerald-600 text-white text-xs font-bold">
                      {tab.badge}
                    </Badge>
                  )}
                </div>
                <span 
                  className={`text-xs mt-1 transition-all duration-300 ${
                    active 
                      ? "font-semibold text-emerald-700" 
                      : "font-medium text-gray-600"
                  }`}
                >
                  {tab.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
