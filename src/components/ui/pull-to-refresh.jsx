import React from "react";
import { Loader2, ArrowDown } from "lucide-react";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";

export function PullToRefresh({ onRefresh, children, className = "" }) {
  const { containerRef, isPulling, pullDistance, isRefreshing, threshold } = usePullToRefresh(onRefresh);

  const progress = Math.min((pullDistance / threshold) * 100, 100);
  const shouldTrigger = pullDistance >= threshold;

  return (
    <div ref={containerRef} className={`relative overflow-auto ${className}`}>
      {/* Pull indicator */}
      <div
        className="absolute top-0 left-0 right-0 flex items-center justify-center transition-all duration-200 pointer-events-none z-10"
        style={{
          height: `${Math.min(pullDistance, threshold * 1.5)}px`,
          opacity: isPulling || isRefreshing ? 1 : 0,
        }}
      >
        <div className="flex flex-col items-center gap-1">
          {isRefreshing ? (
            <>
              <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
              <span className="text-xs text-gray-600 dark:text-gray-400">Refreshing...</span>
            </>
          ) : (
            <>
              <div
                className={`transition-transform duration-200 ${
                  shouldTrigger ? "rotate-180" : "rotate-0"
                }`}
              >
                <ArrowDown className="w-6 h-6 text-emerald-600" />
              </div>
              <span className="text-xs text-gray-600 dark:text-gray-400">
                {shouldTrigger ? "Release to refresh" : "Pull to refresh"}
              </span>
              {/* Progress indicator */}
              <div className="w-16 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-600 transition-all duration-100"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Content with padding to prevent overlap */}
      <div
        className="transition-transform duration-200"
        style={{
          transform: isRefreshing ? `translateY(${threshold}px)` : "translateY(0)",
        }}
      >
        {children}
      </div>
    </div>
  );
}
