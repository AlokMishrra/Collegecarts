import React from "react";
import { Link } from "react-router-dom";
import { Clock } from "lucide-react";
import { createPageUrl } from "@/utils";
import { useSafeImageSrc } from "@/hooks/useSafeImageSrc";

function CardImage({ src, alt }) {
  const safeSrc = useSafeImageSrc(src);
  if (!safeSrc) {
    return <div className="w-full h-full bg-gray-100 animate-pulse" />;
  }
  return (
    <img
      src={safeSrc}
      alt={alt}
      className="max-h-full max-w-full object-contain"
      loading="lazy"
    />
  );
}

/**
 * CompactProductCard — Blinkit/Instamart-style compact product card.
 * Used in all horizontal product rows + small grids for a consistent look.
 *
 * Layout (top → bottom):
 *  - Square-ish image on near-white bg, OFF% corner ribbon
 *  - Delivery-time pill overlapping image bottom-left
 *  - 2-line name, unit/qty grey line
 *  - Price + MRP row
 *  - Full-width ADD (white / green border) or slim stepper
 */
export default function CompactProductCard({
  product,
  cartQty = 0,
  onAddToCart,
  onUpdateQuantity,
  inStock = true,
  maxReached = false,
  extraBelowAdd = null,
}) {
  const hasDiscount =
    product.original_price && product.original_price > product.price;
  const discountPct = hasDiscount
    ? Math.round(
        ((product.original_price - product.price) / product.original_price) * 100
      )
    : 0;
  const isOutOfStock = !inStock && cartQty === 0;

  const stop = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-[0_1px_4px_rgba(0,0,0,0.06)] overflow-hidden flex flex-col h-full">
      {/* ── Image ── */}
      <Link
        to={createPageUrl(`ProductDetails?id=${product.id}`)}
        className="block relative bg-[#f8f8f8]"
      >
        {hasDiscount && (
          <div className="absolute top-0 left-0 bg-[#2563eb] text-white text-[8px] font-bold px-1.5 py-[3px] rounded-br-lg z-10 leading-none">
            {discountPct}% OFF
          </div>
        )}
        <div className="w-full h-[104px] flex items-center justify-center p-2 overflow-hidden">
          {product.image_url ? (
            <CardImage src={product.image_url} alt={product.name} />
          ) : (
            <span className="text-2xl">🛍️</span>
          )}
        </div>
        {/* Delivery pill overlapping bottom-left */}
        <div className="absolute -bottom-2 left-2 bg-white border border-gray-100 shadow-sm px-1.5 py-[3px] rounded-md flex items-center gap-1 z-10">
          <Clock className="w-2.5 h-2.5 text-gray-500" strokeWidth={2.5} />
          <span className="text-[8px] font-bold text-gray-600 uppercase tracking-tight leading-none">
            {product.delivery_time || "13 mins"}
          </span>
        </div>
      </Link>

      {/* ── Body ── */}
      <div className="p-2 pt-3 flex flex-col flex-1">
        <Link to={createPageUrl(`ProductDetails?id=${product.id}`)}>
          <h3 className="font-semibold text-[12px] text-gray-900 line-clamp-2 leading-[1.3] min-h-[31px]">
            {product.name}
          </h3>
        </Link>
        <p className="text-[11px] text-gray-400 mt-[3px] leading-none truncate">
          {product.unit || "1 pc"}
        </p>

        <div className="flex items-baseline gap-1 mt-1.5">
          <span className="text-[13px] font-bold text-gray-900">
            ₹{product.price}
          </span>
          {hasDiscount && (
            <span className="text-[10px] text-gray-400 line-through">
              ₹{product.original_price}
            </span>
          )}
        </div>

        {/* ── Action ── */}
        <div className="mt-2">
          {isOutOfStock ? (
            <button
              disabled
              className="w-full bg-gray-100 text-gray-400 text-[11px] font-bold h-[30px] rounded-lg cursor-not-allowed"
            >
              OUT OF STOCK
            </button>
          ) : cartQty > 0 ? (
            <div className="flex items-center justify-between bg-[#e8f8e8] rounded-lg h-[30px] px-1">
              <button
                type="button"
                onClick={(e) => {
                  stop(e);
                  onUpdateQuantity?.(product, -1);
                }}
                className="w-7 h-full flex items-center justify-center text-[#0c831f] font-bold text-base active:scale-90 transition-transform touch-manipulation"
                style={{ WebkitTapHighlightColor: "transparent" }}
                aria-label="Decrease quantity"
              >
                −
              </button>
              <span className="font-bold text-[#0c831f] text-[13px] min-w-[20px] text-center select-none">
                {cartQty}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  stop(e);
                  if (!maxReached) onUpdateQuantity?.(product, 1);
                }}
                disabled={maxReached}
                className={`w-7 h-full flex items-center justify-center font-bold text-base rounded transition-all touch-manipulation ${
                  maxReached
                    ? "text-gray-300 cursor-not-allowed"
                    : "text-[#0c831f] active:scale-90"
                }`}
                style={{ WebkitTapHighlightColor: "transparent" }}
                aria-label="Increase quantity"
              >
                +
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={(e) => {
                  stop(e);
                  onAddToCart?.(product);
                }}
                className="w-full bg-white border border-[#0c831f] text-[#0c831f] hover:bg-[#0c831f] hover:text-white text-[11px] font-bold h-[30px] rounded-lg active:scale-95 transition-all touch-manipulation tracking-wide"
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                ADD
              </button>
              {extraBelowAdd}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
