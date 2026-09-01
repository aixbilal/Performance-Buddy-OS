import { useEffect, useState } from "react";

/**
 * Single source of truth for "should non-essential motion be suppressed?"
 * (V1 Visual Correction §26, §31).
 *
 * Combines BOTH signals the rest of PBOS already honours:
 *   - the OS `prefers-reduced-motion` media query, and
 *   - the in-app Appearance toggle, mirrored by AppGate onto
 *     `<html data-reduced-motion="true">`.
 *
 * The global CSS in index.css already collapses CSS transitions/animations for
 * both. This hook is for the few JS-driven micro-interactions (the value
 * transition) that need to branch in code — when it returns true they render
 * their final state immediately, no movement.
 */
function reduceQuery(): MediaQueryList | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return null;
  return window.matchMedia("(prefers-reduced-motion: reduce)");
}

function compute(): boolean {
  if (typeof document === "undefined") return false;
  const osReduced = reduceQuery()?.matches ?? false;
  const appReduced = document.documentElement.dataset.reducedMotion === "true";
  return osReduced || appReduced;
}

export function useReducedMotionPref(): boolean {
  const [reduced, setReduced] = useState<boolean>(() => compute());

  useEffect(() => {
    const update = () => setReduced(compute());
    update();

    const mq = reduceQuery();
    mq?.addEventListener?.("change", update);

    let observer: MutationObserver | undefined;
    if (typeof MutationObserver !== "undefined") {
      observer = new MutationObserver(update);
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-reduced-motion"],
      });
    }

    return () => {
      mq?.removeEventListener?.("change", update);
      observer?.disconnect();
    };
  }, []);

  return reduced;
}
