import { NavLink } from "react-router-dom";
import { NAVIGATION } from "./navigation";

export function Sidebar() {
  return (
    <aside className="w-64 shrink-0 h-full flex flex-col bg-canvas border-r border-border-subtle">
      <div className="px-5 py-5 flex items-center gap-3 border-b border-border-subtle">
        <div className="w-9 h-9 rounded-md bg-surface-raised border border-border-subtle flex items-center justify-center text-text-primary font-semibold text-sm">
          PB
        </div>
        <div>
          <div className="text-text-primary text-sm font-semibold leading-tight">
            Performance Buddy OS
          </div>
          <div className="text-text-muted text-xs">App Shell v1</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {NAVIGATION.map((group) => (
          <div key={group.id}>
            <div className="px-2 mb-2 text-[11px] tracking-wide uppercase text-text-muted font-medium">
              {group.label}
            </div>
            <div className="space-y-1">
              {group.items.map((item) => (
                <NavLink
                  key={item.id}
                  to={item.path}
                  end={item.path === "/"}
                  className={({ isActive }) =>
                    [
                      "flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors",
                      isActive
                        ? "bg-surface-selected text-text-primary"
                        : "text-text-secondary hover:bg-surface-raised hover:text-text-primary",
                    ].join(" ")
                  }
                >
                  <span>{item.label}</span>
                  {item.status !== "implemented" && (
                    <span className="text-[10px] text-text-disabled">
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
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <span className="w-2 h-2 rounded-full bg-status-success" />
          Local-first · All systems ready
        </div>
      </div>
    </aside>
  );
}
