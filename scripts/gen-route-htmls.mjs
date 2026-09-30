/**
 * gen-route-htmls.mjs — post-build prerendering of the static route heads.
 *
 * An SPA serves the same shell HTML for every route, which means every URL's
 * raw <head> carries the homepage's title, description, canonical and robots.
 * Google executes JavaScript and fixes that at runtime, but the AI crawlers
 * that matter for answer engines (GPTBot, ClaudeBot, PerplexityBot, Bytespider)
 * do not execute JavaScript — they would read every page as "canonical:
 * /", which can deindex everything except the homepage.
 *
 * This script bakes one HTML file per static route into dist/ so the server
 * returns the correct head for each URL with zero JavaScript. It reads the
 * exact same meta table the pages use (src/route-meta.js), so the prerendered
 * head and the runtime head can never drift apart.
 *
 * Vercel checks the filesystem before applying rewrites, and with
 * "cleanUrls": true the flat file dist/Shop.html is served for /Shop — while
 * unknown paths still fall through to 404.html. `vite.config.js` mirrors this
 * for `vite dev` and `vite preview`.
 *
 * Run as part of `npm run build`.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ROUTE_META, escapeAttr, escapeHtml } from "../src/route-meta.js";
import { SPA_ROUTES } from "../spa-routes.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(__dirname, "..", "dist");
const shellPath = join(distDir, "index.html");

const ORIGIN = "https://shop.collegecarts.in";

const ROBOTS_INDEX =
  "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1";
const ROBOTS_NOINDEX = "noindex, follow";

if (!readFileSyncSafe(shellPath)) {
  console.error("gen-route-htmls: dist/index.html not found — run `vite build` first.");
  process.exit(1);
}

const shell = readFileSync(shellPath, "utf8");

/**
 * Per-route WebPage node.
 *
 * The shell carries the site-wide graph (Organization, Person, WebSite, ...).
 * Each route additionally needs its own WebPage that (a) has a unique @id so
 * pages never collapse into one another, (b) credits the founder as author and
 * "about", and (c) carries a matching breadcrumb. Without this, founder
 * attribution exists only on the homepage and the other seven pages are
 * anonymous to a search engine.
 */
function buildPageSchema(meta, route, url) {
  const heading = escapeHtml(meta.title || "CollegeCart");
  const summary = escapeAttr(meta.description || "");
  const isHome = route === "/";
  const crumbs = isHome
    ? [{ name: "Home", item: `${ORIGIN}/` }]
    : [{ name: "Home", item: `${ORIGIN}/` }, { name: heading, item: url }];

  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${url}#webpage`,
    url,
    name: meta.title || "CollegeCart",
    description: meta.description || "",
    isPartOf: { "@id": `${ORIGIN}/#website` },
    about: { "@id": `${ORIGIN}/#organization` },
    author: { "@id": `${ORIGIN}/#founder` },
    inLanguage: "en-IN",
    primaryImageOfPage: { "@id": `${ORIGIN}/#logo` },
    breadcrumb: {
      "@type": "BreadcrumbList",
      itemListElement: crumbs.map((c, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: c.name,
        item: c.item,
      })),
    },
  };
}

/** Append a script tag carrying the per-route node, before </body>. */
function injectPageSchema(html, node) {
  if (html.includes('id="route-page-schema"')) return html;
  const tag = `<script type="application/ld+json" id="route-page-schema">\n${JSON.stringify(
    node,
    null,
    2
  )}\n<\/script>\n</body>`;
  return html.replace("</body>", tag);
}


/**
 * Prerendered body copy, unique per route.
 *
 * React clears #root on mount, so visitors only ever see the live app — this
 * block exists purely for fetchers that do not execute JavaScript (GPTBot,
 * PerplexityBot, and most of the AI answer engines). It is built from the same
 * title/description the route declares, so the raw text, the meta tags and the
 * rendered page cannot disagree. Before this, every non-JS fetch saw the same
 * generic 70-word shell, which reads as thin content to an answer engine.
 */
function buildShell(meta, route) {
  const heading = escapeHtml(meta.title || "CollegeCart");
  const summary = escapeHtml(meta.description || "");
  const isHome = route === "/";
  const label = isHome
    ? "Groceries, dairy, snacks and daily essentials delivered to college hostel rooms in about 10 minutes. No minimum order."
    : summary;

  return `    <div id="root">
    <div style="font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;max-width:760px;margin:0 auto;padding:32px 20px;color:#0f172a;line-height:1.7;">
      <h1 style="font-size:26px;line-height:1.25;margin:0 0 14px;">${heading}</h1>
      <p style="margin:0 0 14px;">${label}</p>
      ${summary && !isHome ? `<p style="margin:0 0 20px;">${summary}</p>` : ""}
      <p style="margin:0 0 20px;">CollegeCart is an Indian quick commerce (q-commerce) brand founded by Alok Mishra in 2025. It runs campus dark stores at Shivalik College in Dehradun and Quantum University in Roorkee, Uttarakhand, and delivers groceries, milk, bread, eggs, snacks, cold drinks, instant food, kitchen and personal care to hostel rooms in about 10 minutes. Support: +91 72483 16506, contact@collegecarts.in.</p>
      <nav aria-label="Primary" style="border-top:1px solid #e5e7eb;padding-top:16px;">
        <h2 style="font-size:16px;margin:0 0 10px;">Shop and information</h2>
        <ul style="list-style:none;padding:0;margin:0;display:flex;flex-wrap:wrap;gap:10px 18px;font-size:15px;">
          <li><a href="/Shop">Shop all products</a></li>
          <li><a href="/Categories">Browse categories</a></li>
          <li><a href="/AboutUs">About CollegeCart</a></li>
          <li><a href="/ContactUs">Contact &amp; support</a></li>
          <li><a href="/TermsConditions">Terms &amp; conditions</a></li>
          <li><a href="/PrivacyPolicy">Privacy policy</a></li>
          <li><a href="/RefundsCancellations">Refunds &amp; cancellations</a></li>
        </ul>
      </nav>
    </div>
    </div>
`;
}

