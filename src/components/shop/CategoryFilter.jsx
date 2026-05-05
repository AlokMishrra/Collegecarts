import React from "react";
import { cn } from "@/lib/utils";

export default function CategoryFilter({ categories, selectedCategory, onSelectCategory }) {
  return (
    <div className="overflow-x-auto snap-x snap-mandatory -webkit-overflow-scrolling-touch" style={{ scrollbarWidth: 'thin' }}>
      <div className="flex gap-3 pb-2">
        <button
          onClick={() => onSelectCategory(null)}
          className={cn(
            "px-6 py-3 rounded-full font-medium whitespace-nowrap transition-colors flex-shrink-0 snap-start active:scale-95",
            !selectedCategory
              ? "bg-emerald-600 text-white shadow-lg"
              : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-200"
          )}
        >
          All
        </button>
        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() => onSelectCategory(category.id)}
            className={cn(
              "flex items-center gap-2 px-6 py-3 rounded-full font-medium whitespace-nowrap transition-colors flex-shrink-0 snap-start active:scale-95",
              selectedCategory === category.id
                ? "bg-emerald-600 text-white shadow-lg"
                : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-200"
            )}
          >
            {category.image_url && (
              <img
                src={category.image_url}
                alt={category.name}
                className="w-6 h-6 rounded-full object-cover"
                loading="lazy"
              />
            )}
            {category.name}
          </button>
        ))}
      </div>
    </div>
  );
}