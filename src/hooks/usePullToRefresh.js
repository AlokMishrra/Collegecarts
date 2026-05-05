import { useEffect, useRef, useState } from "react";

export function usePullToRefresh(onRefresh, threshold = 80) {
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startY = useRef(0);
  const containerRef = useRef(null);
  const canPull = useRef(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let touchStartY = 0;
    let currentY = 0;

    const handleTouchStart = (e) => {
      // Only trigger if scrolled to top
      if (container.scrollTop === 0) {
        touchStartY = e.touches[0].clientY;
        startY.current = touchStartY;
        canPull.current = true;
      } else {
        canPull.current = false;
      }
    };

    const handleTouchMove = (e) => {
      if (!canPull.current || isRefreshing) return;

      currentY = e.touches[0].clientY;
      const distance = currentY - startY.current;

      // Only pull down, not up, and only if at top
      if (distance > 0 && container.scrollTop === 0) {
        // DON'T prevent default - let scroll work naturally
        // Just track the distance for visual feedback
        setIsPulling(true);
        const resistedDistance = Math.min(distance * 0.3, threshold * 1.2);
        setPullDistance(resistedDistance);
      } else {
        setIsPulling(false);
        setPullDistance(0);
      }
    };

    const handleTouchEnd = async () => {
      if (!canPull.current) return;

      canPull.current = false;
      setIsPulling(false);

      if (pullDistance >= threshold && !isRefreshing) {
        setIsRefreshing(true);
        try {
          await onRefresh();
        } catch (error) {
          console.error("Refresh error:", error);
        } finally {
          setIsRefreshing(false);
          setPullDistance(0);
        }
      } else {
        setPullDistance(0);
      }
    };

    // ALL passive: true - never block scroll
    container.addEventListener("touchstart", handleTouchStart, { passive: true });
    container.addEventListener("touchmove", handleTouchMove, { passive: true });
    container.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isPulling, pullDistance, threshold, onRefresh, isRefreshing]);

  return {
    containerRef,
    isPulling,
    pullDistance,
    isRefreshing,
    threshold,
  };
}
