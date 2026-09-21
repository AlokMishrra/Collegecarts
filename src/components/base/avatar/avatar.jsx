import React, { useState } from "react";

const sizeMap = {
  sm: "w-8 h-8 text-sm",
  md: "w-10 h-10 text-[15px]",
  lg: "w-12 h-12 text-lg",
  xl: "w-14 h-14 text-xl",
};

export function Avatar({ status, size = "md", alt = "", src }) {
  const [imgError, setImgError] = useState(false);
  const showImage = src && !imgError;
  const initial = (alt?.charAt(0) || "A").toUpperCase();
  const sizeClass = sizeMap[size] || sizeMap.md;

  return (
    <span className="relative inline-flex flex-shrink-0">
      <span
        className={`inline-flex items-center justify-center rounded-full bg-[#10b981] text-white font-bold select-none overflow-hidden ${sizeClass}`}
        aria-label={alt}
      >
        {showImage ? (
          <img
            src={src}
            alt={alt}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          initial
        )}
      </span>
      {status && (
        <span
          className={`absolute bottom-0 right-0 block rounded-full ring-2 ring-white ${
            status === "online" ? "bg-emerald-500" : "bg-gray-400"
          } ${size === "sm" ? "w-2.5 h-2.5" : size === "lg" || size === "xl" ? "w-3.5 h-3.5" : "w-3 h-3"}`}
          aria-hidden
        />
      )}
    </span>
  );
}

export default Avatar;