/** Replace the whole #root subtree, bounded by the splash comment that follows it. */
function replaceRoot(html, meta, route) {
  const start = html.indexOf('<div id="root">');
  if (start === -1) throw new Error("gen-route-htmls: no #root in shell");
  const endMarker = "<!-- Branded splash";
  const end = html.indexOf(endMarker, start);
  if (end === -1) throw new Error("gen-route-htmls: cannot find end of #root");
  return html.slice(0, start) + buildShell(meta, route) + "\n    " + html.slice(end);
}


let written = 0;
// SPA_ROUTES entries have no leading slash ("Shop") while ROUTE_META keys do
// ("/Shop"), so normalise before comparing — otherwise every SEO route looks
// unhandled and gets clobbered by a noindex stub.
const seoRoutes = new Set(Object.keys(ROUTE_META).filter((r) => r !== "/").map((r) => r.replace(/^\//, "")));

/** Fall back to the home copy for routes that are not SEO destinations. */
const metaFor = (route) => ROUTE_META[`/${route}`] || ROUTE_META["/"];

for (const [route, meta] of Object.entries(ROUTE_META)) {
  const url = `${ORIGIN}${route === "/" ? "/" : route}`;
  const html = injectPageSchema(
    replaceRoot(applyMeta(shell, meta, url), meta, route),
    buildPageSchema(meta, route, url)
  );
  if (route === "/") {
    // The shell itself is the homepage; write the corrected head back to it.
    writeFileSync(shellPath, html);
  } else {
    // Flat file + cleanUrls: dist/Shop.html is served for /Shop.
    writeFileSync(join(distDir, `${route.replace(/^\//, "")}.html`), html);
  }
  written += 1;
}

// ── Shell stubs for every remaining real route ────────────────────────────────
// Vercel matches the filesystem before applying rewrites, so a route only works
// if a file exists for it. Relying on a rewrite alternation proved fragile:
// /login has no prerendered head, and the deployed site answered it with the
// static 404 page. Emitting a noindex shell for each declared route means every
// real URL resolves from the filesystem, and only genuinely unknown paths fall
// through to 404.html.
let stubs = 0;
for (const route of SPA_ROUTES) {
  if (route === "/" || seoRoutes.has(route)) continue;
  const url = `${ORIGIN}/${route}`;
  const target = join(distDir, `${route}.html`);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, replaceRoot(applyMeta(shell, { noindex: true }, url), metaFor(route), route));
  stubs += 1;
}

console.log(
  `gen-route-htmls: wrote ${written} prerendered head(s) and ${stubs} route shell(s) to dist/`
);

/* ------------------------------------------------------------------ */

function readFileSyncSafe(path) {
  try {
    readFileSync(path);
    return true;
  } catch {
    return false;
  }
}

function replaceTag(html, pattern, replacement, optional = false) {
  if (!pattern.test(html)) {
    if (optional) return html;
    throw new Error(`gen-route-htmls: expected tag not found in shell: ${pattern}`);
  }
  return html.replace(pattern, replacement);
}

function applyMeta(html, meta, url) {
  const title = escapeHtml(meta.title);
  const description = escapeAttr(meta.description);
  const canonical = escapeAttr(url);
  const image = escapeAttr(`${ORIGIN}${meta.image || "/og-image.jpg"}`);
  const type = escapeAttr(meta.type || "website");

  let out = html;

  out = replaceTag(out, /<title>[^<]*<\/title>/, `<title>${title}</title>`);

  out = replaceTag(
    out,
    /<meta name="description" content="[^"]*" \/>/,
    `<meta name="description" content="${description}" />`
  );

  out = replaceTag(
    out,
    /<link rel="canonical" href="[^"]*" \/>/,
    `<link rel="canonical" href="${canonical}" />`
  );

  // Honour a per-route noindex flag. Routes that duplicate another page (the
  // root duplicates /Shop) must not be indexed, but stay crawlable.
  out = replaceTag(
    out,
    /<meta name="robots" content="[^"]*" \/>/,
    `<meta name="robots" content="${meta.noindex ? ROBOTS_NOINDEX : ROBOTS_INDEX}" />`
  );

  out = replaceTag(
    out,
    /<meta property="og:type" content="[^"]*" \/>/,
    `<meta property="og:type" content="${type}" />`
  );
  out = replaceTag(
    out,
    /<meta property="og:url" content="[^"]*" \/>/,
    `<meta property="og:url" content="${canonical}" />`,
    true
  );
  out = replaceTag(
    out,
    /<meta property="og:title" content="[^"]*" \/>/,
    `<meta property="og:title" content="${title}" />`
  );
  out = replaceTag(
    out,
    /<meta property="og:description" content="[^"]*" \/>/,
    `<meta property="og:description" content="${description}" />`
  );
  out = replaceTag(
    out,
    /<meta property="og:image" content="[^"]*" \/>/,
    `<meta property="og:image" content="${image}" />`
  );

  out = replaceTag(
    out,
    /<meta name="twitter:title" content="[^"]*" \/>/,
    `<meta name="twitter:title" content="${title}" />`
  );
  out = replaceTag(
    out,
    /<meta name="twitter:description" content="[^"]*" \/>/,
    `<meta name="twitter:description" content="${description}" />`
  );
  out = replaceTag(
    out,
    /<meta name="twitter:url" content="[^"]*" \/>/,
    `<meta name="twitter:url" content="${canonical}" />`,
    true
  );

  return out;
}
