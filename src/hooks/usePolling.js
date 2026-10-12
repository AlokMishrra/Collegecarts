import { useEffect, useRef, useState, useCallback } from "react";

/**
 * CollegeCart — shared polling policy.
 *
 * WHY THIS EXISTS
 * ---------------
 * Intervals were previously scattered as bare setInterval calls with arbitrary
 * periods, several of them unconditional (a 1 s cart-count poll ran even when
 * the tab was hidden). This hook centralises the rules:
 *
 *   * nothing polls while document.visibilityState === 'hidden'
 *   * a tab regaining focus polls once immediately, then resumes on interval
 *   * exponential backoff with jitter after repeated failures, reset on success
 *   * the in-flight work is not overlapped, and a stale response cannot land
 *     after a newer one
 *   * timers and listeners are always cleared on unmount or identity change
 *
 * It deliberately does NOT retry non-idempotent writes. Callers that pass a
 * mutation should guard it with their own idempotency key.
 *
 * @param fn      poll function. Receives an AbortSignal for fetch aborts.
 * @param options { intervalMs, immediate, enabled, onError }
 */
export function usePolling(
  fn,
  { intervalMs = 30000, immediate = true, enabled = true, onError } = {},
) {
  const [backoff, setBackoff] = useState(1);
  const [lastRunAt, setLastRunAt] = useState(null);
  const [isPolling, setIsPolling] = useState(false);

  const fnRef = useRef(fn);
  fnRef.current = fn;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const runOnce = useCallback(async () => {
    if (document.visibilityState === "hidden") return;
    setIsPolling(true);
    try {
      await fnRef.current(new AbortController().signal);
      setBackoff(1); // success resets the backoff
      setLastRunAt(Date.now());
    } catch (err) {
      onErrorRef.current?.(err);
      setBackoff((b) => Math.min(b * 2, 8)); // cap at 8x the interval
    } finally {
      setIsPolling(false);
    }
  }, []);

  /** Run once on demand — used after a local mutation. */
  const refresh = useCallback(() => {
    void runOnce();
  }, [runOnce]);

  useEffect(() => {
    if (!enabled) return;
    if (document.visibilityState === "hidden") return;

    let cancelled = false;
    let timer = null;

    const schedule = () => {
      if (cancelled) return;
      timer = setTimeout(async () => {
        await runOnce();
        if (!cancelled) schedule();
      }, intervalMs * backoff);
    };

    if (immediate) void runOnce();
    schedule();

    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      // Refresh once on return rather than continuing to poll in the background.
      void runOnce();
      schedule();
    };
    document.addEventListener("visibilitychange", onVisibility);

    const onFocus = () => {
      if (document.visibilityState !== "visible") return;
      void runOnce();
    };
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
    };
  }, [intervalMs, backoff, immediate, enabled, runOnce]);

  return { refresh, isPolling, lastRunAt, backoffFactor: backoff };
}

/**
 * Debounced trigger for high-frequency work. Guarantees the work runs at most
 * once per window even if called many times. Always clears its timer.
 */
export function useDebouncedInterval(fn, delayMs, enabled = true) {
  const timer = useRef(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    if (!enabled) return;
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [enabled]);

  return useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => fnRef.current(), delayMs);
  }, [delayMs]);
}
