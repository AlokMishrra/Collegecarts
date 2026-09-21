import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Timer } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

/**
 * PromoPopup — Mobile-only, admin-managed, CollegeCart-themed.
 * Replica of Swiggy One popup screenshot but in CollegeCart green theme (#0c831f).
 * - Cream background #FFFBF5
 * - Green LIMITED TIME ONLY badge
 * - FREE DELIVERIES WITH One (green) + big title + subtitle
 * - Center image (admin upload) with green circular arrow backdrop
 * - Green CTA pill
 * Shows only on mobile (<768px), once per session if configured.
 */
export default function PromoPopup() {
  const [popup, setPopup] = useState(null);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const all = await base44.entities.PromoPopup.filter({ is_active: true }, "display_order");
        const now = new Date();
        const active = (all || []).find((p) => {
          if (p.start_date && new Date(p.start_date) > now) return false;
          if (p.end_date && new Date(p.end_date) < now) return false;
          return true;
        });
        if (!active || cancelled) return;

        // once per session logic
        if (active.once_per_session) {
          const key = `cc-promo-popup-seen-${active.id}`;
          if (sessionStorage.getItem(key)) return;
        }

        // mobile only — don't show on desktop at all
        if (window.innerWidth >= 768) return;

        setPopup(active);
        // delay like Swiggy (feels native)
        const t = setTimeout(() => {
          if (!cancelled) {
            setOpen(true);
            // increment view_count fire-and-forget
            base44.entities.PromoPopup.update(active.id, {
              view_count: (active.view_count || 0) + 1,
            }).catch(() => {});
          }
        }, 1200);
        return () => clearTimeout(t);
      } catch (e) {
        // table may not exist yet — silently ignore
        console.debug("[PromoPopup] load failed (table may not exist yet)", e?.message);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleClose = () => {
    if (popup?.once_per_session) {
      try {
        sessionStorage.setItem(`cc-promo-popup-seen-${popup.id}`, "1");
      } catch {}
    }
    setOpen(false);
  };

  const handleCTA = async () => {
    if (!popup) return;
    // track click
    base44.entities.PromoPopup.update(popup.id, {
      click_count: (popup.click_count || 0) + 1,
    }).catch(() => {});
    handleClose();

    const type = popup.cta_link_type || "internal";
    const target = popup.cta_link_target || "";

    if (type === "external" && target) {
      window.open(target, "_blank");
      return;
    }
    if (type === "category" && target) {
      navigate(`/CategoryProducts?category=${encodeURIComponent(target)}`);
      return;
    }
    if (type === "product" && target) {
      navigate(`/ProductDetails?product=${encodeURIComponent(target)}`);
      return;
    }
    if (type === "internal" && target) {
      // try to resolve as page name
      try {
        navigate(createPageUrl(target));
      } catch {
        navigate(`/${target}`);
      }
      return;
    }
    // default: go to shop
    navigate(createPageUrl("Shop"));
  };

  if (!popup) return null;

  const bg = popup.background_color || "#FFFBF5";
  const badgeText = popup.badge_text || "LIMITED TIME ONLY";
  const titleSmall = popup.title_small || "FREE DELIVERIES WITH";
  const titleHighlight = popup.title_highlight || "One";
  const title = popup.title || "At just ₹49 for 3+3 months";
  const subtitle = popup.subtitle || "on both Shop & Meals.";
  const ctaText = popup.cta_text || "Claim Now";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center md:hidden"
          aria-modal="true"
          role="dialog"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
          />

          {/* Card */}
          <motion.div
            initial={{ y: 80, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", damping: 26, stiffness: 320 }}
            className="relative w-[92%] max-w-[360px] max-h-[86vh] rounded-[28px] overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.25)] mb-6 sm:mb-0"
            style={{ background: bg }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close */}
            <button
              onClick={handleClose}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/10 hover:bg-black/15 flex items-center justify-center z-10 transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4 text-gray-700" strokeWidth={2.5} />
            </button>

            {/* Top badge — CollegeCart green */}
            <div className="flex justify-center pt-0">
              <div className="inline-flex items-center gap-1.5 bg-[#0c831f] text-white text-[11px] font-extrabold tracking-[0.14em] px-5 py-2 rounded-b-[14px] shadow-sm">
                <Timer className="w-3.5 h-3.5" strokeWidth={2.5} />
                {badgeText}
              </div>
            </div>

            {/* Content */}
            <div className="px-6 pt-5 pb-6 text-center">
              {/* Small headline */}
              <p className="text-[13px] font-extrabold tracking-[0.12em] leading-none">
                <span className="text-[#0c831f]">{titleSmall}</span>{" "}
                <span className="bg-gradient-to-r from-[#0c831f] to-[#14a336] bg-clip-text text-transparent">
                  {titleHighlight}
                </span>
              </p>

              {/* Big title */}
              <h2 className="mt-3 text-[22px] font-extrabold leading-[1.15] text-[#111827] whitespace-pre-wrap">
                {title}
              </h2>
              {subtitle && (
                <p className="mt-1 text-[16px] font-semibold text-[#374151] leading-tight">
                  {subtitle}
                </p>
              )}

              {/* Image area */}
              <div className="relative mt-4 flex justify-center items-center">
                {/* Green circular arrow backdrop */}
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[200px] h-[200px] rounded-full flex items-center justify-center pointer-events-none">
                  <div className="w-[160px] h-[160px] rounded-full border-[14px] border-[#0c831f]/90 border-l-transparent rotate-[-20deg] opacity-90" />
                  {/* arrow head */}
                  <div className="absolute top-[18px] right-[38px] w-0 h-0 border-l-[14px] border-l-[#0c831f] border-t-[10px] border-t-transparent border-b-[10px] border-b-transparent rotate-[-10deg]" />
                </div>

                {/* Confetti dots */}
                <span className="absolute left-2 top-6 w-2 h-2 bg-amber-400 rounded-full rotate-12" />
                <span className="absolute right-6 top-3 w-1.5 h-1.5 bg-[#0c831f] rounded-full" />
                <span className="absolute left-6 bottom-10 w-2 h-1 bg-amber-300 rounded-full rotate-45" />
                <span className="absolute right-2 bottom-6 w-2.5 h-1 bg-amber-400 rounded-full -rotate-12" />

                {/* Actual image */}
                {popup.image_url ? (
                  <img
                    src={popup.image_url}
                    alt={title}
                    className="relative w-[220px] h-[190px] object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.12)]"
                    loading="eager"
                  />
                ) : (
                  /* Fallback — scooter illustration using emoji + styled div (no external asset needed) */
                  <div className="relative w-[220px] h-[190px] flex flex-col items-center justify-end pb-2">
                    <div className="text-[110px] leading-none select-none drop-shadow-[0_10px_20px_rgba(0,0,0,0.12)]">
                      🛵
                    </div>
                    <div className="mt-1 text-[11px] font-bold tracking-widest text-[#0c831f]/70">
                      COLLEGE CART
                    </div>
                  </div>
                )}
              </div>

              {/* CTA */}
              <button
                onClick={handleCTA}
                className="mt-5 w-full h-[52px] rounded-full bg-[#0c831f] hover:bg-[#0a6d1a] active:bg-[#095a16] text-white text-[16px] font-bold tracking-wide shadow-[0_6px_16px_rgba(12,131,31,0.35)] transition-colors"
              >
                {ctaText}
              </button>

              {/* Home indicator (iOS style) */}
              <div className="mt-4 flex justify-center">
                <div className="w-[120px] h-[4px] rounded-full bg-black/15" />
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
