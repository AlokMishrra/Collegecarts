/**
 * gen-sitemap.mjs — build the XML sitemaps from live data.
 *
 * The catalogue is dynamic: categories and products live in Supabase, so a
 * hand-written sitemap.xml can never list them. This script queries the public
 * catalogue (readable with the anon key, no service_role needed) and writes:
 *
 *   public/sitemap.xml            static pages + every category page
 *   public/sitemap-products.xml   every product page
 *
 * Product and category URLs carry their id only. The name is deliberately left
 * out of the canonical URL, because /CategoryProducts?categoryId=x&categoryName=Beverages
 * and ...&categoryName=beverages are the same page and would otherwise be
 * indexed as duplicates.
 *
 * If the catalogue cannot be reached the static pages are still written, so a
 * network hiccup at build time can never produce an empty sitemap.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const publicDir = join(root, "public");

const ORIGIN = "https://shop.collegecarts.in";
const TODAY = process.env.SITEMAP_DATE || new Date().toISOString().slice(0, 10);

const STATIC_PAGES = [
  { loc: "/", priority: "1.0", changefreq: "daily" },
  { loc: "/Shop", priority: "0.9", changefreq: "daily" },
  { loc: "/Categories", priority: "0.9", changefreq: "weekly" },
  { loc: "/AboutUs", priority: "0.6", changefreq: "monthly" },
  { loc: "/ContactUs", priority: "0.6", changefreq: "monthly" },
  { loc: "/TermsConditions", priority: "0.3", changefreq: "yearly" },
  { loc: "/PrivacyPolicy", priority: "0.3", changefreq: "yearly" },
  { loc: "/RefundsCancellations", priority: "0.3", changefreq: "yearly" },
];

const urlEntry = ({ loc, priority, changefreq }) => `  <url>
    <loc>${escapeXml(`${ORIGIN}${loc}`)}</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>${changefreq || "weekly"}</changefreq>
    <priority>${priority || "0.5"}</priority>
  </url>`;

function escapeXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function wrap(name, entries) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join("\n")}
</urlset>
`;
}

const { url: SUPABASE_URL, key: ANON } = readSupabaseConfig();

async function fetchRows(table, select, limit) {
  if (!SUPABASE_URL || !ANON) return [];
  const url =
    `${SUPABASE_URL}/rest/v1/${table}` +
    `?select=${encodeURIComponent(select)}&limit=${limit}`;
  const res = await fetch(url, {
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
  });
  if (!res.ok) throw new Error(`${table} -> HTTP ${res.status}`);
  return res.json();
}

function readSupabaseConfig() {
  let url = process.env.VITE_SUPABASE_URL;
  let key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    // Vite-style .env parsing, so the script works locally without dotenv.
    const envPath = join(root, ".env");
    if (existsSync(envPath)) {
      for (const line of readFileSync(envPath, "utf8").split("\n")) {
        const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
        if (!m) continue;
        const [, k, raw] = m;
        const v = raw.replace(/^["']|["']$/g, "");
        if (k === "VITE_SUPABASE_URL") url ??= v;
        if (k === "VITE_SUPABASE_ANON_KEY") key ??= v;
      }
    }
  }
  return { url, key };
}

let categories = [];
let products = [];

try {
  [categories, products] = await Promise.all([
    fetchRows("categories", "id,name", 1000),
    fetchRows("products", "id,name", 1000),
  ]);
  console.log(
    `gen-sitemap: ${categories.length} categories, ${products.length} products fetched`
  );
} catch (err) {
  console.warn(
    `gen-sitemap: catalogue unreachable (${err.message}); writing static pages only`
  );
}

// Never let a build succeed with a silently empty product sitemap. Without this,
// a missing or renamed VITE_SUPABASE_* variable produced a green deploy that
// shipped zero product URLs and nobody noticed until rankings dropped.
if (products.length === 0) {
  console.error(
    "\n  ############################################################\n" +
    "  #  gen-sitemap: 0 products fetched. STOP AND FIX.            #\n" +
    "  #                                                          #\n" +
    "  #  Set both of these as Vercel project environment variables:\n" +
    "  #    VITE_SUPABASE_URL      (https://<ref>.supabase.co)      #\n" +
    "  #    VITE_SUPABASE_ANON_KEY (the anon/publishable key)       #\n" +
    "  #                                                          #\n" +
    "  #  The build is aborted so an empty product sitemap cannot be\n" +
    "  #  deployed. They are the same variables the app itself uses. #\n" +
    "  ############################################################\n"
  );
  process.exit(1);
}

const categoryEntries = categories.map((c) => ({
  loc: `/CategoryProducts?categoryId=${encodeURIComponent(c.id)}&categoryName=${encodeURIComponent(c.name || "")}`,
  priority: "0.8",
  changefreq: "weekly",
}));

const productEntries = products.map((p) => ({
  loc: `/ProductDetails?id=${encodeURIComponent(p.id)}`,
  priority: "0.7",
  changefreq: "weekly",
}));

writeFileSync(
  join(publicDir, "sitemap.xml"),
  wrap("sitemap", [...STATIC_PAGES, ...categoryEntries].map(urlEntry))
);
writeFileSync(
  join(publicDir, "sitemap-products.xml"),
  wrap("sitemap-products", productEntries.map(urlEntry))
);

console.log(
  `gen-sitemap: wrote sitemap.xml (${STATIC_PAGES.length + categoryEntries.length} urls) and sitemap-products.xml (${productEntries.length} urls)`
);
