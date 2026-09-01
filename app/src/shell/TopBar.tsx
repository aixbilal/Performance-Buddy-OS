import { NavLink } from "react-router-dom";
import { ShellStatusRegion } from "./ShellStatusRegion";

/**
 * §18 App Shell — top bar: page identity (left) + command search and the
 * notification / status region (right).
 *
 * §21 command-search contrast: this is a real <button> (focusable, obvious
 * keyboard focus from the global ring, hover state) and its text sits at
 * text-secondary on surface — WCAG AA on the canonical palette. It opens the
 * same command palette as ⌘K via a window event.
 */
export function TopBar({ title }: { title: string }) {
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const openPalette = () =>
    window.dispatchEvent(new CustomEvent("pbos:open-command-palette"));

  return (
    <header className="h-16 shrink-0 flex items-center justify-between gap-4 px-6 border-b border-border-subtle bg-canvas">
      <div className="flex items-center gap-3 min-w-0">
        <h1 className="t-h3 text-text-primary truncate">{title}</h1>
        <span className="t-small text-text-muted hidden lg:inline whitespace-nowrap">
          {today}
        </span>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={openPalette}
          aria-label="Search or run a command"
          aria-keyshortcuts="Control+K Meta+K"
          className="hidden md:flex items-center gap-2 h-9 px-3 rounded-md bg-surface border border-border-subtle text-text-secondary hover:border-border-strong hover:text-text-primary transition-colors w-72 text-left"
        >
          <span aria-hidden className="text-text-muted">
            ⌕
          </span>
          <span className="t-small">Search or command…</span>
          <kbd className="ml-auto t-label text-text-muted border border-border-subtle rounded px-1 py-0.5">
            ⌘K
          </kbd>
        </button>

        <ShellStatusRegion />

        <NavLink
          to="/ai-coach"
          aria-label="AI Coach"
          className={({ isActive }) =>
            [
              "inline-flex items-center gap-1.5 h-9 px-3 rounded-md border transition-colors t-small",
              isActive
                ? "bg-accent-soft border-border-focus text-text-primary"
                : "bg-surface border-border-subtle text-text-secondary hover:text-text-primary hover:border-border-strong",
            ].join(" ")
          }
        >
          <span aria-hidden>✦</span>
          <span className="hidden lg:inline">AI</span>
        </NavLink>
      </div>
    </header>
  );
}
