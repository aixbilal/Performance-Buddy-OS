import { NavLink } from "react-router-dom";
import { usePersistenceStatus } from "../domains/persistence/usePersistenceStatus";
import { useConnectivityBanner } from "./useConnectivityBanner";

/**
 * §20 App Shell — notification / status region.
 *
 * V1 scope is deliberately narrow: it reports MEANINGFUL system state only —
 * where data is being saved, and whether the machine is offline. It is NOT a
 * notification centre and it never invents events. PBOS does not schedule OS
 * notifications, so nothing here implies that.
 */
export function ShellStatusRegion() {
  const p = usePersistenceStatus();
  const connectivity = useConnectivityBanner();

  const saving =
    p.phase === "loading"
      ? { dot: "bg-text-muted", label: "Loading…", tone: "text-text-muted" }
      : !p.durable
        ? { dot: "bg-status-danger", label: "Not saved", tone: "text-status-danger" }
        : p.degradedFrom
          ? { dot: "bg-status-warning", label: "Fallback store", tone: "text-status-warning" }
          : { dot: "bg-status-success", label: "Saved locally", tone: "text-text-muted" };

  return (
    <div className="hidden sm:flex items-center gap-3" aria-live="polite">
      {connectivity === "offline" && (
        <span
          className="inline-flex items-center gap-1.5 t-label text-status-warning"
          title="No network — local features keep working"
        >
          <span aria-hidden className="w-1.5 h-1.5 rounded-full bg-status-warning" />
          Offline
        </span>
      )}

      <NavLink
        to="/settings"
        title={
          p.durable
            ? "Data is saved to the local store. Open Data & Storage."
            : "Changes this session will not survive a restart. Open Data & Storage."
        }
        className={`inline-flex items-center gap-1.5 t-label ${saving.tone} hover:text-text-primary transition-colors`}
      >
        <span aria-hidden className={`w-1.5 h-1.5 rounded-full ${saving.dot}`} />
        {saving.label}
      </NavLink>
    </div>
  );
}
