/**
 * MobileBottomBar - Primary navigation like Swiggy/Blinkit/Zepto
 * 
 * Layout: Shop | Meals | Cart | Orders | Profile
 * - If admin: replaces Profile with Admin (Profile accessible from sidebar)
 * - If delivery: adds Delivery replacing Orders
 * - Cart always has badge counter
 * - Active tab has colored icon + indicator line on top
 */
import React, { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  ShoppingBag, UtensilsCrossed, ShoppingCart, Package, 
  User, Crown, Settings, Truck 
} from 'lucide-react';
import { useNavigation } from './NavigationProvider';

export default function MobileBottomBar({ cartCount = 0 }) {
  const location = useLocation();
  const { user } = useNavigation();

  const isAdmin = user?.role === 'admin';
  const isDelivery = !!localStorage.getItem('deliveryPerson');

  // Build tabs - exactly 5 like all major apps
  const tabs = useMemo(() => {
    // Build tabs - exactly 5 like all major apps
    const base = [
      { id: 'shop', label: 'Shop', icon: ShoppingBag, route: '/shop', color: '#10b981' },
      { id: 'meals', label: 'Meals', icon: UtensilsCrossed, route: '/meals', color: '#f97316' },
      { id: 'premium', label: 'Premium', icon: Crown, route: '/subscription', color: '#a855f7' },
      { id: 'orders', label: 'Orders', icon: Package, route: '/orders', color: '#3b82f6' },
      { id: 'profile', label: 'Profile', icon: User, route: '/profile', color: '#64748b' },
    ];

    // If admin: replace Profile with Admin (profile moves to header)
    if (isAdmin) {
      base[4] = { id: 'admin', label: 'Admin', icon: Settings, route: '/CCA', color: '#6366f1' };
    }

    // If delivery partner (not admin): replace Profile with Delivery
    if (isDelivery && !isAdmin) {
      base[4] = { id: 'delivery', label: 'Delivery', icon: Truck, route: '/Delivery', color: '#0891b2' };
    }

    return base;
  }, [isAdmin, isDelivery]);

  const isActive = (tab) => {
    const path = location.pathname.toLowerCase();
    if (tab.id === 'cart') return path === '/cart';
    if (tab.id === 'shop') return path === '/shop' || path === '/';
    if (tab.id === 'meals') return path.startsWith('/meals');
    if (tab.id === 'orders') return path.startsWith('/orders');
    if (tab.id === 'profile') return path.startsWith('/profile');
    if (tab.id === 'premium') return path.startsWith('/subscription') || path.startsWith('/loyalty');
    if (tab.id === 'admin') return path === '/cca';
    if (tab.id === 'delivery') return path === '/delivery';
    return false;
  };

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-[9990] safe-area-bottom shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
      <div className="flex items-center justify-around h-[60px] px-1">
        {tabs.map((tab) => {
          const active = isActive(tab);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.id}
              to={tab.route}
              className="relative flex flex-col items-center justify-center flex-1 h-full"
            >
              {/* Active indicator line */}
              {active && (
                <div 
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-[3px] rounded-full"
                  style={{ background: tab.color }}
                />
              )}
              
              <div className="relative">
                <Icon
                  className="w-[22px] h-[22px] transition-colors"
                  style={{ color: active ? tab.color : '#9ca3af' }}
                />
              </div>
              <span 
                className="text-[10px] mt-0.5 font-medium transition-colors"
                style={{ color: active ? tab.color : '#9ca3af' }}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
