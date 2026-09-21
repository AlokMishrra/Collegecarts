import React from "react";
import { cn } from "@/lib/utils";
import { useSafeImageSrc } from "@/hooks/useSafeImageSrc";

/** Per-pill thumbnail with safe fallback to the initial letter. */
function CatThumb({ src, name, active }) {
  const safeSrc = useSafeImageSrc(src);
  return (
    <span
      className={cn(
        "w-7 h-7 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center",
        "ring-1",
        active ? "ring-[#0c831f]/30 bg-white" : "ring-black/5 bg-[#eef7ef]"
      )}
    >
      {safeSrc ? (
        <img src={safeSrc} alt="" className="w-full h-full object-cover" loading="lazy" />
      ) : (
        <span className="text-[12px] font-bold text-[#0c831f]">
          {name?.charAt(0)?.toUpperCase() || "•"}
        </span>
      )}
    </span>
  );
}

/**
 * CategoryFilter — premium pill row (Instamart/Apple style).
 * Unselected: white pill, hairline border, dark text.
 * Selected: soft green tint, brand-green border + text. No dark blob.
 */
export default function CategoryFilter({ categories, selectedCategory, onSelectCategory }) {
  const pill = (active) =>
    cn(
      "flex items-center gap-2 pl-1.5 pr-4 h-10 rounded-full text-[13px] whitespace-nowrap transition-all flex-shrink-0 snap-start active:scale-[0.97] touch-manipulation",
      "border-[1.5px]",
      active
        ? "bg-[#e8f6ea] border-[#0c831f] text-[#0b6b1a] font-bold shadow-[0_2px_8px_rgba(12,131,31,0.12)]"
        : "bg-white border-gray-200 text-gray-700 font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
    );

  return (
    <div className="overflow-x-auto snap-x snap-mandatory scrollbar-hide -mx-1 px-1">
      <div className="flex gap-2 py-1">
        <button onClick={() => onSelectCategory(null)} className={pill(!selectedCategory)}>
          <span
            className={cn(
              "w-7 h-7 rounded-full flex items-center justify-center text-[13px] flex-shrink-0",
              !selectedCategory ? "bg-[#0c831f] text-white" : "bg-[#eef7ef] text-[#0c831f]"
            )}
          >
            ✦
          </span>
          All
        </button>
        {categories.map((category) => {
          const active = selectedCategory === category.id;
          return (
            <button
              key={category.id}
              onClick={() => onSelectCategory(category.id)}
              className={pill(active)}
              aria-pressed={active}
            >
              <CatThumb src={category.image_url} name={category.name} active={active} />
              {category.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
