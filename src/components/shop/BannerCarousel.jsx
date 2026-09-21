import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

// Light gradients cycled when no custom color is set — purple like your reference
const FALLBACK_GRADIENTS = [
  "linear-gradient(135deg, #c4b5fd 0%, #ede9fe 100%)",
  "linear-gradient(135deg, #86efac 0%, #ecfdf5 100%)",
  "linear-gradient(135deg, #fca5a5 0%, #fef2f2 100%)",
  "linear-gradient(135deg, #93c5fd 0%, #eff6ff 100%)",
  "linear-gradient(135deg, #fde68a 0%, #fffbeb 100%)",
];

export default function BannerCarousel() {
  const navigate = useNavigate();
  const scrollRef = useRef(null);
  const [banners, setBanners] = useState([]);
  const [active, setActive] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { loadBanners(); }, []);

  const loadBanners = async () => {
    try {
      const all = await base44.entities.Banner.filter({ is_active: true }, "display_order");
      const now = new Date();
      const filtered = all.filter((b) => {
        if (b.start_date && new Date(b.start_date) > now) return false;
        if (b.end_date && new Date(b.end_date) < now) return false;
        return true;
      });
      setBanners(filtered);
      if (filtered.length > 0) {
        filtered.forEach((b) =>
          base44.entities.Banner.update(b.id, { view_count: (b.view_count || 0) + 1 }).catch(() => {})
        );
      }
    } catch (e) {
      console.error("Error loading banners:", e);
    }
    setIsLoading(false);
  };

  // Track active card on scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || banners.length === 0) return;
    const onScroll = () => {
      const cardW = el.firstChild ? el.firstChild.offsetWidth + 12 : 300;
      const idx = Math.round(el.scrollLeft / cardW);
      setActive(Math.max(0, Math.min(idx, banners.length - 1)));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [banners.length]);

  // Auto-advance every 4s
  useEffect(() => {
    if (banners.length <= 1) return;
    const id = setInterval(() => {
      setActive((p) => {
        const n = (p + 1) % banners.length;
        const el = scrollRef.current;
        if (el && el.firstChild) {
          const cardW = el.firstChild.offsetWidth + 12;
          el.scrollTo({ left: n * cardW, behavior: "smooth" });
        }
        return n;
      });
    }, 4000);
    return () => clearInterval(id);
  }, [banners.length]);

  const handleClick = async (banner) => {
    try {
      await base44.entities.Banner.update(banner.id, {
        click_count: (banner.click_count || 0) + 1,
      });
    } catch {}
    // New promo columns (link_type/link_target) or legacy link_url
    if (banner.link_type === "internal" && banner.link_target) navigate(createPageUrl(banner.link_target));
    else if (banner.link_type === "category" && banner.link_target)
      navigate(createPageUrl("CategoryProducts") + `?id=${banner.link_target}`);
    else if (banner.link_type === "product" && banner.link_target)
      navigate(createPageUrl("ProductDetails") + `?id=${banner.link_target}`);
    else if (banner.link_type === "external" && banner.link_target) window.open(banner.link_target, "_blank");
    else if (banner.link_url) {
      // Legacy single link_url column — try to route sensibly
      if (String(banner.link_url).startsWith("http")) window.open(banner.link_url, "_blank");
      else navigate(createPageUrl(banner.link_url));
    }
  };

  const scrollTo = (idx) => {
    setActive(idx);
    const el = scrollRef.current;
    if (el && el.firstChild) {
      const cardW = el.firstChild.offsetWidth + 12;
      el.scrollTo({ left: idx * cardW, behavior: "smooth" });
    }
  };

  if (isLoading) {
    return (
      <div className="flex gap-3 overflow-hidden">
        {[0, 1].map((i) => (
          <div key={i} className="w-[84vw] max-w-[360px] md:max-w-[460px] h-[148px] md:h-[180px] rounded-[20px] bg-gray-100 animate-pulse flex-shrink-0" />
        ))}
      </div>
    );
  }

  if (banners.length === 0) return null;

  const hasMultiple = banners.length > 1;

  return (
    <div className="relative">
      {/* Scrollable cards */}
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide -mx-1 px-1 pb-1"
        style={{ scrollbarWidth: "none" }}
      >
        {banners.map((banner, idx) => {
          const gradient =
            banner.background_color && banner.background_color !== "#10b981"
              ? `linear-gradient(135deg, ${banner.background_color} 0%, ${banner.background_color}cc 100%)`
              : FALLBACK_GRADIENTS[idx % FALLBACK_GRADIENTS.length];

          // Title may contain newline — split into two lines like "Rich & Creamy\nDelight"
          const titleLines = (banner.title || "").split("\n");
          const cta = banner.cta_text || banner.cta || "SHOP NOW";
          const offer = banner.description || banner.subtitle || "";

          const hasImage = !!banner.image_url;

          return (
            <div
              key={banner.id}
              onClick={() => handleClick(banner)}
              className="relative flex-shrink-0 w-[84vw] max-w-[360px] md:max-w-[460px] lg:max-w-[520px] h-[180px] md:h-[200px] lg:h-[220px] rounded-[20px] md:rounded-[24px] overflow-hidden cursor-pointer snap-start"
              style={{ background: hasImage ? '#1a1a1a' : gradient }}
            >
              {/* Full-bleed image — exactly like your reference (Power Up Your Immunity) */}
              {hasImage && (
                <img
                  src={banner.image_url}
                  alt={banner.title}
                  className="absolute inset-0 w-full h-full object-cover"
                  loading="lazy"
                  onError={(e) => (e.target.style.display = "none")}
                />
              )}

              {/* Dark overlay for text readability — only when image covers background */}
              {hasImage && <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/25 to-transparent" />}

              {/* Content — fitted exactly like screenshot */}
              <div className="relative z-10 h-full flex flex-col justify-center p-5 md:p-6 pr-[38%] md:pr-[42%]">
                <h3 className={`text-[22px] md:text-[26px] lg:text-[28px] font-extrabold leading-[0.95] drop-shadow-sm ${hasImage ? 'text-white' : 'text-gray-900'}`}>
                  {titleLines.map((line, i) => (
                    <span key={i} className="block">
                      {line}
                    </span>
                  ))}
                </h3>
                {offer && (
                  <p className={`text-[12px] md:text-[13px] mt-1.5 leading-tight max-w-[220px] ${hasImage ? 'text-white/90' : 'text-gray-700'}`}>
                    {offer}
                  </p>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClick(banner);
                  }}
                  className={`mt-3.5 md:mt-4 text-[12px] md:text-[13px] font-extrabold tracking-wide px-5 md:px-6 py-2.5 md:py-3 rounded-full w-fit active:scale-95 transition-colors shadow-md ${hasImage ? 'bg-white text-[#111827] hover:bg-gray-100' : 'bg-[#111827] text-white hover:bg-black'}`}
                >
                  {cta}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination — single pill like 2/2 */}
      {hasMultiple && (
        <div className="flex items-center justify-center mt-2">
          <span className="bg-[#111827] text-white text-[11px] font-bold px-2.5 py-1 rounded-full">
            {active + 1}/{banners.length}
          </span>
        </div>
      )}
    </div>
  );
}
