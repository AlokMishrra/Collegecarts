/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import { lazy } from 'react';
import __Layout from './Layout.jsx';

// ---------------------------------------------------------------------------
// LAZY PAGE REGISTRATION
//
// These were static `import X from './pages/X'` statements. Because the entry
// chunk statically referenced every page, the bundler had to inline all of
// them, so a customer landing on /Shop downloaded Cart, Orders, Profile,
// ProductDetails, UserManagement, Delivery, LoyaltyRewards and Wishlist in the
// same request — along with whatever heavy libraries those pages import
// (xlsx, jspdf, recharts).
//
// `lazy()` keeps the exact same component names and the same PAGES map shape
// while moving each page into its own chunk, fetched only when that route is
// actually visited. Consumers (App.jsx) already render these inside a
// <Suspense> boundary, so no call site changes.
// ---------------------------------------------------------------------------
const CCA = lazy(() => import('./pages/CCA'));
const Cart = lazy(() => import('./pages/Cart'));
const Categories = lazy(() => import('./pages/Categories'));
const CategoryProducts = lazy(() => import('./pages/CategoryProducts'));
const Delivery = lazy(() => import('./pages/Delivery'));
const Home = lazy(() => import('./pages/Home'));
const LoyaltyRewards = lazy(() => import('./pages/LoyaltyRewards'));
const Orders = lazy(() => import('./pages/Orders'));
const ProductDetails = lazy(() => import('./pages/ProductDetails'));
const Profile = lazy(() => import('./pages/Profile'));
const Shop = lazy(() => import('./pages/Shop'));
const UserManagement = lazy(() => import('./pages/UserManagement'));
const Wishlist = lazy(() => import('./pages/Wishlist'));
const Subscription = lazy(() => import('./pages/Subscription'));


export const PAGES = {
    "CCA": CCA,
    "Cart": Cart,
    "Categories": Categories,
    "CategoryProducts": CategoryProducts,
    "Delivery": Delivery,
    "Home": Home,
    "LoyaltyRewards": LoyaltyRewards,
    "Orders": Orders,
    "ProductDetails": ProductDetails,
    "Profile": Profile,
    "Shop": Shop,
    "UserManagement": UserManagement,
    "Wishlist": Wishlist,
    "Subscription": Subscription,
}

export const pagesConfig = {
    mainPage: "Shop",
    Pages: PAGES,
    Layout: __Layout,
};