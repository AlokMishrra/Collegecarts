import React from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart, X } from 'lucide-react';

export default function FloatingCart({ count = 0, isOpen = false, onClose, onOpen }) {
  if (count === 0 && !isOpen) return null;

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-[9995] lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <Link
        to="/Cart"
        className="fixed bottom-20 right-4 z-[9996] lg:hidden flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-emerald-600 text-white shadow-xl transition-all duration-300 hover:scale-105 active:scale-95"
        style={{ boxShadow: '0 4px 20px rgba(16, 185, 129, 0.4)' }}
        onClick={onOpen}
      >
        <ShoppingCart className="w-5 h-5 flex-shrink-0" />
        <span className="font-semibold text-sm whitespace-nowrap">
          View Cart
        </span>
        {count > 0 && (
          <span className="flex items-center justify-center min-w-[22px] h-[22px] px-2 bg-white/20 text-white text-xs font-bold rounded-full">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </Link>
    </>
  );
}