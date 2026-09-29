/**
 * spa-routes.js — the single source of truth for which URLs are real app routes.
 *
 * A client-side router cannot tell "a route that exists" from "a typo", so the
 * server has to. Every path listed here is served the SPA shell (index.html);
 * anything else gets a genuine HTTP 404. Real 404s matter because a catch-all
 * 200 makes crawlers and agent fetchers treat every typo, probe URL and
 * /.well-known document as a soft 404, which fails Lighthouse's llms-txt and
 * ard-schema audits and wastes crawl budget.
 *
 * Used by:
 *   - vite.config.js  (dev + `vite preview` middleware)
 *   - vercel.json     (rewrites) — KEEP THAT FILE IN SYNC BY HAND
 *
 * Employee routes are matched by prefix because they carry a :employeeSlug param.
 */

export const SPA_ROUTES = [
  // Public / marketing
  'AboutUs',
  'about',
  'ContactUs',
  'contact',
  'TermsConditions',
  'terms',
  'PrivacyPolicy',
  'privacy',
  'RefundsCancellations',
  'refunds',
  'Home',

  // Auth
  'Login',
  'login',
  'forgot-password',

  // Shopping
  'Shop',
  'Categories',
  'CategoryProducts',
  'ProductDetails',
  'Cart',
  'Wishlist',

  // Account
  'Orders',
  'Profile',
  'LoyaltyRewards',
  'Subscription',
  'Referral',
  'Delivery',

  // Operations / admin
  'CCA',
  'UserManagement',
  'admin/errors',
  'meals',
];

const ROUTE_SET = new Set(SPA_ROUTES);

/** @param {string} pathname raw path (no query, no hash) */
export function isSpaPath(pathname) {
  let clean = String(pathname || '').split('#')[0].split('?')[0];
  try {
    clean = decodeURIComponent(clean);
  } catch {
    /* keep the raw value */
  }
  clean = clean.replace(/\/+$/, '');
  if (clean === '') clean = '/';
  if (clean === '/') return true;

  const key = clean.replace(/^\//, '');
  if (ROUTE_SET.has(key)) return true;

  // /employee/<slug>/<section> — dynamic, but definitely an app route
  if (key === 'employee' || key.startsWith('employee/')) return true;

  return false;
}
