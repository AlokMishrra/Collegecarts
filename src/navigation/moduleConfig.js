/**
 * Module Configuration
 * Defines all modules in the CollegeCart super-app
 * Each module has its own sidebar, theme, and navigation
 */

import {
  ShoppingBag, UtensilsCrossed, Crown, Package, User, Briefcase,
  Heart, Tag, Zap, Coffee, Pizza, Sandwich, Apple, Truck,
  CreditCard, Bell, Shield, Settings, MapPin, Clock, History,
  Calendar, TrendingUp, Gift, Star, Users, Box, MessageCircle,
  BarChart3, DollarSign, Home, Search, Sparkles, Award
} from 'lucide-react';

export const MODULES = {
  SHOP: 'shop',
  MEALS: 'meals',
  PREMIUM: 'premium',
  ORDERS: 'orders',
  PROFILE: 'profile',
  EMPLOYEE: 'employee'
};

/**
 * Module definitions with theme, sidebar, and metadata
 */
export const moduleDefinitions = {
  [MODULES.SHOP]: {
    id: MODULES.SHOP,
    name: 'Shop',
    tagline: 'Groceries & Essentials',
    icon: ShoppingBag,
    color: '#10b981',
    bgGradient: 'from-emerald-500 to-green-600',
    bgLight: 'bg-emerald-50',
    textColor: 'text-emerald-600',
    borderColor: 'border-emerald-200',
    homeRoute: '/shop',
    searchPlaceholder: 'Search products, brands...',
    sidebarSections: [
      {
        title: '',
        items: [
          { label: 'Shop', icon: ShoppingBag, route: '/shop' },
          { label: 'Meals', icon: UtensilsCrossed, route: '/meals' },
          { label: 'Cart', icon: ShoppingBag, route: '/cart' },
          { label: 'Orders', icon: Package, route: '/orders' },
          { label: 'Premium', icon: Crown, route: '/subscription' },
          { label: 'My Profile', icon: User, route: '/profile' },
        ]
      },
      {
        title: 'Quick Access',
        items: [
          { label: 'Wishlist', icon: Heart, route: '/wishlist' },
        ]
      }
    ]
  },

  [MODULES.MEALS]: {
    id: MODULES.MEALS,
    name: 'Meals',
    tagline: 'Subscription & Daily Plans',
    icon: UtensilsCrossed,
    color: '#f97316',
    bgGradient: 'from-orange-500 to-red-500',
    bgLight: 'bg-orange-50',
    textColor: 'text-orange-600',
    borderColor: 'border-orange-200',
    homeRoute: '/meals',
    searchPlaceholder: 'Search meals, plans...',
    sidebarSections: [
      {
        title: '',
        items: [
          { label: 'Shop', icon: ShoppingBag, route: '/shop' },
          { label: 'Meals', icon: UtensilsCrossed, route: '/meals', badge: 'NEW' },
          { label: 'Cart', icon: ShoppingBag, route: '/cart' },
          { label: 'Orders', icon: Package, route: '/orders' },
          { label: 'Premium', icon: Crown, route: '/subscription' },
          { label: 'My Profile', icon: User, route: '/profile' },
        ]
      },
      {
        title: 'Meal Shortcuts',
        items: [
          { label: "Today's Menu", icon: Calendar, route: '/meals' },
          { label: 'Subscription', icon: Crown, route: '/meals?view=plans' },
          { label: 'Meal Calendar', icon: Calendar, route: '/meals?view=calendar' },
          { label: 'Nutrition', icon: TrendingUp, route: '/meals?view=nutrition' },
          { label: 'Favorites', icon: Heart, route: '/meals?view=favorites' },
          { label: 'Order History', icon: History, route: '/meals?view=history' },
        ]
      }
    ]
  },

  [MODULES.PREMIUM]: {
    id: MODULES.PREMIUM,
    name: 'Premium',
    tagline: 'Membership & Rewards',
    icon: Crown,
    color: '#a855f7',
    bgGradient: 'from-purple-500 to-pink-500',
    bgLight: 'bg-purple-50',
    textColor: 'text-purple-600',
    borderColor: 'border-purple-200',
    homeRoute: '/subscription',
    searchPlaceholder: 'Search rewards, perks...',
    sidebarSections: [
      {
        title: 'Membership',
        items: [
          { label: 'My Membership', icon: Crown, route: '/subscription' },
          { label: 'Plans & Pricing', icon: Tag, route: '/subscription?view=plans' },
          { label: 'Benefits', icon: Star, route: '/subscription?view=benefits' },
        ]
      },
      {
        title: 'Rewards',
        items: [
          { label: 'Loyalty Points', icon: Award, route: '/loyalty' },
          { label: 'Cashback', icon: DollarSign, route: '/loyalty?view=cashback' },
          { label: 'Referral', icon: Gift, route: '/refer' },
        ]
      }
    ]
  },

  [MODULES.ORDERS]: {
    id: MODULES.ORDERS,
    name: 'Orders',
    tagline: 'Track & Manage',
    icon: Package,
    color: '#3b82f6',
    bgGradient: 'from-blue-500 to-cyan-500',
    bgLight: 'bg-blue-50',
    textColor: 'text-blue-600',
    borderColor: 'border-blue-200',
    homeRoute: '/orders',
    searchPlaceholder: 'Search orders by ID...',
    sidebarSections: [
      {
        title: 'My Orders',
        items: [
          { label: 'All Orders', icon: Package, route: '/orders' },
          { label: 'Active', icon: Truck, route: '/orders?status=active' },
          { label: 'Delivered', icon: Package, route: '/orders?status=delivered' },
        ]
      },
      {
        title: 'Order Types',
        items: [
          { label: 'Grocery Orders', icon: ShoppingBag, route: '/orders?type=grocery' },
          { label: 'Subscription', icon: Crown, route: '/orders?type=subscription' },
        ]
      },
      {
        title: 'Support',
        items: [
          { label: 'Track Order', icon: MapPin, route: '/orders?view=track' },
          { label: 'Refunds', icon: DollarSign, route: '/orders?view=refunds' },
        ]
      }
    ]
  },

  [MODULES.PROFILE]: {
    id: MODULES.PROFILE,
    name: 'Profile',
    tagline: 'Account & Settings',
    icon: User,
    color: '#64748b',
    bgGradient: 'from-slate-500 to-gray-600',
    bgLight: 'bg-slate-50',
    textColor: 'text-slate-600',
    borderColor: 'border-slate-200',
    homeRoute: '/profile',
    searchPlaceholder: 'Search settings...',
    sidebarSections: [
      {
        title: 'Account',
        items: [
          { label: 'Personal Info', icon: User, route: '/profile' },
          { label: 'Saved Addresses', icon: MapPin, route: '/profile?view=addresses' },
          { label: 'Hostel Details', icon: Box, route: '/profile?view=hostel' },
        ]
      },
      {
        title: 'Preferences',
        items: [
          { label: 'Notifications', icon: Bell, route: '/profile?view=notifications' },
          { label: 'Payments', icon: CreditCard, route: '/profile?view=payments' },
          { label: 'Security', icon: Shield, route: '/profile?view=security' },
        ]
      },
      {
        title: 'More',
        items: [
          { label: 'Settings', icon: Settings, route: '/profile?view=settings' },
          { label: 'Help & Support', icon: MessageCircle, route: '/contact' },
        ]
      }
    ]
  },

  [MODULES.EMPLOYEE]: {
    id: MODULES.EMPLOYEE,
    name: 'Workspace',
    tagline: 'Employee Portal',
    icon: Briefcase,
    color: '#0891b2',
    bgGradient: 'from-cyan-600 to-teal-600',
    bgLight: 'bg-cyan-50',
    textColor: 'text-cyan-600',
    borderColor: 'border-cyan-200',
    homeRoute: '/employee/dashboard',
    searchPlaceholder: 'Search workspace...',
    requiresEmployeeAuth: true,
    sidebarSections: [] // Built dynamically based on role
  }
};

