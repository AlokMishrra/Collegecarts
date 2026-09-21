import React from "react";
import { ChevronDown } from "lucide-react";

/**
 * ShopHero — Zepto-style header.
 * Blue time badge + "Delivery to {hostel}" + dropdown to change hostel.
 */
export default function EnhancedShopHero({ hostelName, onChangeHostel }) {
  return (
    <div className="flex items-center gap-2.5 px-0.5 py-1">
      {/* Time badge */}
      <div className="w-[52px] h-[52px] rounded-xl bg-[#2563eb] flex flex-col items-center justify-center flex-shrink-0 leading-none">
        <span className="text-white text-[19px] font-extrabold tracking-tight">10</span>
        <span className="text-white text-[10px] font-bold tracking-wide">MINS</span>
      </div>

      {/* Address */}
      <button onClick={onChangeHostel} className="flex-1 min-w-0 text-left active:opacity-60">
        <p className="text-[15px] font-bold text-gray-900 leading-tight truncate">
          Delivery to {hostelName || "Other"}
        </p>
        <p className="text-xs text-gray-500 leading-tight truncate mt-0.5">
          {hostelName ? `${hostelName} Hostel` : "Tap to select your hostel"}
        </p>
      </button>

      {/* Hostel dropdown */}
      <button
        onClick={onChangeHostel}
        className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 active:bg-gray-200"
        aria-label="Change hostel"
      >
        <ChevronDown className="w-5 h-5 text-gray-700" strokeWidth={2.5} />
      </button>
    </div>
  );
}
