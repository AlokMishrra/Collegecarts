import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/** Single production origin. Keep this identical to the index.html canonical. */
export const SITE_ORIGIN = "https://shop.collegecarts.in";

const siteName = "CollegeCart";
const defaultDesc =
  "10-minute grocery & essentials delivery to your hostel room. Student-friendly prices. Live at Shivalik College & Quantum University.";
const defaultImage = `${SITE_ORIGIN}/og-image.jpg`;

/** Normalise a route into an origin-consistent absolute URL. */
export function absoluteUrl(path) {
  if (!path) return SITE_ORIGIN;
  if (/^https?:\/\//i.test(path)) {
    try {
      const u = new URL(path);
      const p = u.pathname === "/" ? "/" : u.pathname.replace(/\/+$/, "");
      return `${SITE_ORIGIN}${p}`;
    } catch {
      return SITE_ORIGIN;
    }
  }
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_ORIGIN}${p === "/" ? "/" : p.replace(/\/+$/, "")}`;
}

function upsertMeta(selector, createAttrs, attr, value) {
  let el = document.querySelector(selector);
  if (!el) {
    el = document.createElement("meta");
    for (const [k, v] of Object.entries(createAttrs)) el.setAttribute(k, v);
    document.head.appendChild(el);
  }
  el.setAttribute(attr, value);
}

function setRobots(content) {
  upsertMeta('meta[name="robots"]', { name: "robots" }, "content", content);
}

function setLinkCanonical(href) {
  let el = document.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}


/** Insert or replace a JSON-LD node keyed by its script id. */
export function setJsonLd(id, data) {
  if (typeof document === "undefined") return;
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement("script");
    el.type = "application/ld+json";
    el.id = id;
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

export function removeJsonLd(id) {
  const el = typeof document !== "undefined" && document.getElementById(id);
  if (el) el.remove();
}


// Params that do not identify distinct indexable content. Search-result and
// tracking URLs must canonicalise back to the clean page they filter.
const NON_IDENTIFYING = /^(q|query|s|search|ref|source|fbclid|gclid|igshid|mc_cid|mc_eid)$/i;

/** Build the canonical URL for the current location, dropping filter/tracking params. */
export function selfCanonical(pathname, search = "") {
  if (!search) return absoluteUrl(pathname);
  const params = new URLSearchParams(search);
  for (const key of [...params.keys()]) {
    if (NON_IDENTIFYING.test(key) || key.toLowerCase().startsWith("utm_")) {
      params.delete(key);
    }
  }
  const qs = params.toString();
  return absoluteUrl(pathname) + (qs ? `?${qs}` : "");
}

/**
 * assetUrl — for images and other media. Absolute URLs (CDN, Supabase
 * storage) are left alone; relative paths are resolved against production.
 */
export function assetUrl(src) {
  if (!src) return "";
  if (/^https?:\/\//i.test(src)) return src;
  if (src.startsWith("data:") || src.startsWith("blob:")) return src;
  return `${SITE_ORIGIN}${src.startsWith("/") ? src : `/${src}`}`;
}

/**
 * useSEO — updates <title>, meta description, og tags, canonical and robots.
 * Plain function (no hooks) so it can be called inside a useEffect.
 *
 * @param {object}  opts
 * @param {string}  [opts.title]       Without the "| CollegeCart" suffix.
 * @param {string}  [opts.description]
 * @param {string}  [opts.url]         Route path ("/AboutUs"). Must match the
 *                                     real pathname; omit to auto-use the live one.
 * @param {string}  [opts.image]
 * @param {string}  [opts.type]        og:type.
 * @param {boolean} [opts.noindex]     True on account/utility routes.
 */
export function useSEO({
  title,
  description,
  url,
  image,
  type = "website",
  noindex = false,
} = {}) {
  // Keep the query string: /ProductDetails?id=... and /CategoryProducts?categoryId=...
  // identify the content, so their canonicals must be self-referencing per URL.
  const livePath =
    typeof window !== "undefined"
      ? window.location.pathname + window.location.search
      : "/";

  // Pages may already lead with the brand; appending a second time would read
  // "CollegeCart — ... | CollegeCart" and push the title past the ~60 char
  // truncation point in the SERP.
  const hasBrand = !!title && title.toLowerCase().includes(siteName.toLowerCase());
  const fullTitle = title
    ? hasBrand
      ? title
      : `${title} | ${siteName}`
    : `${siteName} – 10-Min Grocery Delivery to Your Hostel`;
  const metaDesc = description || defaultDesc;
  const metaUrl = url
    ? absoluteUrl(url)
    : selfCanonical(
        typeof window !== "undefined" ? window.location.pathname : "/",
        typeof window !== "undefined" ? window.location.search : ""
      );
  const metaImage = image ? assetUrl(image) : defaultImage;


  document.title = fullTitle;

  upsertMeta('meta[name="description"]', { name: "description" }, "content", metaDesc);
  upsertMeta('meta[name="title"]', { name: "title" }, "content", fullTitle);

  upsertMeta('meta[property="og:title"]', { property: "og:title" }, "content", fullTitle);
  upsertMeta('meta[property="og:description"]', { property: "og:description" }, "content", metaDesc);
  upsertMeta('meta[property="og:url"]', { property: "og:url" }, "content", metaUrl);
  upsertMeta('meta[property="og:image"]', { property: "og:image" }, "content", metaImage);
  upsertMeta('meta[property="og:type"]', { property: "og:type" }, "content", type);

  upsertMeta('meta[name="twitter:title"]', { name: "twitter:title" }, "content", fullTitle);
  upsertMeta('meta[name="twitter:description"]', { name: "twitter:description" }, "content", metaDesc);
  upsertMeta('meta[name="twitter:url"]', { name: "twitter:url" }, "content", metaUrl);
  upsertMeta('meta[name="twitter:image"]', { name: "twitter:image" }, "content", metaImage);

  setRobots(noindex ? "noindex, follow" : "index, follow, max-image-preview:large, max-snippet:-1");
  setLinkCanonical(metaUrl);
}

const NOINDEX_PREFIXES = [
  "/Cart", "/Orders", "/Profile", "/Wishlist", "/UserManagement", "/CCA",
  "/LoyaltyRewards", "/Subscription", "/Referral", "/Delivery", "/Home",
  "/admin", "/employee", "/login", "/Login", "/forgot-password",
];

/**
 * RouteSentinel — safety net rendered once inside the router. Guarantees every
 * route ends up with a self-referencing canonical and a sane robots directive,
 * even when the page never calls useSEO. Runs after page effects, so it wins.
 */
export function RouteSentinel() {
  const location = useLocation();

  useEffect(() => {
    const path = location.pathname;
    const isNoindex = NOINDEX_PREFIXES.some(
      (p) => path === p || path.startsWith(`${p}/`)
    );

    setRobots(
      isNoindex
        ? "noindex, follow"
        : "index, follow, max-image-preview:large, max-snippet:-1"
    );
    setLinkCanonical(selfCanonical(location.pathname, location.search));
  }, [location.pathname, location.search]);

  return null;
}
