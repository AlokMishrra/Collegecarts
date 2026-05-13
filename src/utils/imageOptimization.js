/**
 * Image Optimization Utilities for CollegeCart
 * 
 * Provides utilities for:
 * - Lazy loading images
 * - Responsive image sizing
 * - WebP format support
 * - Image caching
 * - Placeholder generation
 */

/**
 * Generate optimized image URL with Supabase transformations
 * @param {string} url - Original image URL
 * @param {object} options - Transformation options
 * @returns {string} - Optimized image URL
 */
export function getOptimizedImageUrl(url, options = {}) {
  if (!url) return '';

  const {
    width = null,
    height = null,
    quality = 80,
    format = 'webp',
  } = options;

  // If it's a Supabase storage URL, add transformation parameters
  if (url.includes('supabase.co/storage')) {
    const params = new URLSearchParams();
    
    if (width) params.append('width', width);
    if (height) params.append('height', height);
    params.append('quality', quality);
    params.append('format', format);

    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}${params.toString()}`;
  }

  // Return original URL if not Supabase storage
  return url;
}

/**
 * Generate srcset for responsive images
 * @param {string} url - Original image URL
 * @param {array} sizes - Array of widths [320, 640, 1024, 1920]
 * @returns {string} - srcset string
 */
export function generateSrcSet(url, sizes = [320, 640, 1024, 1920]) {
  if (!url) return '';

  return sizes
    .map(width => {
      const optimizedUrl = getOptimizedImageUrl(url, { width, quality: 80 });
      return `${optimizedUrl} ${width}w`;
    })
    .join(', ');
}

/**
 * Generate placeholder image (low quality, small size)
 * @param {string} url - Original image URL
 * @returns {string} - Placeholder image URL
 */
export function getPlaceholderImage(url) {
  if (!url) return '';
  return getOptimizedImageUrl(url, { width: 40, quality: 20, format: 'webp' });
}

/**
 * Preload critical images
 * @param {array} urls - Array of image URLs to preload
 */
export function preloadImages(urls) {
  if (typeof window === 'undefined') return;

  urls.forEach(url => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = url;
    document.head.appendChild(link);
  });
}

/**
 * Lazy load image with IntersectionObserver
 * @param {HTMLImageElement} img - Image element
 * @param {string} src - Image source URL
 */
export function lazyLoadImage(img, src) {
  if (!img || !src) return;

  // Check if IntersectionObserver is supported
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const image = entry.target;
          image.src = src;
          image.classList.remove('lazy');
          observer.unobserve(image);
        }
      });
    }, {
      rootMargin: '50px', // Start loading 50px before image enters viewport
    });

    observer.observe(img);
  } else {
    // Fallback for browsers without IntersectionObserver
    img.src = src;
  }
}

/**
 * Check if WebP is supported
 * @returns {Promise<boolean>}
 */
export async function isWebPSupported() {
  if (typeof window === 'undefined') return false;

  // Check if already cached
  if (window.__webpSupported !== undefined) {
    return window.__webpSupported;
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      window.__webpSupported = img.width > 0 && img.height > 0;
      resolve(window.__webpSupported);
    };
    img.onerror = () => {
      window.__webpSupported = false;
      resolve(false);
    };
    img.src = 'data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==';
  });
}

/**
 * Get image format based on browser support
 * @returns {Promise<string>} - 'webp' or 'jpeg'
 */
export async function getOptimalImageFormat() {
  const webpSupported = await isWebPSupported();
  return webpSupported ? 'webp' : 'jpeg';
}

/**
 * Cache image in browser cache
 * @param {string} url - Image URL to cache
 */
export async function cacheImage(url) {
  if (!url || typeof window === 'undefined') return;

  try {
    // Use Cache API if available
    if ('caches' in window) {
      const cache = await caches.open('collegecart-images-v1');
      const response = await fetch(url);
      await cache.put(url, response);
    }
  } catch (error) {
    // Silently fail - caching is optional
  }
}

/**
 * Get cached image or fetch from network
 * @param {string} url - Image URL
 * @returns {Promise<string>} - Image URL (cached or network)
 */
export async function getCachedImage(url) {
  if (!url || typeof window === 'undefined') return url;

  try {
    if ('caches' in window) {
      const cache = await caches.open('collegecart-images-v1');
      const cachedResponse = await cache.match(url);
      
      if (cachedResponse) {
        return url; // Return URL, browser will use cached version
      }
    }
  } catch (error) {
    // Silently fail
  }

  return url;
}

/**
 * Clear image cache
 */
export async function clearImageCache() {
  if (typeof window === 'undefined' || !('caches' in window)) return;

  try {
    await caches.delete('collegecart-images-v1');
  } catch (error) {
    console.error('Failed to clear image cache:', error);
  }
}

/**
 * Get responsive image sizes based on viewport
 * @returns {object} - { mobile, tablet, desktop }
 */
export function getResponsiveImageSizes() {
  if (typeof window === 'undefined') {
    return { mobile: 320, tablet: 768, desktop: 1920 };
  }

  const width = window.innerWidth;

  if (width < 768) {
    return { mobile: 320, tablet: 640, desktop: 1024 };
  } else if (width < 1024) {
    return { mobile: 640, tablet: 768, desktop: 1280 };
  } else {
    return { mobile: 1024, tablet: 1280, desktop: 1920 };
  }
}
