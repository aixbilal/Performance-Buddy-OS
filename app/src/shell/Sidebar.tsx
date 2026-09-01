import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { NAVIGATION } from "./navigation";
import { Icon } from "../components/Icon";

/**
 * §22 App Shell — primary navigation.
 *
 * V1 Visual Correction (§9–§15): the destination list gains the canonical PBOS
 * icon language, a more deliberate active state (accent-soft fill + a single
 * accent edge indicator that GLIDES between destinations), a quieter hover, and
 * a slightly stronger brand lockup — placement is unchanged, this is identity
 * only.
 *
 * The glide is a CSS transform transition on one absolutely-positioned edge
 * element; `prefers-reduced-motion` / the in-app reduced-motion toggle collapse
 * it to an instant move via the global rule in index.css, and the active state
 * never depends on the indicator (accent fill + brighter icon + `aria-current`
 * all still read).
 *
 * Collapsed (72px, icon-only) rail stays deferred (§13): it needs width-toggle
 * state, persistence and topbar coordination — not a trivial, already-supported
 * change — and must not gate this pass.
 */
export function Sidebar() {
  const navRef = useRef<HTMLElement>(null);
  const location = useLocation();
  const [indicator, setIndicator] = useState<{ top: number; height: number } | null>(null);

  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    const measure = () => {
      const active = nav.querySelector<HTMLElement>('a[data-nav-item][aria-current="page"]');
      if (!active) {
        setIndicator(null);
        return;
      }
      // Inset a little so it reads as a deliberate "you are here" edge mark,
      // not a full-height slab fragment.
      setIndicator({ top: active.offsetTop + 6, height: Math.max(0, active.offsetHeight - 12) });
    };

    measure();
    const raf =
      typeof requestAnimationFrame === "function" ? requestAnimationFrame(measure) : undefined;
    window.addEventListener("resize", measure);
    return () => {
      if (raf !== undefined) cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
    };
  }, [location.pathname]);

  // Re-measure once webfonts settle (row heights can shift a hair on swap).
  useEffect(() => {
    let cancelled = false;
    document.fonts?.ready.then(() => {
      const nav = navRef.current;
      if (cancelled || !nav) return;
      const active = nav.querySelector<HTMLElement>('a[data-nav-item][aria-current="page"]');
      if (active)
        setIndicator({ top: active.offsetTop + 6, height: Math.max(0, active.offsetHeight - 12) });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <aside className="w-[248px] shrink-0 h-full flex flex-col bg-canvas border-r border-border-subtle">
      <div className="h-16 px-5 flex items-center gap-3 border-b border-border-subtle relative">
        <div className="w-8 h-8 rounded-md bg-accent-soft border border-border-strong flex items-center justify-center text-text-primary font-display font-semibold text-sm tracking-tight">
          PB
        </div>
        <div className="min-w-0">
          <div className="t-card-title text-text-primary leading-tight truncate">
            Performance Buddy
          </div>
          <div className="t-label text-text-muted">Operating System</div>
        </div>
        {/* §15 — a single restrained divider illumination under the shell head. */}
        <span
          aria-hidden
          className="absolute inset-x-0 -bottom-px h-px bg-linear-to-r from-transparent via-accent-glow/40 to-transparent"
        />
      </div>

      <nav ref={navRef} className="relative flex-1 overflow-y-auto px-3 py-4 space-y-5">
        <span
          aria-hidden
          className={`absolute left-0 w-[3px] rounded-full bg-border-selected transition-[transform,height,opacity] duration-200 ease-out ${
            indicator ? "opacity-100" : "opacity-0"
          }`}
          style={{
            transform: `translateY(${indicator?.top ?? 0}px)`,
            height: indicator?.height ?? 0,
          }}
        />

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
                  data-nav-item
                  className={({ isActive }) =>
                    [
                      "group flex items-center gap-3 px-3 h-9 rounded-md t-nav transition-colors",
                      isActive
                        ? "bg-surface-selected text-text-primary"
                        : "text-text-secondary hover:bg-surface-raised hover:text-text-primary",
                    ].join(" ")
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon
                        name={item.icon}
                        size={18}
                        className={
                          isActive
                            ? "shrink-0 text-text-primary"
                            : "shrink-0 text-text-muted group-hover:text-text-secondary"
                        }
                      />
                      <span className="truncate flex-1">{item.label}</span>
                      {item.status === "placeholder" && (
                        <span
                          aria-hidden
                          className="shrink-0 w-1 h-1 rounded-full bg-text-disabled"
                        />
                      )}
                    </>
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
