import React, { useState, useEffect, useRef, useMemo } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import FilterSheet from "@/components/shared/FilterSheet";

export default function EnhancedSearch({ 
  products, 
  onSearch, 
  filters, 
  onFilterChange,
  sortBy,
  onSortChange,
  categories = [],
  selectedCategory,
  onSelectCategory,
}) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [priceRange, setPriceRange] = useState([0, 1000]);
  const [isFocused, setIsFocused] = useState(false);
  const [typed, setTyped] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [subFilters, setSubFilters] = useState({ gourmet: false, brands: [], types: [], flavours: [], packaging: [], diet: [] });
  const searchRef = useRef(null);
  const debounceTimer = useRef(null);

  // Words for the typewriter placeholder — real product names first
  const typeWords = useMemo(() => {
    const fromProducts = (products || [])
      .map((p) => (p.name || "").split(/[\s(-]/)[0]?.toLowerCase())
      .filter((w) => w && w.length >= 3 && w.length <= 10);
    const unique = [...new Set(fromProducts)].slice(0, 8);
    return unique.length >= 3
      ? unique
      : ["kurkure", "maggi", "lays", "coke", "parle-g", "munch", "dairy milk", "red bull"];
  }, [products]);

  // Typewriter loop — runs only when the box is empty & unfocused
  useEffect(() => {
    if (query || isFocused) {
      setTyped("");
      return;
    }
    let wordIdx = 0;
    let charIdx = 0;
    let deleting = false;
    let timer;

    const tick = () => {
      const word = typeWords[wordIdx % typeWords.length];
      if (!deleting) {
        charIdx += 1;
        setTyped(word.slice(0, charIdx));
        if (charIdx >= word.length) {
          deleting = true;
          timer = setTimeout(tick, 1500); // hold full word
          return;
        }
        timer = setTimeout(tick, 75); // typing speed
      } else {
        charIdx -= 1;
        setTyped(word.slice(0, charIdx));
        if (charIdx <= 0) {
          deleting = false;
          wordIdx += 1;
          timer = setTimeout(tick, 350); // pause before next word
          return;
        }
        timer = setTimeout(tick, 35); // deleting speed
      }
    };

    timer = setTimeout(tick, 500); // initial delay
    return () => clearTimeout(timer);
  }, [query, isFocused, typeWords]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    // Debounced search with 300ms delay
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      if (query.trim().length > 1) {
        // Fuzzy search - match partial words
        const searchTerms = query.toLowerCase().split(" ");
        const matches = products.filter(product => {
          const productText = `${product.name} ${product.description || ""}`.toLowerCase();
          return searchTerms.some(term => productText.includes(term));
        }).slice(0, 5);
        setSuggestions(matches);
        setShowSuggestions(true);
        
        // Trigger parent search callback
        onSearch(query);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
        if (query.trim().length === 0) {
          onSearch("");
        }
      }
    }, 300);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [query, products, onSearch]);

  const handleSearch = (searchQuery) => {
    setQuery(searchQuery);
    setShowSuggestions(false);
    // Immediate search when Enter is pressed or suggestion clicked
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    onSearch(searchQuery);
  };

  const clearFilters = () => {
    setQuery("");
    setPriceRange([0, 1000]);
    onFilterChange({ availability: "all", rating: "all" });
    onSortChange("relevance");
    onSearch("");
  };

  const hasActiveFilters = query || 
    filters.availability !== "all" || 
    filters.rating !== "all" || 
    sortBy !== "relevance" ||
    priceRange[0] > 0 || 
    priceRange[1] < 1000 ||
    subFilters.gourmet ||
    subFilters.brands.length > 0 ||
    subFilters.types.length > 0 ||
    subFilters.flavours.length > 0 ||
    subFilters.packaging.length > 0 ||
    subFilters.diet.length > 0;

  return (
    <div className="space-y-2.5" ref={searchRef}>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-[18px] h-[18px]" />
          <Input
            placeholder={query ? "Search products..." : ""}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => {
              setIsFocused(true);
              suggestions.length > 0 && setShowSuggestions(true);
            }}
            onBlur={() => setIsFocused(false)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch(query)}
            className="pl-9 pr-9 h-11 w-full rounded-xl border-gray-200 bg-white text-sm shadow-[0_1px_4px_rgba(0,0,0,0.06)] placeholder:text-gray-400 focus-visible:ring-emerald-600/20"
          />
          {/* Animated typewriter placeholder */}
          {!query && (
            <div className="absolute left-9 top-1/2 -translate-y-1/2 flex items-center text-sm text-gray-400 pointer-events-none select-none max-w-[calc(100%-4.5rem)]">
              <span className="truncate">
                Search '{typed}
              </span>
              <span className="inline-block w-[2px] h-4 bg-[#0c831f] ml-[1px] animate-pulse flex-shrink-0" />
              <span className="flex-shrink-0">'</span>
            </div>
          )}
          {query && (
            <button
              onClick={() => {
                setQuery("");
                onSearch("");
              }}
              className="absolute right-2.5 top-1/2 transform -translate-y-1/2 w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Auto-suggestions */}
          <AnimatePresence>
            {showSuggestions && suggestions.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute top-full mt-2 w-full bg-white border border-gray-100 rounded-xl shadow-xl z-50 max-h-80 overflow-y-auto overflow-hidden"
              >
                {suggestions.map((product) => (
                  <Link
                    key={product.id}
                    to={createPageUrl("ProductDetails") + `?id=${product.id}`}
                    onClick={() => setShowSuggestions(false)}
                    className="flex items-center gap-3 p-2.5 hover:bg-gray-50 transition-colors"
                  >
                    <img
                      src={product.image_url || "https://images.unsplash.com/photo-1542838132-92c53300491e?w=60"}
                      alt={product.name}
                      className="w-11 h-11 object-cover rounded-lg bg-gray-50 border border-gray-100"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[13px] text-gray-900 truncate">{product.name}</p>
                      <p className="text-[13px] font-bold text-gray-900">₹{product.price}</p>
                    </div>
                  </Link>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Filters Button — opens shared bottom sheet */}
        <Button variant="outline" onClick={() => setFilterOpen(true)} className="h-11 px-3.5 rounded-xl border-gray-200 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
          <SlidersHorizontal className="w-[18px] h-[18px] text-gray-600" />
          {hasActiveFilters && (
            <span className="ml-1.5 w-2 h-2 rounded-full bg-[#0c831f]" />
          )}
        </Button>
        <FilterSheet
          open={filterOpen}
          onOpenChange={setFilterOpen}
          products={products}
          filters={filters}
          onFilterChange={onFilterChange}
          sortBy={sortBy}
          onSortChange={onSortChange}
          subFilters={subFilters}
          setSubFilters={setSubFilters}
          variant="shop"
          categories={categories}
          selectedCategory={selectedCategory}
          onSelectCategory={onSelectCategory}
          priceRange={priceRange}
          setPriceRange={setPriceRange}
        />
      </div>

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2">
          {query && (
            <Badge variant="secondary" className="gap-1">
              Search: {query}
              <button onClick={() => handleSearch("")} className="ml-1">
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}
          {sortBy !== "relevance" && (
            <Badge variant="secondary">
              Sort: {sortBy === "price_low" ? "Price ↑" : sortBy === "price_high" ? "Price ↓" : "Rating"}
            </Badge>
          )}
          {filters.availability !== "all" && (
            <Badge variant="secondary">In Stock Only</Badge>
          )}
          {filters.rating !== "all" && (
            <Badge variant="secondary">{filters.rating}★ & Above</Badge>
          )}
        </div>
      )}
    </div>
  );
}