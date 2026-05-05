/**
 * useSafeImageSrc — returns a safe src for a raw <img> tag.
 *
 * Probes the URL with a hidden Image() before returning it.
 * Returns FALLBACK_IMG while probing and on failure.
 * Caches results so each URL is only probed once per session.
 *
 * Usage:
 *   const src = useSafeImageSrc(product.image_url);
 *   <img src={src} ... />
 *
 * This prevents "net::ERR_CONNECTION_REFUSED" console errors that appear
 * when React sets a broken URL as the src during initial DOM render.
 */

import { useState, useEffect, useRef } from 'react';
import { FALLBACK_IMG } from '@/components/ui/product-image';

// Shared probe cache — same as in product-image.jsx
const _urlCache = new Map();

function probeUrl(url) {
  if (!url) return Promise.resolve('bad');
  const cached = _urlCache.get(url);
  if (cached) return Promise.resolve(cached);

  return new Promise((resolve) => {
    const img = new Image();
    const done = (r) => { _urlCache.set(url, r); resolve(r); };
    img.onload  = () => done('ok');
    img.onerror = () => done('bad');
    img.src = url;
  });
}

export function useSafeImageSrc(src) {
  const [status, setStatus] = useState(() => {
    if (!src) return 'bad';
    return _urlCache.get(src) ?? 'probing';
  });
  const currentSrc = useRef(src);

  useEffect(() => {
    if (!src) { setStatus('bad'); return; }
    currentSrc.current = src;

    const cached = _urlCache.get(src);
    if (cached) { setStatus(cached); return; }

    setStatus('probing');
    probeUrl(src).then((result) => {
      if (currentSrc.current === src) setStatus(result);
    });
  }, [src]);

  if (status === 'ok') return src;
  if (status === 'probing') return null; // caller should show skeleton
  return FALLBACK_IMG;
}
