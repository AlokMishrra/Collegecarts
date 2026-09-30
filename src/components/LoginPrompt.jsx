import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { X, LogIn, ShoppingBag, Clock } from "lucide-react";

/**
 * LoginPrompt — the account gate for ordering.
 *
 * Browsing stays public so the shop can be crawled and indexed; an account is
 * only needed to place an order. This is the same pattern Blinkit, Zepto and
 * Instamart use: anyone can see the catalogue, nobody can check out without
 * signing in.
 *
 * Two entry points:
 *   variant="add-to-cart"  shown when an anonymous visitor taps ADD
 *   variant="welcome"      shown once when a visitor first lands on the shop
 *
 * The welcome variant is deliberately non-blocking and only shown once per
 * browser (see SESSION_KEY), so it reads as an invitation rather than an
 * obstacle.
 */
export default function LoginPrompt({
  open,
  onClose,
  onContinueBrowsing,
  variant = "add-to-cart",
  productName,
  returnTo,
}) {
  const navigate = useNavigate();
  if (!open) return null;

  const isWelcome = variant === "welcome";
  const target = returnTo || "/Shop";

  const goToLogin = () => {
    // Carry the intended destination so login returns the user to the product
    // they were trying to add, not just the shop front page.
    navigate(createPageUrl("login"), {
      state: { from: { pathname: target } },
    });
  };

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-end sm:items-center justify-center bg-black/45 p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={isWelcome ? "Sign in to CollegeCart" : "Sign in to order"}
    >
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-5 relative">
        {!isWelcome && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mb-3">
          {isWelcome ? (
            <Clock className="w-6 h-6 text-emerald-600" />
          ) : (
            <ShoppingBag className="w-6 h-6 text-emerald-600" />
          )}
        </div>

        <h2 className="text-lg font-bold text-gray-900 mb-1">
          {isWelcome ? "Sign in to CollegeCart" : "Sign in to order"}
        </h2>

        <p className="text-sm text-gray-600 leading-relaxed mb-4">
          {isWelcome ? (
            <>
              Create a free account to check live stock for your hostel, keep your
              cart across devices, and track deliveries to your door. Browsing is
              open to everyone — only ordering needs an account.
            </>
          ) : (
            <>
              You need an account to add items to your cart
              {productName ? (
                <>
                  {" "}
                  and check out. <strong>{productName}</strong> is waiting for
                  you.
                </>
              ) : (
                " and check out."
              )}
            </>
          )}
        </p>

        <div className="flex flex-col gap-2">
          <Button
            className="w-full bg-[#0c831f] hover:bg-[#0a6d1a] text-white font-semibold"
            onClick={goToLogin}
          >
            <LogIn className="w-4 h-4 mr-2" />
            Sign in to continue
          </Button>
          {isWelcome ? (
            <button
              type="button"
              onClick={() => (onContinueBrowsing ? onContinueBrowsing() : onClose?.())}
              className="w-full text-sm text-gray-500 hover:text-gray-700 py-2"
            >
              Continue browsing
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="w-full text-sm text-gray-500 hover:text-gray-700 py-2"
            >
              Not now
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const SESSION_KEY = "cc_login_prompt_seen";

/** True when the welcome prompt has not been dismissed in this browser. */
export function shouldShowWelcomePrompt() {
  try {
    return localStorage.getItem(SESSION_KEY) !== "1";
  } catch {
    return false;
  }
}

export function markWelcomePromptSeen() {
  try {
    localStorage.setItem(SESSION_KEY, "1");
  } catch {
    /* private mode — prompt will show again, harmless */
  }
}
