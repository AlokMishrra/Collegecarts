import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { useSafeImageSrc } from "@/hooks/useSafeImageSrc";
import { useSEO } from "@/lib/useSEO";
import { ROUTE_META } from "@/route-meta";

const PASTELS = ["#e0f2fe", "#fef9c3", "#dcfce7", "#fce7f3", "#ede9fe", "#ffedd5"];

// Fallback images — covers both your DB names and the reference screenshot names
const FALLBACK_BY_NAME = {
  "Raita & Dahi": "https://images.unsplash.com/photo-1571212515416-fef01fc43637?w=200",
  "Roti & Paratha": "https://images.unsplash.com/photo-1595755430040-24e8a55d0a84?w=200",
  "Rice & Pulao": "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=200",
  "Sandwich": "https://images.unsplash.com/photo-1521390188846-e2a3a97453a0?w=200",
  "Beverages": "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=200",
  "Biryani": "https://images.unsplash.com/photo-1563379091339-03246963a96c?w=200",
  "Burgers": "https://images.unsplash.com/photo-1568909344668-6f14a07b56a0?w=200",
  // Square-grid references (second screenshot)
  "Vegetables & Fruits": "https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=200",
  "Atta, Rice & Dal": "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=200",
  "Oil, Ghee & Masala": "https://images.unsplash.com/photo-1587049352851-8fba90bae09a?w=200",
  "Dairy, Bread and Eggs": "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=200",
  "Bakery and Biscuits": "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=200",
  "Dry Fruits & Cereals": "https://images.unsplash.com/photo-1599490659213-e2b9527bd087?w=200",
  "Chicken, Meat & Fish": "https://images.unsplash.com/photo-1587593810167-a84920ea0781?w=200",
  "Kitchenware &": "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=200",
  "Chips & Namkeen": "https://images.unsplash.com/photo-1608198093002-ad4e005484ec?w=200",
  "Sweets & Chocolates": "https://images.unsplash.com/photo-1551024506-0bccd828d307?w=200",
  "Drinks & Juices": "https://images.unsplash.com/photo-1582738411706-bfc8e691d1c2?w=200",
  "Tea, Coffee": "https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=200",
};
const GENERIC_FALLBACK = "https://images.unsplash.com/photo-1542838132-92c53300491e?w=200";

function getFallbackImage(name) {
  if (!name) return GENERIC_FALLBACK;
  if (FALLBACK_BY_NAME[name]) return FALLBACK_BY_NAME[name];
  const lower = name.toLowerCase();
  // Keyword match for DB names that are substrings of the reference titles
  for (const [key, url] of Object.entries(FALLBACK_BY_NAME)) {
    const k = key.toLowerCase();
    if (lower.includes(k.split(",")[0].trim().split(" ")[0]) || k.includes(lower.split(" ")[0])) {
      // loose check to catch e.g., "Dairy & Eggs" vs "Dairy, Bread and Eggs"
      if (lower.includes("dairy") && k.includes("dairy")) return url;
      if (lower.includes("vegetable") || lower.includes("fruit")) return FALLBACK_BY_NAME["Vegetables & Fruits"];
      if (lower.includes("atta") || lower.includes("rice") || lower.includes("dal")) return FALLBACK_BY_NAME["Atta, Rice & Dal"];
      if (lower.includes("oil") || lower.includes("ghee") || lower.includes("masala")) return FALLBACK_BY_NAME["Oil, Ghee & Masala"];
      if (lower.includes("chips") || lower.includes("namkeen")) return FALLBACK_BY_NAME["Chips & Namkeen"];
      if (lower.includes("sweets") || lower.includes("chocolate")) return FALLBACK_BY_NAME["Sweets & Chocolates"];
      if (lower.includes("drinks") || lower.includes("juice")) return FALLBACK_BY_NAME["Drinks & Juices"];
      if (lower.includes("tea") || lower.includes("coffee")) return FALLBACK_BY_NAME["Tea, Coffee"];
      if (lower.includes("bakery") || lower.includes("biscuit")) return FALLBACK_BY_NAME["Bakery and Biscuits"];
      if (lower.includes("chicken") || lower.includes("meat") || lower.includes("fish")) return FALLBACK_BY_NAME["Chicken, Meat & Fish"];
      if (lower.includes("kitchen")) return FALLBACK_BY_NAME["Kitchenware &"];
      if (lower.includes("dry fruit") || lower.includes("cereal")) return FALLBACK_BY_NAME["Dry Fruits & Cereals"];
    }
  }
  if (lower.includes("vegetable") || lower.includes("fruit")) return FALLBACK_BY_NAME["Vegetables & Fruits"];
  if (lower.includes("atta") || lower.includes("rice") || lower.includes("dal")) return FALLBACK_BY_NAME["Atta, Rice & Dal"];
  if (lower.includes("oil") || lower.includes("ghee") || lower.includes("masala")) return FALLBACK_BY_NAME["Oil, Ghee & Masala"];
  if (lower.includes("dairy") || lower.includes("bread") || lower.includes("egg")) return FALLBACK_BY_NAME["Dairy, Bread and Eggs"];
  if (lower.includes("bakery") || lower.includes("biscuit")) return FALLBACK_BY_NAME["Bakery and Biscuits"];
  if (lower.includes("chicken") || lower.includes("meat") || lower.includes("fish")) return FALLBACK_BY_NAME["Chicken, Meat & Fish"];
  if (lower.includes("kitchen")) return FALLBACK_BY_NAME["Kitchenware &"];
  if (lower.includes("chips") || lower.includes("namkeen")) return FALLBACK_BY_NAME["Chips & Namkeen"];
  if (lower.includes("sweets") || lower.includes("chocolate")) return FALLBACK_BY_NAME["Sweets & Chocolates"];
  if (lower.includes("drinks") || lower.includes("juices")) return FALLBACK_BY_NAME["Drinks & Juices"];
  if (lower.includes("tea") || lower.includes("coffee") || lower.includes("milk")) return FALLBACK_BY_NAME["Tea, Coffee"];
  return GENERIC_FALLBACK;
}

