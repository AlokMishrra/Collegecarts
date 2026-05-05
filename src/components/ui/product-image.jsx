import React, { useState, useEffect, useRef } from 'react';

// ── Local SVG fallback ────────────────────────────────────────────────────
// Embedded data URI — zero network requests, works offline, never fails.
export const FALLBACK_IMG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300' " +
  "viewBox='0 0 400 300'%3E%3Crect fill='%23f3f4f6' width='400' height='300'/%3E" +
  "%3Ctext x='50%25' y='44%25' dominant-baseline='middle' text-anchor='middle' " +
  "font-family='Arial,sans-serif' font-size='52' fill='%23d1d5db'%3E%F0%9F%9B%92%3C/text%3E" +
  "%3Ctext x='50%25' y='72%25' dominant-baseline='middle' text-anchor='middle' " +
  "font-family='Arial,sans-serif' font-size='13' fill='%239ca3af'%3ENo image%3C/text%3E" +
  "%3C/svg%3E";

// ── URL probe cache ───────────────────────────────────────────────────────
// Remembers which URLs are good/bad so we never probe the same URL twice.
// 'ok' | 'bad' | undefined
const _urlCache = new Map();

/**
 * probeUrl — tests whether an image URL is loadable.
 * Uses a hidden Image() object so the probe never touches the React DOM.
 * Result is cached permanently for the lifetime of the page.
 */
function probeUrl(url) {
  if (!url) return Promise.resolve('bad');
  const cached = _urlCache.get(url);
  if (cached) return Promise.resolve(cached);

  return new Promise((resolve) => {
    const img = new Image();
    const done = (result) => {
      _urlCache.set(url, result);
      resolve(result);
    };
    img.onload  = () => done('ok');
    img.onerror = () => done('bad');
    img.src = url;
  });
}

/**
 * ProductImage — drop-in <img> replacement that:
 *  1. Shows a gray skeleton while probing the URL
 *  2. Probes the URL with a hidden Image() before touching the DOM
 *  3. If the URL is broken (ERR_CONNECTION_REFUSED, 404, DNS fail, etc.)
 *     the visible <img> is set to the local SVG fallback — never the broken URL
 *  4. Caches probe results so each URL is only tested once per session
 *
 * This eliminates the "GET https://mordai.in/... net::ERR_CONNECTION_REFUSED"
 * console error that appears during React's initial DOM render, because we
 * never set a broken src on a visible DOM element.
 */
export function ProductImage({
  src,
  alt = "Product",
  className = "",
  onError,
  ...props
}) {
  // 'probing' | 'ok' | 'bad'
  const [status, setStatus] = useState(() => {
    // If already cached, skip the probe entirely
    if (!src) return 'bad';
    const cached = _urlCache.get(src);
    return cached ?? 'probing';
  });

  const currentSrc = useRef(src);

  useEffect(() => {
    if (!src) { setStatus('bad'); return; }

    // src changed (e.g. product list re-render) — re-probe
    currentSrc.current = src;

    const cached = _urlCache.get(src);
    if (cached) { setStatus(cached); return; }

    setStatus('probing');
    probeUrl(src).then((result) => {
      // Only update if src hasn't changed while we were probing
      if (currentSrc.current === src) setStatus(result);
    });
  }, [src]);

  const effectiveSrc = status === 'ok' ? src : FALLBACK_IMG;
  const isLoading    = status === 'probing';

  return (
    <span className="relative block" style={{ display: 'block' }}>
      {/* Skeleton while probing */}
      {isLoading && (
        <span
          className={`absolute inset-0 bg-gray-200 animate-pulse ${className}`}
          style={{ display: 'block' }}
          aria-hidden="true"
        />
      )}
      {/* Only render <img> once we know the src — avoids setting broken URL in DOM */}
      {!isLoading && (
        <img
          src={effectiveSrc}
          alt={alt}
          className={className}
          onError={(e) => {
            // Safety net: if somehow a bad URL slips through, catch it here
            e.target.src = FALLBACK_IMG;
            if (onError) onError(e);
          }}
          loading="lazy"
          {...props}
        />
      )}
    </span>
  );
}

export default ProductImage;
