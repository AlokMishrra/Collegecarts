import React, { useRef, useState, useEffect } from "react";
import { ArrowRight, Loader2 } from "lucide-react";

export default function SwipeToPay({
  amount,
  onSwipe,
  disabled = false,
  isLoading = false,
  label,
}) {
  const trackRef = useRef(null);
  const handleRef = useRef(null);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [completed, setCompleted] = useState(false);
  const startXRef = useRef(0);
  const maxXRef = useRef(0);

  const text = label || (amount ? `Swipe to pay ₹${amount}` : "Swipe to place order");

  // Reset when disabled changes from true to false or amount changes
  useEffect(() => {
    if (!disabled) {
      setDragX(0);
      setCompleted(false);
    }
  }, [disabled, amount]);

  const getMaxX = () => {
    if (!trackRef.current) return 0;
    const trackW = trackRef.current.offsetWidth;
    const handleW = 48; // w-12
    return Math.max(0, trackW - handleW - 8); // 4px padding each side
  };

  const onStart = (clientX) => {
    if (disabled || isLoading || completed) return;
    setDragging(true);
    startXRef.current = clientX - dragX;
    maxXRef.current = getMaxX();
  };

  const onMove = (clientX) => {
    if (!dragging || disabled || isLoading || completed) return;
    const x = clientX - startXRef.current;
    const clamped = Math.max(0, Math.min(x, maxXRef.current));
    setDragX(clamped);
  };

  const onEnd = () => {
    if (!dragging) return;
    setDragging(false);
    const threshold = maxXRef.current * 0.78;
    if (dragX >= threshold) {
      setCompleted(true);
      setDragX(maxXRef.current);
      // Haptic
      if (navigator.vibrate) navigator.vibrate(20);
      setTimeout(() => {
        onSwipe?.();
        // Keep completed state until parent disables/loading; reset after a moment if not disabled
        setTimeout(() => {
          setCompleted(false);
          setDragX(0);
        }, 1500);
      }, 180);
    } else {
      // Snap back
      setDragX(0);
    }
  };

  // Mouse handlers
  const handleMouseDown = (e) => {
    e.preventDefault();
    onStart(e.clientX);
  };
  useEffect(() => {
    if (!dragging) return;
    const move = (e) => onMove(e.clientX);
    const up = () => onEnd();
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, [dragging, dragX]);

  // Touch handlers
  const handleTouchStart = (e) => onStart(e.touches[0].clientX);
  const handleTouchMove = (e) => onMove(e.touches[0].clientX);
  const handleTouchEnd = () => onEnd();

  const progress = maxXRef.current > 0 ? dragX / maxXRef.current : 0;

  return (
    <div
      ref={trackRef}
      className={`relative w-full h-[56px] rounded-full flex items-center select-none overflow-hidden touch-manipulation ${
        disabled ? "bg-gray-100 border border-gray-200" : "bg-[#f5f5f5] border border-gray-200"
      }`}
      style={{ WebkitTapHighlightColor: "transparent" }}
    >
      {/* Fill behind handle */}
      <div
        className="absolute left-1 top-1 bottom-1 rounded-full bg-[#0c831f] transition-none"
        style={{
          width: `${dragX + 48 + (dragging ? 0 : 0)}px`,
          opacity: disabled ? 0.4 : 0.12 + progress * 0.88,
          transition: dragging ? "none" : "width 0.3s ease, opacity 0.3s ease",
        }}
      />

      {/* Center text */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {isLoading ? (
          <span className="flex items-center gap-2 text-sm font-semibold text-gray-600">
            <Loader2 className="w-4 h-4 animate-spin" />
            Processing...
          </span>
        ) : (
          <span
            className={`text-[15px] font-semibold tracking-tight transition-opacity ${dragging && progress > 0.2 ? "opacity-0" : "opacity-100"} ${disabled ? "text-gray-400" : "text-gray-600"}`}
          >
            {disabled ? "Add items to continue" : text}
          </span>
        )}
      </div>

      {/* Draggable handle */}
      <div
        ref={handleRef}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={`absolute left-1 top-1 w-12 h-12 rounded-full flex items-center justify-center shadow-md cursor-grab active:cursor-grabbing select-none ${
          disabled || isLoading ? "bg-gray-300 cursor-not-allowed" : completed ? "bg-[#0c831f]" : "bg-[#4ade80] hover:bg-[#22c55e]"
        }`}
        style={{
          transform: `translateX(${dragX}px)`,
          transition: dragging ? "none" : "transform 0.3s cubic-bezier(0.34,1.56,0.64,1), background-color 0.2s ease",
        }}
      >
        {completed ? (
          <span className="text-white text-lg">✓</span>
        ) : (
          <ArrowRight className="w-5 h-5 text-white" strokeWidth={2.5} />
        )}
      </div>
    </div>
  );
}
