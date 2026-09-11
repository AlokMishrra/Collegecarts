/**
 * MobileBottomBar - Primary navigation like Swiggy/Blinkit/Zepto
 * 
 * When toggle is "Shop": Shop | Cart | Orders | Premium | Profile/Admin
 * When toggle is "Meals": Meals | Menu | Plans | Orders | Profile/Admin
 */
import React, { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  ShoppingBag, UtensilsCrossed, ShoppingCart, Package, 
  User, Crown, Settings, Truck, ClipboardList, BookOpen, ListOrdered
} from 'lucide-react';
import { useNavigation } from './NavigationProvider';

export default function MobileBottomBar({ cartCount = 0, showCartTab = true }) {
  const location = useLocation();
  const { user } = useNavigation();

  const isAdmin = user?.role === 'admin';
  const isDelivery = !!localStorage.getItem('deliveryPerson');

  const isMealsMode = location.pathname === '/meals' || location.pathname.startsWith('/meals');

  const tabs = useMemo(() => {
    if (isMealsMode) {
      // Meals mode tabs
      const mealTabs = [
        { id: 'meals', label: 'Meals', icon: UtensilsCrossed, route: '/meals', color: '#f97316' },
        { id: 'orders', label: 'Orders', icon: ClipboardList, route: '/Orders', color: '#3b82f6' },
        { id: 'premium', label: 'Premium', icon: Crown, route: '/Subscription', color: '#a855f7' },
      ];

      if (isAdmin) {
        mealTabs.push({ id: 'admin', label: 'Admin', icon: Settings, route: '/CCA', color: '#6366f1' });
      } else if (isDelivery) {
        mealTabs.push({ id: 'delivery', label: 'Delivery', icon: Truck, route: '/Delivery', color: '#0891b2' });
      } else {
        mealTabs.push({ id: 'profile', label: 'Profile', icon: User, route: '/Profile', color: '#64748b' });
      }

      return mealTabs;
    }

    // Shop mode tabs
    const shopTabs = [
      { id: 'shop', label: 'Shop', icon: ShoppingBag, route: '/Shop', color: '#10b981' },
      ...(showCartTab ? [{ id: 'cart', label: 'Cart', icon: ShoppingCart, route: '/Cart', color: '#10b981', badge: cartCount }] : []),
      { id: 'orders', label: 'Orders', icon: Package, route: '/Orders', color: '#3b82f6' },
      { id: 'premium', label: 'Premium', icon: Crown, route: '/Subscription', color: '#a855f7' },
    ];

    if (isAdmin) {
      shopTabs.push({ id: 'admin', label: 'Admin', icon: Settings, route: '/CCA', color: '#6366f1' });
    } else if (isDelivery) {
      shopTabs.push({ id: 'delivery', label: 'Delivery', icon: Truck, route: '/Delivery', color: '#0891b2' });
    } else {
      shopTabs.push({ id: 'profile', label: 'Profile', icon: User, route: '/Profile', color: '#64748b' });
    }

    return shopTabs;
  }, [isMealsMode, isAdmin, isDelivery, cartCount, showCartTab]);

  const isActive = (tab) => {
    const path = location.pathname;
    if (tab.id === 'shop') return path === '/Shop' || path === '/';
    if (tab.id === 'cart') return path === '/Cart';
    if (tab.id === 'meals') return path.startsWith('/meals');
    if (tab.id === 'orders') return path === '/Orders';
    if (tab.id === 'profile') return path === '/Profile';
    if (tab.id === 'premium') return path === '/Subscription' || path.startsWith('/Loyalty');
    if (tab.id === 'admin') return path === '/CCA';
    if (tab.id === 'delivery') return path === '/Delivery';
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
                {tab.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2 bg-emerald-600 text-white text-[8px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                    {tab.badge > 9 ? '9+' : tab.badge}
                  </span>
                )}
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