/**
 * Build employee sidebar based on role permissions
 */
export const buildEmployeeSidebar = (employee) => {
  if (!employee) return [];

  const role = employee.role?.role_code?.toLowerCase() || '';
  const permissions = employee.role?.permissions || {};
  const isSuperAdmin = permissions.all === true || role === 'super_admin';

  const sections = [
    {
      title: 'Overview',
      items: [
        { label: 'Dashboard', icon: Home, route: '/employee/dashboard' },
        { label: 'My Profile', icon: User, route: '/employee/profile' },
        { label: 'Attendance', icon: Calendar, route: '/employee/attendance' },
      ]
    }
  ];

  // Super Admin
  if (isSuperAdmin) {
    sections.push({
      title: 'Administration',
      items: [
        { label: 'All Employees', icon: Users, route: '/employee/manage-employees' },
        { label: 'Departments', icon: Box, route: '/employee/manage-departments' },
        { label: 'Payouts', icon: DollarSign, route: '/employee/payouts' },
        { label: 'Stock Manager', icon: Package, route: '/employee/stock-manager' },
        { label: 'Stock Orders', icon: Truck, route: '/employee/stock-orders' },
      ]
    });
    sections.push({
      title: 'Insights',
      items: [
        { label: 'Analytics', icon: BarChart3, route: '/employee/analytics' },
        { label: 'Finance', icon: DollarSign, route: '/employee/finance' },
        { label: 'Inventory', icon: Box, route: '/employee/inventory' },
        { label: 'Deliveries', icon: Truck, route: '/employee/deliveries' },
        { label: 'Support', icon: MessageCircle, route: '/employee/support' },
      ]
    });
  }

  // Stock Manager
  if (role.includes('stock') || permissions.manage_inventory) {
    sections.push({
      title: 'Inventory',
      items: [
        { label: 'Stock Manager', icon: Package, route: '/employee/stock-manager' },
        { label: 'Stock Orders', icon: Truck, route: '/employee/stock-orders' },
        { label: 'Create Order', icon: Box, route: '/employee/stock-orders/create' },
      ]
    });
  }

  // Delivery Partner
  if (role.includes('delivery') || permissions.view_delivery_portal) {
    sections.push({
      title: 'Delivery',
      items: [
        { label: 'Active Orders', icon: Truck, route: '/delivery' },
        { label: 'Earnings', icon: DollarSign, route: '/employee/finance' },
        { label: 'Attendance', icon: Calendar, route: '/employee/attendance' },
      ]
    });
  }

  // Common
  sections.push({
    title: 'Account',
    items: [
      { label: 'Salary', icon: DollarSign, route: '/employee/salary' },
      { label: 'Settings', icon: Settings, route: '/employee/settings' },
    ]
  });

  return sections;
};

/**
 * Detect current module from route path
 */
export const detectModuleFromPath = (pathname) => {
  if (pathname.startsWith('/employee') || pathname.startsWith('/delivery')) return MODULES.EMPLOYEE;
  if (pathname.startsWith('/meals')) return MODULES.MEALS;
  if (pathname.startsWith('/subscription') || pathname.startsWith('/loyalty') || pathname.startsWith('/refer')) return MODULES.PREMIUM;
  if (pathname.startsWith('/orders')) return MODULES.ORDERS;
  if (pathname.startsWith('/profile')) return MODULES.PROFILE;
  return MODULES.SHOP; // Default
};

/**
 * Get available modules based on user state
 */
export const getAvailableModules = ({ user, employee }) => {
  const available = [
    moduleDefinitions[MODULES.SHOP],
    moduleDefinitions[MODULES.MEALS],
    moduleDefinitions[MODULES.PREMIUM],
    moduleDefinitions[MODULES.ORDERS],
  ];

  if (user) {
    available.push(moduleDefinitions[MODULES.PROFILE]);
  }

  if (employee) {
    available.push(moduleDefinitions[MODULES.EMPLOYEE]);
  }

  return available;
};
