import { useEffect, useRef, useState } from "react";
import { useReducedMotionPref } from "./useReducedMotionPref";

/**
 * ValueTransition — restrained "number ticker" (V1 Visual Correction §25.C).
 *
 * Adapts the Magic UI Number Ticker *concept* only: when a numeric value
 * MEANINGFULLY changes while mounted, it counts to the new value over a short
 * duration. It deliberately does NOT animate on first mount (no decorative
 * count-up of static values, §19) and collapses to an instant set under
 * reduced motion.
 *
 * `format` maps the animated number back to display text (percent, "x / y", …).
 */
export function ValueTransition({
  value,
  format = (n) => String(Math.round(n)),
  durationMs = 200,
  className,
}: {
  value: number;
  format?: (n: number) => string;
  durationMs?: number;
  className?: string;
}) {
  const reduced = useReducedMotionPref();
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef<number | undefined>(undefined);
  const mountedOnce = useRef(false);

  useEffect(() => {
    if (!mountedOnce.current) {
      mountedOnce.current = true;
      setDisplay(value);
      fromRef.current = value;
      return;
    }
    if (reduced || durationMs <= 0 || fromRef.current === value) {
      setDisplay(value);
      fromRef.current = value;
      return;
    }

    const from = fromRef.current;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - (1 - t) * (1 - t);
      setDisplay(from + (value - from) * eased);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = value;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current);
    };
  }, [value, reduced, durationMs]);

  return (
    <span className={className} data-value={value}>
      {format(display)}
    </span>
  );
}
