import { NavLink } from "react-router-dom";
import { NAVIGATION } from "./navigation";

/**
 * §22 App Shell — primary navigation.
 *
 * Expanded width is the canonical 248px. Collapsed (72px, icon-only) is
 * deferred: it needs a decided per-destination icon set, which PBOS does not
 * yet have — tracked as a product-decision item, not implemented as a
 * half-set of letter glyphs.
 *
 * Active / hover / focus states use the canonical accent-soft selection fill;
 * keyboard focus comes from the global :focus-visible ring in index.css.
 */
export function Sidebar() {
  return (
    <aside className="w-[248px] shrink-0 h-full flex flex-col bg-canvas border-r border-border-subtle">
      <div className="h-16 px-5 flex items-center gap-3 border-b border-border-subtle">
        <div className="w-8 h-8 rounded-md bg-surface-raised border border-border-subtle flex items-center justify-center text-text-primary font-display font-semibold text-sm">
          PB
        </div>
        <div className="min-w-0">
          <div className="t-card-title text-text-primary leading-tight truncate">
            Performance Buddy
          </div>
          <div className="t-label text-text-muted">Operating System</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {NAVIGATION.map((group) => (
          <div key={group.id}>
            <div className="px-2 mb-1.5 t-label uppercase text-text-muted">
              {group.label}
            </div>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavLink
                  key={item.id}
                  to={item.path}
                  end={item.path === "/"}
                  className={({ isActive }) =>
                    [
                      "flex items-center justify-between px-3 h-9 rounded-md t-nav transition-colors",
                      isActive
                        ? "bg-surface-selected text-text-primary"
                        : "text-text-secondary hover:bg-surface-raised hover:text-text-primary",
                    ].join(" ")
                  }
                >
                  <span className="truncate">{item.label}</span>
                  {item.status !== "implemented" && (
                    <span
                      aria-hidden
                      className="text-text-muted text-[10px] leading-none"
                    >
                      {item.status === "structured" ? "•" : "···"}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-4 py-3 border-t border-border-subtle">
        <div className="flex items-center gap-2 t-label text-text-muted">
          <span className="w-1.5 h-1.5 rounded-full bg-status-success" aria-hidden />
          Local-first · Offline-capable
        </div>
      </div>
    </aside>
  );
}