function ArchCard({ category, index, onClick }) {
  const src = category.image_url || getFallbackImage(category.name);
  const safeSrc = useSafeImageSrc(src);
  const bg = PASTELS[index % PASTELS.length];
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center flex-shrink-0 w-[108px] md:w-[128px] lg:w-[140px] active:scale-95 transition-transform"
    >
      <div
        className="w-[108px] h-[108px] md:w-[128px] md:h-[128px] lg:w-[140px] lg:h-[140px] rounded-t-[54px] md:rounded-t-[64px] lg:rounded-t-[70px] rounded-b-2xl overflow-hidden flex items-end justify-center p-2 md:p-3"
        style={{ background: bg }}
      >
        {safeSrc ? (
          <img src={safeSrc} alt={category.name} className="w-[84px] h-[84px] md:w-[100px] md:h-[100px] object-contain" loading="lazy" />
        ) : (
          <span className="text-2xl mb-4">🛒</span>
        )}
      </div>
      <span className="text-[12px] md:text-[13px] font-bold text-gray-800 text-center leading-tight mt-2 line-clamp-2 min-h-[32px] md:min-h-[36px] px-1">
        {category.name}
      </span>
    </button>
  );
}

function SquareCard({ category, onClick }) {
  const src = category.image_url || getFallbackImage(category.name);
  const safeSrc = useSafeImageSrc(src);
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center active:scale-98 transition-transform"
    >
      <div className="w-full aspect-square rounded-2xl bg-[#eaf5f7] overflow-hidden flex items-center justify-center p-3 md:p-4">
        {safeSrc ? (
          <img src={safeSrc} alt={category.name} className="w-full h-full object-contain" loading="lazy" />
        ) : (
          <span className="text-2xl">🛒</span>
        )}
      </div>
      <span className="text-[12px] md:text-[13px] font-extrabold text-gray-800 text-center leading-tight mt-2 line-clamp-2 min-h-[32px] px-0.5">
        {category.name}
      </span>
    </button>
  );
}

