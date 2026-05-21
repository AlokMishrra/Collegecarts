/**
 * ModuleLayout - Replaces the old Layout.jsx
 * Provides the dynamic sidebar, workspace switcher, mobile bottom bar
 * Wraps all authenticated pages
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, ShoppingCart, Bell, Search, LogOut } from 'lucide-react';
import { useNavigation } from './NavigationProvider';
import DynamicSidebar from './DynamicSidebar';
import MobileBottomBar from './MobileBottomBar';
import { User } from '@/entities/User';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import NotificationCenter from '@/components/shared/NotificationCenter';
import AIAssistant from '@/components/chat/AIAssistant';
import InAppChat from '@/components/chat/InAppChat';

export default function ModuleLayout({ children }) {
  const navigate = useNavigate();
  const { 
    currentModuleDef, 
    sidebarCollapsed, 
    setMobileSidebarOpen, 
    user 
  } = useNavigation();
  
  const [cartCount, setCartCount] = useState(0);

  const loadCartCount = useCallback(async () => {
    if (!user?.id) return;
    try {
      const cartItems = await base44.entities.CartItem.filter({ user_id: user.id });
      const totalCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
      setCartCount(totalCount);
    } catch (error) {
      // silent
    }
  }, [user?.id]);

  useEffect(() => {
    if (user) loadCartCount();
  }, [user, loadCartCount]);

  useEffect(() => {
    const handler = () => { if (user) loadCartCount(); };
    window.addEventListener('cartUpdated', handler);
    return () => window.removeEventListener('cartUpdated', handler);
  }, [user, loadCartCount]);

  const handleLogout = async () => {
    await User.logout();
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Dynamic Sidebar */}
      <DynamicSidebar onLogout={handleLogout} />

      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 bg-white border-b border-gray-200 z-[9990] h-14 flex items-center px-4">
        <button
          onClick={() => setMobileSidebarOpen(true)}
          className="p-2 -ml-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <Menu className="w-5 h-5 text-gray-700" />
        </button>
        
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-2">
            <div 
              className="w-6 h-6 rounded-md flex items-center justify-center"
              style={{ background: `${currentModuleDef.color}15` }}
            >
              <currentModuleDef.icon className="w-3.5 h-3.5" style={{ color: currentModuleDef.color }} />
            </div>
            <span className="font-bold text-gray-900 text-sm">{currentModuleDef.name}</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <NotificationCenter />
          <Link to="/cart" className="relative p-2 rounded-lg hover:bg-gray-100">
            <ShoppingCart className="w-5 h-5 text-gray-600" />
            {cartCount > 0 && (
              <span className="absolute top-0.5 right-0.5 bg-emerald-600 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {cartCount > 9 ? '9+' : cartCount}
              </span>
            )}
          </Link>
          {user && (user.role === 'admin' || !!localStorage.getItem('deliveryPerson')) && (
            <Link to="/profile" className="p-1 ml-0.5">
              <div 
                className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
                style={{ background: currentModuleDef.color }}
              >
                {user.full_name?.charAt(0) || 'U'}
              </div>
            </Link>
          )}
        </div>
      </header>

      {/* Desktop Top Bar */}
      <header 
        className={`hidden lg:flex fixed top-0 right-0 h-14 bg-white border-b border-gray-200 z-30 items-center px-6 transition-all duration-300 ${
          sidebarCollapsed ? 'left-16' : 'left-60'
        }`}
      >
        {/* Search */}
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder={currentModuleDef.searchPlaceholder}
              className="w-full pl-9 pr-4 py-2 bg-gray-100 border-0 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all"
            />
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2 ml-4">
          {user && <InAppChat currentUser={user} />}
          <Link to="/cart" className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <ShoppingCart className="w-5 h-5 text-gray-600" />
            {cartCount > 0 && (
              <Badge className="absolute -top-0.5 -right-0.5 h-4 w-4 flex items-center justify-center p-0 bg-emerald-600 text-white text-[9px]">
                {cartCount}
              </Badge>
            )}
          </Link>
          <NotificationCenter />
          {!user && (
            <Button
              onClick={() => navigate('/login')}
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-sm"
            >
              Login
            </Button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className={`transition-all duration-300 ${
        sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-60'
      } pt-14 pb-16 lg:pb-0 min-h-screen`}>
        <div className="p-4 lg:p-6">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Bar */}
      <MobileBottomBar cartCount={cartCount} />

      {/* AI Assistant */}
      <AIAssistant user={user} />
    </div>
  );
}
