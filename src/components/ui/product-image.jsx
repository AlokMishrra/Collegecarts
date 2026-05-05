import React, { useState } from 'react';

// Fallback SVG image
const FALLBACK_IMAGE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'%3E%3Crect fill='%23f3f4f6' width='400' height='300'/%3E%3Cg transform='translate(200 150)'%3E%3Ccircle cx='0' cy='-20' r='30' fill='%23d1d5db'/%3E%3Cpath d='M -40 20 Q -40 -10, -20 -20 L 20 -20 Q 40 -10, 40 20 Z' fill='%23d1d5db'/%3E%3Ccircle cx='-15' cy='-25' r='5' fill='%23ffffff'/%3E%3Ccircle cx='15' cy='-25' r='5' fill='%23ffffff'/%3E%3Cpath d='M -15 -10 Q 0 -5, 15 -10' stroke='%23ffffff' stroke-width='3' fill='none' stroke-linecap='round'/%3E%3C/g%3E%3Ctext x='50%25' y='85%25' dominant-baseline='middle' text-anchor='middle' font-family='Arial, sans-serif' font-size='14' fill='%239ca3af'%3ENo Image Available%3C/text%3E%3C/svg%3E";

export function ProductImage({ 
  src, 
  alt = "Product", 
  className = "", 
  onError,
  ...props 
}) {
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const handleError = (e) => {
    if (!imageError) {
      setImageError(true);
      e.target.src = FALLBACK_IMAGE;
      if (onError) onError(e);
    }
    setIsLoading(false);
  };

  const handleLoad = () => {
    setIsLoading(false);
  };

  return (
    <>
      {isLoading && (
        <div className={`${className} bg-gray-200 animate-pulse`} />
      )}
      <img
        src={imageError ? FALLBACK_IMAGE : (src || FALLBACK_IMAGE)}
        alt={alt}
        className={`${className} ${isLoading ? 'hidden' : ''}`}
        onError={handleError}
        onLoad={handleLoad}
        loading="lazy"
        {...props}
      />
    </>
  );
}

export default ProductImage;
