/**
 * route-meta.js — single source of truth for the static, indexable routes.
 *
 * Two consumers read this file and must never disagree:
 *   1. The page components (via `useSEO(ROUTE_META["/AboutUs"])`), which set
 *      the live <head> when JavaScript runs.
 *   2. `scripts/gen-route-htmls.mjs`, which bakes the same values into a
 *      prerendered `dist/<Route>/index.html` at build time so crawlers and AI
 *      agents that do not execute JavaScript still read the correct title,
 *      description, canonical and robots for every URL — instead of the
 *      homepage's head on every route.
 *
 * Keep entries only for routes that are indexable and appear in sitemap.xml.
 * Dynamic pages (/ProductDetails?id=…, /CategoryProducts?…) compute their own
 * titles at runtime and are deliberately not listed here.
 */

const base = {
  type: "website",
  image: "/og-image.jpg",
};

export const ROUTE_META = {
  "/": {
    ...base,
    title: "CollegeCart — 10-Minute Hostel Grocery Delivery",
    description:
      "Order groceries, dairy, snacks and daily essentials and get them delivered to your hostel room in 10 minutes. Live at Shivalik College & Quantum University. No minimum order.",
    url: "/",
  },
  "/Shop": {
    ...base,
    title: "Shop – Groceries, Snacks & Essentials",
    description:
      "Order groceries, snacks, beverages, and daily essentials for delivery to your hostel room in 10 minutes. Student-friendly prices. CollegeCart.",
    url: "/Shop",
  },
  "/Categories": {
    ...base,
    title: "Categories — Shop by Category",
    description:
      "Browse all grocery categories on CollegeCart — fruits, dairy, snacks, beverages and more for 10-minute hostel delivery.",
    url: "/Categories",
  },
  "/AboutUs": {
    ...base,
    title: "About CollegeCart — Founder & Campus Story",
    description:
      "Learn who runs CollegeCart, why it was founded by Alok Mishra in 2025, and how 10-minute grocery delivery to college hostels actually works.",
    url: "/AboutUs",
  },
  "/ContactUs": {
    ...base,
    title: "Contact CollegeCart — Phone & Email",
    description:
      "Contact CollegeCart for order help, refunds and delivery queries. Call +91 72483 16506 or email contact@collegecarts.in — support replies during store hours.",
    url: "/ContactUs",
  },
  "/TermsConditions": {
    ...base,
    title: "Terms & Conditions of Use",
    description:
      "The terms that govern orders, payments, delivery and use of the CollegeCart grocery delivery platform. Read them before placing an order.",
    url: "/TermsConditions",
  },
  "/PrivacyPolicy": {
    ...base,
    title: "Privacy Policy & Data Handling",
    description:
      "How CollegeCart collects, uses and protects your personal data, order history and payment details when you shop on our grocery delivery service.",
    url: "/PrivacyPolicy",
  },
  "/RefundsCancellations": {
    ...base,
    title: "Refunds & Cancellations Policy",
    description:
      "How to cancel a CollegeCart order, when a refund applies, and how long refunds take to reach your original payment method.",
    url: "/RefundsCancellations",
  },
};

/** Escape a string for safe use inside a double-quoted HTML attribute. */
export function escapeAttr(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Escape a string for safe use inside an HTML element. */
export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
