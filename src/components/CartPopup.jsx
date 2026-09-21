import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Minus, ShoppingBag, ChevronRight } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { notifyCartUpdate } from "@/utils/cartEvents";
import { toast } from "sonner";

const IMG_CACHE = new Map();

/** Friendly delivery-buddy face (inline SVG — no network needed). */
function BuddyFace() {
  return (
    <svg viewBox="0 0 44 44" className="w-full h-full" aria-hidden="true">
      <circle cx="22" cy="22" r="22" fill="#e8f6ea" />
      <path d="M7 41c1.5-8.5 7.5-13 15-13s13.5 4.5 15 13v1H7v-1z" fill="#0c831f" />
      <path d="M7 41c1.5-8.5 7.5-13 15-13v14H7v-1z" fill="#0a6b19" opacity="0.35" />
      <circle cx="22" cy="17.5" r="9" fill="#f3c297" />
      <path
        d="M13.2 16.5c-.4-5.5 3.6-9.7 8.8-9.7s9.2 4.2 8.8 9.7c-1.4-2.6-3.4-3.6-5.2-3.9.3 1 .4 2 .4 3-1.8-1.4-4-2-6.6-1.7-1.9.2-4.6 1-6.2 2.6z"
        fill="#3a2e2a"
      />
      <circle cx="18.4" cy="18.2" r="1.4" fill="#262626" />
      <circle cx="25.6" cy="18.2" r="1.4" fill="#262626" />
      <circle cx="18.9" cy="17.7" r="0.45" fill="#fff" />
      <circle cx="26.1" cy="17.7" r="0.45" fill="#fff" />
      <circle cx="15.8" cy="21.4" r="1.6" fill="#f0977f" opacity="0.55" />
      <circle cx="28.2" cy="21.4" r="1.6" fill="#f0977f" opacity="0.55" />
      <path
        d="M18.6 22.6c1 1.5 2.2 2.2 3.4 2.2s2.4-.7 3.4-2.2"
        stroke="#262626"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

const BAD_IMG_HOSTS = ['mydukaan.io'];

function probeUrl(url) {
  if (!url) return Promise.resolve("bad");
  if (BAD_IMG_HOSTS.some(h => url.includes(h))) {
    IMG_CACHE.set(url, "bad");
    return Promise.resolve("bad");
  }
  const cached = IMG_CACHE.get(url);
  if (cached) return Promise.resolve(cached);
  return new Promise((resolve) => {
    const img = new Image();
    const done = (v) => { IMG_CACHE.set(url, v); resolve(v); };
    img.onload = () => done("ok");
    img.onerror = () => done("bad");
    img.src = url;
  });
}

function CartThumb({ src, alt, size = 42, badge }) {
  const [status, setStatus] = useState(() => {
    if (!src) return "bad";
    const c = IMG_CACHE.get(src);
    return c ?? "probing";
  });

  useEffect(() => {
    if (!src) { setStatus("bad"); return; }
    const c = IMG_CACHE.get(src);
    if (c) { setStatus(c); return; }
    probeUrl(src).then(setStatus);
  }, [src]);

  return (
    <div
      className="rounded-full bg-white overflow-hidden flex-shrink-0 relative border-[2.5px] border-[#0c831f]"
      style={{ width: size, height: size, marginLeft: -10 }}
    >
      {status === "ok" ? (
        <img src={src} alt={alt} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full bg-gray-100 flex items-center justify-center text-sm">
          🛒
        </div>
      )}
      {badge != null && (
        <div className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-[#facc15] text-[9px] font-extrabold text-gray-900 rounded-full flex items-center justify-center leading-none shadow-sm">
          {badge}
        </div>
      )}
    </div>
  );
}

export default function CartPopup() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [cartItems, setCartItems] = useState([]);
  const [products, setProducts] = useState({});
  const [cartCount, setCartCount] = useState(0);
  const [user, setUser] = useState(null);
  const [settings, setSettings] = useState(null);
  const [stripDismissed, setStripDismissed] = useState(
    () => sessionStorage.getItem("cc-hide-fd-strip") === "1"
  );
  const panelRef = useRef(null);

  const isOnCartPage = location.pathname === "/Cart";

  const loadSettings = useCallback(async () => {
    if (settings) return;
    const allSettings = await base44.entities.Settings.list().catch(() => []);
    if (allSettings.length > 0) setSettings(allSettings[0]);
  }, [settings]);

  const loadCartData = useCallback(async (userId) => {
    try {
      const items = await base44.entities.CartItem.filter({ user_id: userId });
      setCartItems(items);
      const count = items.reduce((sum, item) => sum + (item.quantity || 1), 0);
      setCartCount(count);

      const productIds = [...new Set(items.map((item) => item.product_id))].slice(0, 20);
      if (productIds.length > 0) {
        const productPromises = productIds.map((id) =>
          base44.entities.Product.filter({ id }).then((r) => r[0]).catch(() => null)
        );
        const productsData = await Promise.all(productPromises);
        const productsMap = {};
        productsData.forEach((p) => { if (p) productsMap[p.id] = p; });
        setProducts(productsMap);
      }

      loadSettings();
    } catch (error) {
      console.error("Error loading cart:", error);
    }
  }, [loadSettings]);

  const loadUser = useCallback(async () => {
    try {
      const { data: { user: authUser } } = await (await import("@/lib/supabase")).supabase.auth.getUser();
      if (authUser) {
        setUser({ id: authUser.id });
        loadCartData(authUser.id);
      }
    } catch { setUser(null); }
  }, [loadCartData]);

  useEffect(() => { loadUser(); }, [loadUser]);

  // Load threshold even for guests so the empty-cart strip shows the right number
  useEffect(() => { loadSettings(); }, [loadSettings]);

  useEffect(() => {
    const handler = () => { if (user?.id) loadCartData(user.id); };
    window.addEventListener("cartUpdated", handler);
    return () => window.removeEventListener("cartUpdated", handler);
  }, [user, loadCartData]);

  useEffect(() => {
    if (isOnCartPage) setIsOpen(false);
  }, [isOnCartPage]);

  const getPrice = useCallback((product) => {
    if (!product) return 0;
    return product.discounted_price || product.price || 0;
  }, []);

  const getOriginalPrice = useCallback((product) => {
    if (!product) return 0;
    return product.price || 0;
  }, []);

  const getTotal = useCallback(() => {
    return cartItems.reduce((sum, item) => {
      const product = products[item.product_id];
      return sum + getPrice(product) * (item.quantity || 1);
    }, 0);
  }, [cartItems, products, getPrice]);

  const getTotalSavings = useCallback(() => {
    return cartItems.reduce((sum, item) => {
      const product = products[item.product_id];
      return sum + (getOriginalPrice(product) - getPrice(product)) * (item.quantity || 1);
    }, 0);
  }, [cartItems, products, getOriginalPrice, getPrice]);

  const updateQuantity = useCallback(async (itemId, newQty) => {
    if (!user?.id) return;
    if (newQty <= 0) {
      setCartItems((prev) => prev.filter((i) => i.id !== itemId));
      notifyCartUpdate();
      try {
        await base44.entities.CartItem.delete(itemId);
        toast.success("Item removed");
      } catch { if (user?.id) loadCartData(user.id); }
    } else {
      setCartItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, quantity: newQty } : i)));
      notifyCartUpdate();
      try {
        await base44.entities.CartItem.update(itemId, { quantity: newQty });
      } catch { if (user?.id) loadCartData(user.id); }
    }
  }, [user, loadCartData]);

  if (isOnCartPage) return null;
  if (cartCount === 0 && stripDismissed) return null;

  const freeDeliveryAbove = settings?.free_delivery_above || 149;
  const isEmpty = cartCount === 0;

  const total = getTotal();
  const savings = getTotalSavings();
  const imgItems = cartItems.slice(0, 4);

  // Free delivery progress
  const amountNeeded = Math.max(0, freeDeliveryAbove - total);
  const isFreeDelivery = total >= freeDeliveryAbove;

  const spring = { type: "spring", damping: 25, stiffness: 300 };

  return (
    <>
      {/* ═══ Floating bottom bar — morphs between empty strip ↔ cart bar ═══ */}
      <AnimatePresence mode="wait" initial={false}>
        {isEmpty ? (
          <motion.div
            key="empty-strip"
            initial={{ y: 40, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 30, opacity: 0, scale: 0.97 }}
            transition={spring}
            className="fixed bottom-[72px] left-3 right-3 z-[9997] lg:hidden"
          >
            <div className="bg-white rounded-full shadow-lg shadow-black/10 border border-gray-100 flex items-center gap-3 pl-1.5 pr-2 py-1.5">
              {/* Gentle idle bob so it feels alive */}
              <motion.div
                className="w-11 h-11 rounded-full overflow-hidden flex-shrink-0"
                animate={{ y: [0, -3, 0] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
              >
                <BuddyFace />
              </motion.div>
              <p className="text-[13px] text-gray-900 tracking-tight leading-snug flex-1 min-w-0">
                <span className="font-extrabold">FREE DELIVERY</span>{" "}
                <span className="font-medium">on orders above ₹{freeDeliveryAbove}</span>
              </p>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  sessionStorage.setItem("cc-hide-fd-strip", "1");
                  setStripDismissed(true);
                }}
                className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 active:bg-gray-200"
                aria-label="Dismiss"
              >
                <X className="w-3.5 h-3.5 text-gray-500" strokeWidth={2.5} />
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="cart-bar"
            initial={{ y: 80, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 60, opacity: 0, scale: 0.97 }}
            transition={spring}
            className="fixed bottom-[72px] left-3 right-3 z-[9997] lg:hidden"
          >
          <div
          className="rounded-2xl shadow-2xl shadow-emerald-900/40 cursor-pointer overflow-hidden"
          onClick={() => setIsOpen(true)}
        >
          {/* Main row */}
          <div className="flex items-center justify-between px-3 py-2.5 bg-[#0c831f]">
            {/* Left: overlapping product thumbnails */}
            <div className="flex items-center flex-shrink-0">
              {imgItems.map((item, i) => {
                const product = products[item.product_id];
                const img = product?.image_url || product?.image || null;
                const isLast = i === imgItems.length - 1;
                return (
                  <CartThumb
                    key={item.id || i}
                    src={img}
                    alt={product?.name || "item"}
                    size={42}
                    badge={isLast ? cartCount : null}
                  />
                );
              })}
            </div>

            {/* Center: text */}
            <div className="flex flex-col ml-2 min-w-0">
              <span className="text-white text-sm font-bold leading-tight whitespace-nowrap">
                View cart
              </span>
              <span className="text-emerald-100 text-[11px] leading-tight whitespace-nowrap">
                {cartCount} item{cartCount !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Right: arrow */}
            <div className="ml-auto bg-white/25 rounded-full p-1.5 flex-shrink-0">
              <ChevronRight className="w-5 h-5 text-white" />
            </div>
          </div>

          {/* Free delivery strip */}
          <div className={`px-4 py-2 ${isFreeDelivery ? "bg-[#23962a]" : "bg-[#1a6b1f]"}`}>
            <p className={`text-[11px] font-semibold leading-tight text-center ${isFreeDelivery ? "text-white" : "text-yellow-300"}`}>
              {isFreeDelivery
                ? "You've unlocked free delivery!"
                : `Add items worth ₹${amountNeeded.toFixed(0)} more for free delivery`}
              </p>
            </div>
          </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ Backdrop + Slide-up Panel ═══ */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/50 z-[9998] lg:hidden"
              onClick={() => setIsOpen(false)}
            />

            <motion.div
              ref={panelRef}
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 350 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={0.2}
              onDragEnd={(_, info) => {
                if (info.offset.y > 100 || info.velocity.y > 500) setIsOpen(false);
              }}
              className="fixed inset-x-0 bottom-0 z-[9999] lg:hidden bg-white rounded-t-[20px] max-h-[85vh] flex flex-col shadow-[0_-8px_30px_rgba(0,0,0,0.15)]"
            >
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-10 h-1 bg-gray-300 rounded-full" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-5 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-[#0c831f] flex items-center justify-center">
                    <ShoppingBag className="w-5 h-5 text-white" strokeWidth={2.2} />
                  </div>
                  <div>
                    <h2 className="text-[17px] font-bold text-gray-900 leading-tight">My Cart</h2>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {cartCount} item{cartCount !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
                >
                  <X className="w-4 h-4 text-gray-500" strokeWidth={2.5} />
                </button>
              </div>

              {/* Thin divider */}
              <div className="h-px bg-gray-100 mx-5" />

              {/* Cart Items */}
              <div className="flex-1 overflow-y-auto px-5 pt-3 pb-2">
                {cartItems.map((item, idx) => {
                  const product = products[item.product_id];
                  if (!product) return null;
                  const price = getPrice(product);
                  const originalPrice = getOriginalPrice(product);
                  const hasDiscount = originalPrice > price;
                  const imgSrc = product.image_url || product.image || null;
                  const isLast = idx === cartItems.length - 1;

                  return (
                    <div
                      key={item.id}
                      className={`flex items-center gap-3.5 py-4 ${!isLast ? "border-b border-gray-100" : ""}`}
                    >
                      {/* Image */}
                      <div className="w-[72px] h-[72px] rounded-2xl bg-gray-50 border border-gray-100 flex-shrink-0 overflow-hidden flex items-center justify-center">
                        {imgSrc ? (
                          <img
                            src={imgSrc}
                            alt={product.name}
                            className="w-full h-full object-cover"
                            onError={(e) => { e.target.style.display = "none"; }}
                          />
                        ) : (
                          <span className="text-2xl">🛒</span>
                        )}
                      </div>

                      {/* Info + Controls row */}
                      <div className="flex-1 min-w-0 flex flex-col justify-between h-[72px]">
                        <div>
                          <h3 className="text-[13px] font-semibold text-gray-900 truncate leading-tight">
                            {product.name}
                          </h3>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-[13px] font-bold text-gray-900">₹{price}</span>
                            {hasDiscount && (
                              <span className="text-[11px] text-gray-400 line-through">₹{originalPrice}</span>
                            )}
                            {hasDiscount && (
                              <span className="text-[10px] font-bold text-[#0c831f] bg-emerald-50 px-1.5 py-0.5 rounded-md">
                                {Math.round(((originalPrice - price) / originalPrice) * 100)}% OFF
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Quantity Controls */}
                      <div className="flex items-center border border-[#0c831f] rounded-xl overflow-hidden bg-white flex-shrink-0">
                        <button
                          onClick={(e) => { e.stopPropagation(); updateQuantity(item.id, (item.quantity || 1) - 1); }}
                          className="w-[34px] h-[34px] flex items-center justify-center text-[#0c831f] hover:bg-emerald-50 transition-colors active:bg-emerald-100"
                        >
                          <Minus className="w-3.5 h-3.5" strokeWidth={2.5} />
                        </button>
                        <span className="w-[34px] h-[34px] flex items-center justify-center text-[13px] font-bold text-[#0c831f] select-none">
                          {item.quantity || 1}
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); updateQuantity(item.id, (item.quantity || 1) + 1); }}
                          className="w-[34px] h-[34px] flex items-center justify-center bg-[#0c831f] text-white hover:bg-[#0a6b19] transition-colors active:bg-[#085c15]"
                        >
                          <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="border-t border-gray-100 bg-white px-5 pt-3 pb-5 space-y-3">
                {/* Savings */}
                {savings > 0 && (
                  <div className="flex items-center justify-center gap-1.5 bg-emerald-50 rounded-xl py-2.5">
                    <span className="text-[12px] text-[#0c831f] font-semibold">
                      ₹{savings.toFixed(0)} saved, more coming up!
                    </span>
                  </div>
                )}

                {/* Items + Total */}
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 text-sm font-medium">
                    {cartCount} item{cartCount !== 1 ? "s" : ""}
                  </span>
                  <span className="text-gray-900 font-bold text-lg">
                    ₹{total.toFixed(2)}
                  </span>
                </div>

                {/* CTA */}
                <button
                  onClick={() => { setIsOpen(false); navigate("/Cart"); }}
                  className="w-full bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold text-[15px] py-3.5 rounded-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25"
                >
                  Go to Cart
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
