import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { User } from "@/entities/User";
import { base44 } from "@/api/base44Client";
import { 
  ShoppingCart, 
  Settings, 
  Truck,
  Home,
  Menu,
  X,
  LogOut,
  Building2,
  Crown,
  User as UserIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import NotificationCenter from "./components/shared/NotificationCenter";
import FeedbackPopup from "./components/shop/FeedbackPopup";
import AIAssistant from "./components/chat/AIAssistant";
import InAppChat from "./components/chat/InAppChat";

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [isDeliveryPartner, setIsDeliveryPartner] = useState(false);
  const [userHasRole, setUserHasRole] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [cartItemCount, setCartItemCount] = useState(0);

  useEffect(() => {
    checkUser();
    checkDeliveryPartner();
  }, []);

  useEffect(() => {
    if (user) {
      loadCartCount();
    }
  }, [user]);

  // Listen for cart updates from other components
  useEffect(() => {
    const handleCartUpdate = () => {
      if (user) {
        loadCartCount();
      }
    };

    window.addEventListener('cartUpdated', handleCartUpdate);
    return () => window.removeEventListener('cartUpdated', handleCartUpdate);
  }, [user]);

  const loadCartCount = async () => {
    try {
      const cartItems = await base44.entities.CartItem.filter({ user_id: user.id });
      const totalCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
      setCartItemCount(totalCount);
    } catch (error) {
      console.error("Error loading cart count:", error);
    }
  };

  const checkUser = async () => {
    try {
      const currentUser = await User.me();
      setUser(currentUser);
      
      // Check if user has any assigned roles
      if (currentUser.assigned_role_ids && currentUser.assigned_role_ids.length > 0) {
        setUserHasRole(true);
        // Load all assigned roles to check permissions
        const rolePromises = currentUser.assigned_role_ids.map(roleId => 
          base44.entities.Role.filter({ id: roleId })
        );
        const roleResults = await Promise.all(rolePromises);
        const allRoles = roleResults.flat();
        if (allRoles.length > 0) {
          setUserRole(allRoles[0]); // Set first role as primary
        }
      }
    } catch (error) {
      // User not logged in
    }
  };

  const checkDeliveryPartner = () => {
    const savedDeliveryPerson = localStorage.getItem('deliveryPerson');
    setIsDeliveryPartner(!!savedDeliveryPerson);
  };

  const handleLogout = async () => {
    await User.logout();
    setUser(null);
  };

  // Check if user has multiple roles
  const hasMultipleRoles = user?.assigned_role_ids && user.assigned_role_ids.length > 1;

  // Check if user is a delivery person (single role only)
  const isDeliveryOnlyRole = !hasMultipleRoles && userRole && (
    userRole.name.toLowerCase().includes("delivery") ||
    userRole.permissions?.includes("view_delivery_portal")
  );

  const navigationItems = [
    {
      title: "Shop",
      url: createPageUrl("Shop"),
      icon: Home,
      showCondition: () => true
    },
    {
      title: "Cart",
      url: createPageUrl("Cart"),
      icon: ShoppingCart,
      badge: cartCount > 0 ? cartCount : null,
      showCondition: () => true
    },
    {
      title: "My Profile",
      url: createPageUrl("Profile"),
      icon: UserIcon,
      showCondition: () => true
    },
    {
      title: "Premium",
      url: createPageUrl("Subscription"),
      icon: Crown,
      showCondition: () => !isDeliveryOnlyRole
    },
    {
      title: "Admin Panel",
      url: createPageUrl("CCA"),
      icon: Settings,
      showCondition: () => {
        // Hide for delivery-only users
        if (isDeliveryOnlyRole) return false;
        // Show for admin or users with non-delivery roles
        return user?.role === "admin" || (userHasRole && !isDeliveryOnlyRole);
      }
    },
    {
      title: "User Management",
      url: createPageUrl("UserManagement"),
      icon: UserIcon,
      showCondition: () => {
        // Hide for delivery-only users
        if (isDeliveryOnlyRole) return false;
        // Show for admin or users with non-delivery roles
        return user?.role === "admin" || (userHasRole && !isDeliveryOnlyRole);
      }
    },
    {
      title: "Delivery Portal",
      url: createPageUrl("Delivery"),
      icon: Truck,
      showCondition: () => {
        // Show for delivery persons or users with multiple roles
        return isDeliveryOnlyRole || (hasMultipleRoles && userRole?.permissions?.includes("view_delivery_portal"));
      }
    }
  ];

  const isActive = (url) => location.pathname === url;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Mobile Header — fixed, highest z-index, always on top */}
      <header className="lg:hidden fixed top-0 left-0 right-0 bg-white shadow-sm border-b border-gray-200 px-4 safe-area-top" style={{ zIndex: 9998, height: '57px', display: 'flex', alignItems: 'center' }}>
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(true)}
              style={{ background: 'none', border: 'none', padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', minWidth: '40px', minHeight: '40px' }}
            >
              <Menu className="w-5 h-5 text-gray-700" />
            </button>
            <div className="flex items-center gap-2">
              <img 
                src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6885ba54fc40d82179646aca/56f3d15ef_WhatsAppImage2025-12-13at111830AM.jpeg"
                alt="CollegeCart Logo"
                className="w-9 h-9 object-contain"
              />
              <h1 className="text-xl font-bold text-emerald-600">CollegeCart</h1>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <NotificationCenter />
            {user && (
              <button
                onClick={handleLogout}
                style={{ background: 'none', border: 'none', padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', minWidth: '40px', minHeight: '40px', color: '#4B5563' }}
              >
                <LogOut style={{ width: '20px', height: '20px' }} />
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className={`
          fixed inset-y-0 left-0 z-[9999] w-64 bg-white shadow-xl border-r border-gray-200
          transform transition-transform duration-300 ease-in-out
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}>
          <div className="flex flex-col h-full">
            {/* Logo — hidden on mobile since mobile header already shows it */}
            <div className="p-6 border-b border-gray-200 hidden lg:block">
              <div className="flex items-center gap-3">
                <img 
                  src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6885ba54fc40d82179646aca/56f3d15ef_WhatsAppImage2025-12-13at111830AM.jpeg"
                  alt="CollegeCart Logo"
                  className="w-12 h-12 object-contain"
                />
                <div>
                  <h2 className="text-xl font-bold text-emerald-600">CollegeCart</h2>
                  <p className="text-xs text-gray-500">Grocery Delivery</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden absolute top-4 right-4"
                onClick={() => setIsSidebarOpen(false)}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Mobile drawer header — only shown when sidebar is open as a drawer */}
            <div className="lg:hidden flex items-center justify-between p-4 border-b border-gray-200 mt-[57px]">
              <div className="flex items-center gap-2">
                <img 
                  src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6885ba54fc40d82179646aca/56f3d15ef_WhatsAppImage2025-12-13at111830AM.jpeg"
                  alt="CollegeCart Logo"
                  className="w-8 h-8 object-contain"
                />
                <span className="font-bold text-emerald-600">Menu</span>
              </div>
              <button
                onClick={() => setIsSidebarOpen(false)}
                style={{ background: 'none', border: 'none', padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', borderRadius: '8px' }}
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-4 space-y-2">
              {navigationItems.map((item) => {
                // Always show Shop even when not logged in
                if (!user && !isDeliveryPartner && item.title !== "Shop") return null;
                if (!item.showCondition()) return null;

                return (
                  <Link
                    key={item.title}
                    to={item.url}
                    onClick={() => setIsSidebarOpen(false)}
                    className={`
                      flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200
                      ${isActive(item.url)
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }
                    `}
                  >
                    <item.icon className="w-5 h-5" />
                    <span className="font-medium">{item.title}</span>
                    {item.badge && (
                      <Badge className="ml-auto bg-emerald-500 text-white">
                        {item.badge}
                      </Badge>
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* User Profile */}
            {user && (
              <div className="p-4 border-t border-gray-200">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full flex items-center justify-center">
                    <span className="text-white font-semibold">
                      {user.full_name?.charAt(0) || 'U'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">
                      {user.full_name || 'User'}
                    </p>
                    <p className="text-sm text-gray-500 truncate">{user.email}</p>
                    {user.selected_hostel && (
                      <div className="flex items-center gap-1 mt-1">
                        <Building2 className="w-3 h-3 text-emerald-600" />
                        <p className="text-xs text-emerald-600 font-medium">{user.selected_hostel}</p>
                      </div>
                    )}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                  className="w-full"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </Button>
              </div>
            )}
          </div>
        </aside>

        {/* Mobile Overlay */}
        {isSidebarOpen && (
          <div
            className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-[9998]"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Main Content */}
        <main className="flex-1 min-w-0 lg:ml-64 flex flex-col min-h-screen pt-[57px] lg:pt-0">
          <div className="hidden lg:flex items-center justify-between p-6 bg-white border-b border-gray-200 fixed top-0 right-0 left-64 z-40 safe-area-top">
            <h1 className="text-2xl font-bold text-gray-900">
              {currentPageName || 'CollegeCart'}
            </h1>
            <div className="flex items-center gap-4">
              {user && <InAppChat currentUser={user} />}
              {user && !isDeliveryOnlyRole && (
                <Link to={createPageUrl("Cart")}>
                  <Button variant="ghost" size="icon" className="relative">
                    <ShoppingCart className="w-5 h-5" />
                    {cartItemCount > 0 && (
                      <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-emerald-600 text-white text-xs">
                        {cartItemCount}
                      </Badge>
                    )}
                  </Button>
                </Link>
              )}
              <NotificationCenter />
              {!user && (
                <Button
                  onClick={() => window.location.href = '/login'}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  Login
                </Button>
              )}
            </div>
          </div>
          <div className="p-4 lg:p-6 overflow-y-auto flex-1 lg:mt-[88px]">
            {children}
          </div>
        </main>
      </div>

      {/* Feedback Popup */}
      {user && !isDeliveryOnlyRole && <FeedbackPopup user={user} />}

      {/* AI Customer Support Chatbot */}
      <AIAssistant user={user} />

      {/* Footer — policy links, not shown in nav but accessible for SEO */}
      <footer className="lg:ml-64 border-t border-gray-200 bg-white py-4 px-4 lg:px-6">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2 text-xs text-gray-400">
          <span>© {new Date().getFullYear()} CollegeCart. All rights reserved.</span>
          <div className="flex flex-wrap gap-3">
            <Link to="/about" className="hover:text-emerald-600 transition-colors">About</Link>
            <Link to="/contact" className="hover:text-emerald-600 transition-colors">Contact Us</Link>
            <Link to="/terms" className="hover:text-emerald-600 transition-colors">Terms & Conditions</Link>
            <Link to="/refunds" className="hover:text-emerald-600 transition-colors">Refunds & Cancellations</Link>
            <Link to="/privacy" className="hover:text-emerald-600 transition-colors">Privacy Policy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}