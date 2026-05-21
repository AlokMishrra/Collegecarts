/**
 * ModuleSwitcherStrip - Horizontal pill tabs at top of page
 * Like Swiggy's "Food | Instamart | Dineout" or Zomato's top tabs
 * Shows just below the mobile header
 */
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ShoppingBag, UtensilsCrossed, Crown, Truck, Settings } from 'lucide-react';
import { useNavigation } from './NavigationProvider';

export default function ModuleSwitcherStrip() {
  const location = useLocation();
  const { user } = useNavigation();

  const isAdmin = user?.role === 'admin';
  const isDelivery = !!localStorage.getItem('deliveryPerson');

  const modules = [
    { id: 'shop', label: 'Shop', icon: ShoppingBag, route: '/shop', color: '#10b981' },
    { id: 'meals', label: 'Meals', icon: UtensilsCrossed, route: '/meals', color: '#f97316' },
    { id: 'premium', label: 'Premium', icon: Crown, route: '/subscription', color: '#a855f7' },
  ];

  // Add role-based modules
  if (isDelivery) {
    modules.push({ id: 'delivery', label: 'Delivery', icon: Truck, route: '/Delivery', color: '#0891b2' });
  }
  if (isAdmin) {
    modules.push({ id: 'admin', label: 'Admin', icon: Settings, route: '/CCA', color: '#6366f1' });
  }

  const isActive = (route) => {
    const path = location.pathname.toLowerCase();
    const r = route.toLowerCase();
    if (r === '/shop') return path === '/shop' || path === '/';
    if (r === '/subscription') return path.startsWith('/subscription') || path.startsWith('/loyalty');
    return path.startsWith(r);
  };

  return (
    <div className="flex items-center gap-2 px-4 py-2 overflow-x-auto no-scrollbar bg-white border-b border-gray-100 sticky top-14 lg:top-14 z-20">
      {modules.map((mod) => {
        const active = isActive(mod.route);
        const Icon = mod.icon;
        return (
          <Link
            key={mod.id}
            to={mod.route}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full whitespace-nowrap transition-all duration-200 flex-shrink-0 ${
              active
                ? 'text-white shadow-md'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            style={active ? { background: mod.color } : {}}
          >
            <Icon className="w-3.5 h-3.5" />
            <span className="text-xs font-semibold">{mod.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
