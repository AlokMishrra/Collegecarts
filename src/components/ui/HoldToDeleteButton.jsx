"use client";

import { forwardRef, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Check, Trash2 } from "lucide-react";

const HOLD_STEPS = [
  { ms: 500, className: "duration-500" },
  { ms: 700, className: "duration-700" },
  { ms: 1000, className: "duration-1000" },
  { ms: 1100, className: "duration-[1100ms]" },
  { ms: 1500, className: "duration-[1500ms]" },
  { ms: 2000, className: "duration-[2000ms]" },
];

function nearestHoldStep(holdMs) {
  return HOLD_STEPS.reduce((best, step) =>
    Math.abs(step.ms - holdMs) < Math.abs(best.ms - holdMs) ? step : best,
  );
}

export const HoldToDeleteButton = forwardRef(
  (
    {
      className,
      label = "Hold to delete",
      doneLabel = "Deleted",
      holdMs = 1100,
      onHoldComplete,
      ...props
    },
    ref,
  ) => {
    const [holding, setHolding] = useState(false);
    const [done, setDone] = useState(false);
    const timerRef = useRef(null);

    const step = nearestHoldStep(holdMs);

    useEffect(() => {
      return () => {
        if (timerRef.current !== null) globalThis.clearTimeout(timerRef.current);
      };
    }, []);

    const start = () => {
      if (done || timerRef.current !== null) return;
      setHolding(true);
      timerRef.current = globalThis.setTimeout(() => {
        timerRef.current = null;
        setHolding(false);
        setDone(true);
        onHoldComplete?.();
      }, step.ms);
    };

    const cancel = () => {
      if (timerRef.current !== null) {
        globalThis.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setHolding(false);
    };

    const handleKeyDown = (event) => {
      if (event.repeat) return;
      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        start();
      }
    };

    const handleKeyUp = (event) => {
      if (event.key === " " || event.key === "Enter") cancel();
    };

    const wipeMotion = cn(
      "transition-transform motion-reduce:transition-none motion-reduce:transform-none",
      holding || done ? cn("ease-linear", step.className) : "duration-300 ease-out",
    );

    return (
      <button
        ref={ref}
        type="button"
        data-slot="hold-to-delete-button"
        data-holding={holding || undefined}
        data-done={done || undefined}
        aria-label={done ? doneLabel : label}
        onPointerDown={start}
        onPointerUp={cancel}
        onPointerLeave={cancel}
        onPointerCancel={cancel}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        onContextMenu={(event) => event.preventDefault()}
        disabled={done}
        className={cn(
          "relative flex h-12 w-full touch-none items-center justify-center overflow-hidden rounded-xl bg-neutral-50 font-sans text-sm font-medium outline-none select-none",
          "transition-shadow duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600",
          "shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_1px_1px_rgba(0,0,0,0.12),0_2px_3px_rgba(0,0,0,0.12)]",
          (holding || done) &&
            "shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_1px_1px_rgba(0,0,0,0.06)]",
          !done && "cursor-pointer",
          className,
        )}
        {...props}
      >
        <span className="flex items-center justify-center gap-2 text-rose-600">
          <Trash2 size={15} strokeWidth={2} aria-hidden />
          {label}
        </span>

        <span
          aria-hidden
          className={cn(
            "absolute inset-0 overflow-hidden bg-rose-600",
            wipeMotion,
            holding || done ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <span
            className={cn(
              "absolute inset-0 flex items-center justify-center gap-2 text-white",
              wipeMotion,
              holding || done ? "translate-x-0" : "translate-x-full",
              "transition-[transform,opacity]",
              done ? "opacity-0 duration-300 ease-out" : "opacity-100",
            )}
          >
            <Trash2 size={15} strokeWidth={2} aria-hidden />
            {label}
          </span>

          <span
            className={cn(
              "absolute inset-0 flex items-center justify-center gap-2 text-white",
              "transition-opacity duration-500 ease-out motion-reduce:transition-none",
              done ? "opacity-100 delay-300" : "opacity-0",
            )}
          >
            <Check size={15} strokeWidth={2.5} aria-hidden />
            {doneLabel}
          </span>
        </span>

        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0 rounded-[inherit]",
            "transition-shadow duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
            holding || done
              ? "shadow-[inset_0_1px_0_rgba(255,255,255,0.25),inset_0_2px_4px_rgba(0,0,0,0.25),inset_0_-2px_3px_rgba(0,0,0,0.2)]"
              : "shadow-[inset_0_-2px_3px_rgba(0,0,0,0.08)]",
          )}
        />

        <span className="sr-only" aria-live="polite">
          {done ? doneLabel : ""}
        </span>
      </button>
    );
  },
);

HoldToDeleteButton.displayName = "HoldToDeleteButton";