export default function Categories() {
  useSEO(ROUTE_META["/Categories"]);
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const { products: allProducts, categories: rawCats } = await (await import("@/utils/shopCache")).deduplicatedFetch();
      let cats = Array.isArray(rawCats) ? rawCats : [];
      // Fallback: derive categories from products if none
      if (cats.length === 0) {
        const map = {};
        (allProducts || []).forEach((p) => {
          if (p.category_id && p.category_name && !map[p.category_id]) {
            map[p.category_id] = { id: p.category_id, name: p.category_name, image_url: p.category_image || null };
          }
        });
        cats = Object.values(map);
      }
      // Enrich missing images from sample product
      cats = cats.map((cat) => {
        if (cat.image_url) return cat;
        const sample = (allProducts || []).find((p) => p.category_id === cat.id && p.image_url);
        return sample ? { ...cat, image_url: sample.image_url } : cat;
      });
      cats.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
      setCategories(cats);
    } catch (e) {
      console.error("Failed to load categories", e);
    }
    setIsLoading(false);
  };

  const handleSelect = (cat) => {
    navigate(createPageUrl(`CategoryProducts?categoryId=${cat.id}&categoryName=${encodeURIComponent(cat.name)}`));
  };

  // Category-wise sections matching your references: arch for Store/Fresh, square grid for Grocery/Snacks
  const GROUP_DEFS = [
    { title: "Shop by Store", card: "arch", test: (n) => /BetterBite|Snacks & Chips|Treats Corner|Extra Ess/i.test(n) },
    { title: "Fresh items", card: "arch", test: (n) => /Beverages|Biryani|Burgers|Chaat/i.test(n) },
    { title: "Grocery & Kitchen", card: "square", test: (n) => /Vegetables|Fruits|Atta|Rice|Dal|Oil|Ghee|Masala|Dairy|Bread|Eggs|Bakery|Biscuits|Dry Fruits|Cereals|Chicken|Meat|Fish|Kitchenware|Raita|Roti|Pulao|Sandwich/i.test(n) },
    { title: "Snacks & Drinks", card: "square", test: (n) => /Chips|Namkeen|Sweets|Chocolates|Drinks|Juices|Tea|Coffee|Milk|Cold Drinks|Noodles|Feminine|Chinese/i.test(n) },
  ];

  const groups = [];
  if (categories.length > 0) {
    const buckets = GROUP_DEFS.map((g) => ({ ...g, items: [] }));
    const more = { title: "More Categories", card: "square", items: [] };
    categories.forEach((cat) => {
      const hit = buckets.find((g) => g.test(cat.name));
      if (hit) hit.items.push(cat);
      else more.items.push(cat);
    });
    buckets.forEach((g) => { if (g.items.length > 0) groups.push(g); });
    if (more.items.length > 0) groups.push(more);
    // Fallback: if our test missed almost everything (e.g., many custom names), distribute evenly so nothing hidden
    if (groups.every((g) => g.items.length === 0) || groups.reduce((s, g) => s + g.items.length, 0) < categories.length / 2) {
      groups.length = 0;
      const per = Math.ceil(categories.length / 4);
      const titles = ["Shop by Store", "Fresh items", "Grocery & Kitchen", "Snacks & Drinks"];
      for (let i = 0; i < 4; i++) {
        const slice = categories.slice(i * per, (i + 1) * per);
        if (slice.length > 0) groups.push({ title: titles[i], card: i < 2 ? "arch" : "square", items: slice });
      }
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white pb-20">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="h-6 w-32 bg-gray-100 rounded animate-pulse" />
          <div className="w-6 h-6 bg-gray-100 rounded animate-pulse" />
        </div>
        {[0, 1, 2].map((g) => (
          <div key={g} className="px-4 mt-6">
            <div className="h-4 w-32 bg-gray-100 rounded animate-pulse mb-3" />
            <div className="flex gap-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="w-[108px] h-[140px] bg-gray-100 rounded-2xl animate-pulse flex-shrink-0" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-20">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 sticky top-0 bg-white z-10">
        <h1 className="text-[22px] font-extrabold text-gray-900 tracking-tight">Categories</h1>
        <button
          onClick={() => navigate(createPageUrl("Shop"))}
          className="w-9 h-9 flex items-center justify-center active:scale-90"
          aria-label="Search"
        >
          <Search className="w-6 h-6 text-gray-800" strokeWidth={2.2} />
        </button>
      </div>

      {/* Intro copy */}
      <div className="px-4 pb-1">
        <p className="text-[13px] leading-relaxed text-gray-600">
          Every product on CollegeCart is grouped so you can find it in a few taps. Browse the sections below to move from daily groceries and fresh items to snacks, drinks and store favourites, then tap any card to open the full category, check live stock, and add items to your cart for delivery straight to your hostel door.
        </p>
        <p className="text-[13px] leading-relaxed text-gray-600 mt-2">
          Use the search button at the top right when you already know what you want — it jumps straight to the product list. Otherwise work through the sections in order: fresh and everyday groceries first, snacks and drinks next, then anything from More Categories last, so the essentials land in your cart before the treats and the impulse buys.
        </p>
      </div>

      {groups.map((group) => (
        <div key={group.title} className="mt-6">
          <h2 className="text-[15px] md:text-[16px] font-bold text-gray-900 px-4 mb-3">{group.title}</h2>
          {group.card === "arch" ? (
            <div className="flex gap-3 overflow-x-auto scrollbar-hide px-4 pb-2 snap-x snap-mandatory md:grid md:grid-cols-4 lg:grid-cols-6 md:gap-4 md:overflow-visible md:snap-none">
              {group.items.map((cat, idx) => (
                <div key={cat.id} className="snap-start">
                  <ArchCard category={cat} index={idx} onClick={() => handleSelect(cat)} />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-4 md:grid-cols-4 lg:grid-cols-6 gap-2 md:gap-3 px-4">
              {group.items.map((cat) => (
                <SquareCard key={cat.id} category={cat} onClick={() => handleSelect(cat)} />
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Per-group descriptions */}
      <section className="px-4 mt-9">
        <h2 className="text-[15px] md:text-[16px] font-bold text-gray-900 mb-3">What You'll Find in Each Section</h2>

        <h3 className="text-[13px] font-bold text-[#0c831f] mb-1">Shop by Store</h3>
        <p className="text-[13px] leading-relaxed text-gray-600 mb-3">
          Curated bundles and store-branded packs such as BetterBite, Snacks &amp; Chips, Treats Corner and Extra Essentials collect the most-ordered hostel favourites in one row, so a full evening snack run takes a single tap.
        </p>

        <h3 className="text-[13px] font-bold text-[#0c831f] mb-1">Fresh items</h3>
        <p className="text-[13px] leading-relaxed text-gray-600 mb-3">
          Quick options like beverages, biryani, burgers and chaat for the hours when the mess is closed or you simply want something different in the middle of a study session.
        </p>

        <h3 className="text-[13px] font-bold text-[#0c831f] mb-1">Grocery &amp; Kitchen</h3>
        <p className="text-[13px] leading-relaxed text-gray-600 mb-3">
          The backbone of the list: vegetables and fruits, atta, rice and dal, oil, ghee and masala, dairy with bread and eggs, bakery and biscuits, dry fruits and cereals, chicken, meat and fish, plus kitchenware and ready sides such as roti, paratha, raita, pulao and sandwich.
        </p>

        <h3 className="text-[13px] font-bold text-[#0c831f] mb-1">Snacks &amp; Drinks</h3>
        <p className="text-[13px] leading-relaxed text-gray-600 mb-3">
          Chips and namkeen, sweets and chocolates, cold drinks and juices, tea and coffee, milk drinks, noodles and instant food, alongside personal and feminine care essentials that hostel rooms regularly run out of.
        </p>

        <h3 className="text-[13px] font-bold text-[#0c831f] mb-1">More Categories</h3>
        <p className="text-[13px] leading-relaxed text-gray-600 mb-1">
          Anything outside the four main groups lives here — stationery, medicines and the small household items that are easy to forget until you need them.
        </p>
      </section>

      {/* Delivery & pricing */}
      <section className="mx-4 mt-6 mb-4 bg-[#FFFBF5] border border-emerald-200 rounded-2xl p-5">
        <h2 className="text-[15px] md:text-[16px] font-bold text-[#0c831f] mb-2">Delivery and Pricing</h2>
        <p className="text-[13px] leading-relaxed text-gray-700 mb-3">
          Categories only help if the items are actually in stock. Every category is filled from our own dark store near campus, restocked daily, and priced at MRP or below it. There is no minimum order, so a single pack of biscuits counts as a complete order, and delivery to your hostel door is free above ₹500 — a ₹10–₹20 fee applies on smaller orders depending on your hostel location.
        </p>
        <ul className="list-disc pl-5 text-[13px] leading-relaxed text-gray-700 space-y-1">
          <li>Most orders arrive at the hostel door in about 10 minutes.</li>
          <li>Stock and prices update live as inventory moves through the dark store.</li>
          <li>Missing, damaged or wrong items are refunded to the original payment method.</li>
        </ul>
      </section>

      {categories.length === 0 && (
        <div className="text-center py-16 text-gray-500 text-sm">No categories found</div>
      )}
    </div>
  );
}
