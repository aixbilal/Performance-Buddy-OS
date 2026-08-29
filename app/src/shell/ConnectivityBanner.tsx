import { useConnectivityBanner } from "./useConnectivityBanner";

/**
 * §28: a restrained status pill, never a full-screen failure. Core PBOS
 * (Today, Goals, Academics, etc.) keeps working underneath this regardless
 * of what it shows — this component only ever adds a small banner, it never
 * blocks or replaces the rest of the UI.
 */
export function ConnectivityBanner() {
  const state = useConnectivityBanner();

  if (state === "hidden") return null;

  if (state === "offline") {
    return (
      <div className="px-3 py-1.5 bg-surface-inset border-b border-border-subtle text-text-muted text-xs flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-status-warning" />
        Offline · Local features available
      </div>
    );
  }

  // back-online — brief, factual, then gone (handled by the hook's own timer).
  return (
    <div className="px-3 py-1.5 bg-status-success/10 border-b border-status-success/20 text-status-success text-xs flex items-center gap-2">
      <span className="w-1.5 h-1.5 rounded-full bg-status-success" />
      Back online
    </div>
  );
}
