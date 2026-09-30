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

let written = 0;
// SPA_ROUTES entries have no leading slash ("Shop") while ROUTE_META keys do
// ("/Shop"), so normalise before comparing — otherwise every SEO route looks
// unhandled and gets clobbered by a noindex stub.
const seoRoutes = new Set(Object.keys(ROUTE_META).filter((r) => r !== "/").map((r) => r.replace(/^\//, "")));

for (const [route, meta] of Object.entries(ROUTE_META)) {
  const url = `${ORIGIN}${route === "/" ? "/" : route}`;
  const html = applyMeta(shell, meta, url);
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
  writeFileSync(target, applyMeta(shell, { noindex: true }, url));
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
