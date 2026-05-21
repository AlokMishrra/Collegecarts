/**
 * NavigationProvider - Manages module switching state
 * Tracks current active module, sidebar state, and recent modules
 */
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { MODULES, moduleDefinitions, detectModuleFromPath, getAvailableModules } from './moduleConfig';

const NavigationContext = createContext(null);

export const useNavigation = () => {
  const ctx = useContext(NavigationContext);
  if (!ctx) throw new Error('useNavigation must be used within NavigationProvider');
  return ctx;
};

export const NavigationProvider = ({ children, user, employee }) => {
  const location = useLocation();
  const [activeModule, setActiveModule] = useState(MODULES.SHOP);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('sidebarCollapsed') === 'true';
  });
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [workspaceSwitcherOpen, setWorkspaceSwitcherOpen] = useState(false);
  const [recentModules, setRecentModules] = useState(() => {
    if (typeof window === 'undefined') return [];
    try {
      return JSON.parse(localStorage.getItem('recentModules') || '[]');
    } catch {
      return [];
    }
  });

  // Auto-detect module from route changes
  useEffect(() => {
    const detected = detectModuleFromPath(location.pathname);
    if (detected !== activeModule) {
      setActiveModule(detected);
      // Track recent
      setRecentModules(prev => {
        const filtered = prev.filter(m => m !== detected);
        const updated = [detected, ...filtered].slice(0, 5);
        try { localStorage.setItem('recentModules', JSON.stringify(updated)); } catch {}
        return updated;
      });
    }
    // Close mobile sidebar on route change
    setMobileSidebarOpen(false);
  }, [location.pathname]);

  const switchModule = useCallback((moduleId) => {
    setActiveModule(moduleId);
    const def = moduleDefinitions[moduleId];
    if (def?.homeRoute && typeof window !== 'undefined') {
      window.location.href = def.homeRoute;
    }
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem('sidebarCollapsed', String(next)); } catch {}
      return next;
    });
  }, []);

  const availableModules = useMemo(
    () => getAvailableModules({ user, employee }),
    [user, employee]
  );

  const currentModuleDef = useMemo(
    () => moduleDefinitions[activeModule] || moduleDefinitions[MODULES.SHOP],
    [activeModule]
  );

  const value = useMemo(() => ({
    activeModule,
    setActiveModule,
    switchModule,
    currentModuleDef,
    availableModules,
    sidebarCollapsed,
    toggleSidebar,
    setSidebarCollapsed,
    mobileSidebarOpen,
    setMobileSidebarOpen,
    workspaceSwitcherOpen,
    setWorkspaceSwitcherOpen,
    recentModules,
    user,
    employee
  }), [
    activeModule, switchModule, currentModuleDef, availableModules,
    sidebarCollapsed, toggleSidebar, mobileSidebarOpen, workspaceSwitcherOpen,
    recentModules, user, employee
  ]);

  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  );
};

export default NavigationProvider;
