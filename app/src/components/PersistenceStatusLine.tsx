import { Badge } from "./Badge";
import { usePersistenceStatus } from "../domains/persistence/usePersistenceStatus";

/**
 * Tells the user, truthfully, where their data actually lives. Never claims
 * "all good" — surfaces degraded/volatile backends and the one-time
 * localStorage → SQLite migration outcome.
 */
export function PersistenceStatusLine() {
  const s = usePersistenceStatus();

  const backendLabel =
    s.backend === "sqlite"
      ? "SQLite (durable, local)"
      : s.backend === "localStorage"
        ? "Browser localStorage"
        : "In-memory (not saved)";

  const tone: "success" | "warning" | "danger" =
    s.backend === "sqlite" ? "success" : s.backend === "localStorage" ? "warning" : "danger";

  return (
    <div className="text-xs space-y-1.5">
      <div className="flex items-center gap-2">
        <Badge tone={tone}>{backendLabel}</Badge>
        {s.backend === "sqlite" && (
          <span className="text-text-muted">
            schema v{s.schemaVersion} · {s.keyCount} record set(s)
          </span>
        )}
      </div>

      {s.degradedFrom && (
        <p className="text-status-warning">
          Intended store ({s.degradedFrom}) was unavailable — running on a fallback. {s.error}
        </p>
      )}

      {!s.durable && (
        <p className="text-status-danger">
          Changes this session will NOT survive a restart.
        </p>
      )}

      {s.migration?.ran && (
        <p className="text-text-muted">
          Migrated {s.migration.imported} record set(s) from the previous localStorage store
          {s.migration.skippedExisting > 0 && `, kept ${s.migration.skippedExisting} newer local record set(s)`}
          {s.migration.invalidKeys.length > 0 && (
            <span className="text-status-warning">
              {" "}
              · {s.migration.invalidKeys.length} unreadable legacy key(s) left untouched:{" "}
              {s.migration.invalidKeys.join(", ")}
            </span>
          )}
          .
        </p>
      )}
    </div>
  );
}
