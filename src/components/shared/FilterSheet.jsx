import React, { useState } from "react";
import { X } from "lucide-react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

const CATEGORY_TABS = ["Gourmet", "Brand", "Type", "Flavour", "Customer Ratings", "Packaging Type", "Diet Type"];
const SHOP_TABS = ["Category", "Price", "Availability", "Rating", "Sort By"];

export default function FilterSheet({
  open,
  onOpenChange,
  products = [],
  filters,
  onFilterChange,
  sortBy,
  onSortChange,
  subFilters,
  setSubFilters,
  variant = "category",
  categories = [],
  selectedCategory,
  onSelectCategory,
  priceRange,
  setPriceRange,
}) {
  const TABS = variant === "shop" ? SHOP_TABS : CATEGORY_TABS;
  const [activeTab, setActiveTab] = useState(TABS[0]);

  // Keep active tab in sync when variant changes
  React.useEffect(() => {
    setActiveTab(TABS[0]);
  }, [variant]);

  // Derive brand options from products (first word of name) — for category mode
  const brandOptions = [...new Set(products.map((p) => p.name?.split(" ")[0]).filter(Boolean))].slice(0, 10);

  const handleBrandToggle = (brand, checked) => {
    if (!setSubFilters) return;
    setSubFilters((prev) => ({
      ...prev,
      brands: checked ? [...prev.brands, brand] : prev.brands.filter((b) => b !== brand),
    }));
  };

  const handleClearAll = () => {
    onFilterChange?.({ availability: "all", rating: "all" });
    onSortChange?.("relevance");
    onSelectCategory?.(null);
    setPriceRange?.([0, 1000]);
    setSubFilters?.({ gourmet: false, brands: [], types: [], flavours: [], packaging: [], diet: [] });
  };

  // Count active filters for badge
  const activeCount =
    (filters?.availability !== "all" ? 1 : 0) +
    (filters?.rating !== "all" ? 1 : 0) +
    (sortBy && sortBy !== "relevance" ? 1 : 0) +
    (subFilters?.gourmet ? 1 : 0) +
    (subFilters?.brands?.length || 0) +
    (subFilters?.types?.length || 0) +
    (subFilters?.flavours?.length || 0) +
    (subFilters?.packaging?.length || 0) +
    (subFilters?.diet?.length || 0) +
    (selectedCategory ? 1 : 0) +
    (priceRange && (priceRange[0] > 0 || priceRange[1] < 1000) ? 1 : 0);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="h-[78vh] p-0 flex flex-col rounded-t-2xl">
        <DrawerHeader className="flex flex-row items-center justify-between px-4 py-3 border-b shrink-0">
          <DrawerTitle className="text-lg font-bold">Filters</DrawerTitle>
          <button
            onClick={() => onOpenChange(false)}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200"
          >
            <X className="w-4 h-4" />
          </button>
        </DrawerHeader>

        <div className="flex flex-1 overflow-hidden">
          {/* Left nav */}
          <div className="w-[38%] bg-gray-50 border-r overflow-y-auto">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`w-full text-left px-4 py-3.5 text-sm border-l-4 ${
                  activeTab === tab
                    ? "bg-white border-blue-600 text-blue-600 font-bold"
                    : "border-transparent text-gray-700 font-medium"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Right content — shop variant uses real shop data, category variant uses gourmet etc. */}
          <div className="flex-1 p-4 overflow-y-auto bg-white">
            {variant === "shop" ? (
              <>
                {activeTab === "Category" && (
                  <div className="space-y-1">
                    <label className="flex items-center gap-3 py-2">
                      <Checkbox
                        checked={!selectedCategory}
                        onCheckedChange={() => onSelectCategory?.(null)}
                      />
                      <span className="text-sm font-medium">All Categories</span>
                    </label>
                    {(categories || []).slice(0, 20).map((cat) => (
                      <label key={cat.id} className="flex items-center gap-3 py-2">
                        <Checkbox
                          checked={selectedCategory === cat.id}
                          onCheckedChange={(v) => {
                            if (v) onSelectCategory?.(cat.id);
                            else onSelectCategory?.(null);
                          }}
                        />
                        <span className="text-sm">{cat.name}</span>
                      </label>
                    ))}
                    {(!categories || categories.length === 0) && (
                      <p className="text-xs text-gray-400">No categories</p>
                    )}
                  </div>
                )}
                {activeTab === "Price" && (
                  <div className="space-y-3">
                    <Slider
                      value={priceRange || [0, 1000]}
                      onValueChange={(v) => {
                        setPriceRange?.(v);
                        onFilterChange?.({ ...filters, priceRange: v });
                      }}
                      max={1000}
                      step={10}
                      className="mt-2"
                    />
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>₹{priceRange?.[0] ?? 0}</span>
                      <span>₹{priceRange?.[1] ?? 1000}</span>
                    </div>
                  </div>
                )}
                {activeTab === "Availability" && (
                  <label className="flex items-center gap-3 py-2">
                    <Checkbox
                      checked={filters?.availability === "in_stock"}
                      onCheckedChange={(v) => onFilterChange?.({ ...filters, availability: v ? "in_stock" : "all" })}
                    />
                    <span className="text-sm">In Stock Only</span>
                  </label>
                )}
                {activeTab === "Rating" && (
                  <div className="space-y-1">
                    <label className="flex items-center gap-3 py-2">
                      <Checkbox checked={filters?.rating === "4"} onCheckedChange={(v) => onFilterChange?.({ ...filters, rating: v ? "4" : "all" })} />
                      <span className="text-sm">4★ & above</span>
                    </label>
                    <label className="flex items-center gap-3 py-2">
                      <Checkbox checked={filters?.rating === "3"} onCheckedChange={(v) => onFilterChange?.({ ...filters, rating: v ? "3" : "all" })} />
                      <span className="text-sm">3★ & above</span>
                    </label>
                  </div>
                )}
                {activeTab === "Sort By" && (
                  <div className="space-y-1">
                    {[
                      ["relevance", "Relevance"],
                      ["price_low", "Price: Low to High"],
                      ["price_high", "Price: High to Low"],
                      ["rating", "Highest Rated"],
                    ].map(([val, label]) => (
                      <label key={val} className="flex items-center gap-3 py-2">
                        <Checkbox checked={sortBy === val} onCheckedChange={() => onSortChange?.(val)} />
                        <span className="text-sm">{label}</span>
                      </label>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                {activeTab === "Gourmet" && (
                  <label className="flex items-center gap-3 py-2">
                    <Checkbox
                      checked={!!subFilters?.gourmet}
                      onCheckedChange={(v) => setSubFilters?.({ ...subFilters, gourmet: !!v })}
                    />
                    <span className="text-sm">Gourmet</span>
                  </label>
                )}
                {activeTab === "Brand" && (
                  <div className="space-y-1">
                    {brandOptions.length > 0 ? (
                      brandOptions.map((brand) => (
                        <label key={brand} className="flex items-center gap-3 py-2">
                          <Checkbox
                            checked={subFilters?.brands?.includes(brand)}
                            onCheckedChange={(v) => handleBrandToggle(brand, !!v)}
                          />
                          <span className="text-sm">{brand}</span>
                        </label>
                      ))
                    ) : (
                      <p className="text-xs text-gray-400">No brands</p>
                    )}
                  </div>
                )}
                {activeTab === "Type" && (
                  <div className="space-y-1">
                    {["Snacks", "Beverages", "Dairy", "Bakery"].map((t) => (
                      <label key={t} className="flex items-center gap-3 py-2">
                        <Checkbox
                          checked={subFilters?.types?.includes(t)}
                          onCheckedChange={(v) =>
                            setSubFilters({
                              ...subFilters,
                              types: v ? [...subFilters.types, t] : subFilters.types.filter((x) => x !== t),
                            })
                          }
                        />
                        <span className="text-sm">{t}</span>
                      </label>
                    ))}
                  </div>
                )}
                {activeTab === "Flavour" && (
                  <div className="space-y-1">
                    {["Chocolate", "Vanilla", "Mango", "Spicy"].map((f) => (
                      <label key={f} className="flex items-center gap-3 py-2">
                        <Checkbox
                          checked={subFilters?.flavours?.includes(f)}
                          onCheckedChange={(v) =>
                            setSubFilters({
                              ...subFilters,
                              flavours: v ? [...subFilters.flavours, f] : subFilters.flavours.filter((x) => x !== f),
                            })
                          }
                        />
                        <span className="text-sm">{f}</span>
                      </label>
                    ))}
                  </div>
                )}
                {activeTab === "Customer Ratings" && (
                  <div className="space-y-1">
                    <label className="flex items-center gap-3 py-2">
                      <Checkbox
                        checked={filters?.rating === "4"}
                        onCheckedChange={(v) => onFilterChange?.({ ...filters, rating: v ? "4" : "all" })}
                      />
                      <span className="text-sm">4★ & above</span>
                    </label>
                    <label className="flex items-center gap-3 py-2">
                      <Checkbox
                        checked={filters?.rating === "3"}
                        onCheckedChange={(v) => onFilterChange?.({ ...filters, rating: v ? "3" : "all" })}
                      />
                      <span className="text-sm">3★ & above</span>
                    </label>
                    <label className="flex items-center gap-3 py-2">
                      <Checkbox
                        checked={filters?.availability === "in_stock"}
                        onCheckedChange={(v) => onFilterChange?.({ ...filters, availability: v ? "in_stock" : "all" })}
                      />
                      <span className="text-sm">In Stock Only</span>
                    </label>
                  </div>
                )}
                {activeTab === "Packaging Type" && (
                  <div className="space-y-1">
                    {["250 g", "500 g", "1 kg", "Pack"].map((pkg) => (
                      <label key={pkg} className="flex items-center gap-3 py-2">
                        <Checkbox
                          checked={subFilters?.packaging?.includes(pkg)}
                          onCheckedChange={(v) =>
                            setSubFilters({
                              ...subFilters,
                              packaging: v ? [...subFilters.packaging, pkg] : subFilters.packaging.filter((x) => x !== pkg),
                            })
                          }
                        />
                        <span className="text-sm">{pkg}</span>
                      </label>
                    ))}
                  </div>
                )}
                {activeTab === "Diet Type" && (
                  <div className="space-y-1">
                    {["Veg", "Non-Veg", "Vegan"].map((d) => (
                      <label key={d} className="flex items-center gap-3 py-2">
                        <Checkbox
                          checked={subFilters?.diet?.includes(d)}
                          onCheckedChange={(v) =>
                            setSubFilters({
                              ...subFilters,
                              diet: v ? [...subFilters.diet, d] : subFilters.diet.filter((x) => x !== d),
                            })
                          }
                        />
                        <span className="text-sm">{d}</span>
                      </label>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between p-4 border-t bg-white shrink-0">
          <button onClick={handleClearAll} className="text-sm font-semibold text-gray-400">
            Clear all
          </button>
          <Button
            onClick={() => onOpenChange(false)}
            className="bg-gray-200 text-gray-500 hover:bg-gray-300 rounded-xl px-8 font-semibold"
          >
            Apply Filters {activeCount > 0 ? `(${activeCount})` : ""}
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
