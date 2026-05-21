import React, { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { X, PanelLeftClose, PanelLeft, LogOut, Building2, Settings, Truck, Users } from 'lucide-react';
import { useNavigation } from './NavigationProvider';
import { buildEmployeeSidebar, MODULES } from './moduleConfig';
import WorkspaceSwitcher from './WorkspaceSwitcher';
import { motion } from 'framer-motion';

export default function DynamicSidebar({ onLogout }) {
  const location = useLocation();
  const {
    currentModuleDef,
    activeModule,
    sidebarCollapsed,
    toggleSidebar,
    mobileSidebarOpen,
    setMobileSidebarOpen,
    user,
    employee
  } = useNavigation();

  // Build sidebar sections based on active module
  const sidebarSections = useMemo(() => {
    if (activeModule === MODULES.EMPLOYEE && employee) {
      return buildEmployeeSidebar(employee);
    }
    const sections = [...(currentModuleDef.sidebarSections || [])];
    
    // Add role-based section if user has admin or delivery role
    const isAdmin = user?.role === 'admin';
    const isDelivery = !!localStorage.getItem('deliveryPerson');
    
    if (isAdmin || isDelivery) {
      const roleItems = [];
      if (isAdmin) {
        roleItems.push({ label: 'Admin Panel', icon: Settings, route: '/CCA' });
        roleItems.push({ label: 'User Management', icon: Users, route: '/UserManagement' });
      }
      if (isDelivery) {
        roleItems.push({ label: 'Delivery Portal', icon: Truck, route: '/Delivery' });
      }
      sections.push({
        title: 'Role Access',
        items: roleItems
      });
    }
    
    return sections;
  }, [activeModule, currentModuleDef, employee, user]);

  const isActive = (route) => {
    if (route === location.pathname) return true;
    // Match base path for nested routes
    if (route !== '/' && location.pathname.startsWith(route.split('?')[0])) return true;
    return false;
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Workspace Switcher */}
      <div className="p-3 border-b border-gray-100">
        <WorkspaceSwitcher />
      </div>

      {/* Navigation Sections */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-4">
        {sidebarSections.map((section, sIdx) => (
          <div key={sIdx}>
            {!sidebarCollapsed && (
              <p className="px-2 mb-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                {section.title}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item, iIdx) => {
                const Icon = item.icon;
                const active = isActive(item.route);
                return (
                  <Link
                    key={iIdx}
                    to={item.route}
                    onClick={() => setMobileSidebarOpen(false)}
                    className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all duration-150 group ${
                      active
                        ? `bg-gradient-to-r ${currentModuleDef.bgLight} ${currentModuleDef.borderColor} border`
                        : 'hover:bg-gray-50 border border-transparent'
                    }`}
                    title={sidebarCollapsed ? item.label : undefined}
                  >
                    <Icon 
                      className={`w-4 h-4 flex-shrink-0 ${
                        active ? currentModuleDef.textColor : 'text-gray-500 group-hover:text-gray-700'
                      }`}
                    />
                    {!sidebarCollapsed && (
                      <span className={`text-sm truncate ${
                        active ? `font-semibold ${currentModuleDef.textColor}` : 'text-gray-700'
                      }`}>
                        {item.label}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User Profile Footer */}
      {user && !sidebarCollapsed && (
        <div className="p-3 border-t border-gray-100">
          <div className="flex items-center gap-2.5 mb-2">
            <div 
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold"
              style={{ background: currentModuleDef.color }}
            >
              {user.full_name?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{user.full_name || 'User'}</p>
              {user.selected_hostel && (
                <div className="flex items-center gap-1">
                  <Building2 className="w-3 h-3 text-gray-400" />
                  <p className="text-[10px] text-gray-500 truncate">{user.selected_hostel}</p>
                </div>
              )}
            </div>
          </div>
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout</span>
          </button>
        </div>
      )}

      {/* Collapse Toggle (desktop only) */}
      <div className="hidden lg:block p-2 border-t border-gray-100">
        <button
          onClick={toggleSidebar}
          className="w-full flex items-center justify-center gap-2 px-2 py-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
        >
          {sidebarCollapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          {!sidebarCollapsed && <span className="text-xs">Collapse</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:block fixed inset-y-0 left-0 bg-white border-r border-gray-200 z-40 transition-all duration-300 ${
          sidebarCollapsed ? 'w-16' : 'w-60'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileSidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/40 z-[9998] backdrop-blur-sm"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Mobile Sidebar Drawer */}
      <motion.aside
        initial={false}
        animate={{ x: mobileSidebarOpen ? 0 : -280 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="lg:hidden fixed inset-y-0 left-0 w-[280px] bg-white shadow-2xl z-[9999]"
      >
        {/* Mobile close button */}
        <div className="absolute top-3 right-3">
          <button
            onClick={() => setMobileSidebarOpen(false)}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        {sidebarContent}
      </motion.aside>
    </>
  );
}
