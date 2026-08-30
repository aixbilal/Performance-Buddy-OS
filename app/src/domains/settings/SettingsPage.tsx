import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";
import { PersistenceStatusLine } from "../../components/PersistenceStatusLine";
import { useSettings } from "./store";
import type { NotificationCategory, OperatingMode } from "./types";

const MODES: OperatingMode[] = ["normal", "midterm", "final", "recovery"];
const CATEGORIES: NotificationCategory[] = ["academics", "planner", "routines", "fitness", "reviews", "ai"];

export function SettingsPage() {
  const {
    baseConfig,
    mode,
    setMode,
    temporaryOverrides,
    addTemporaryOverride,
    effectiveWeekdayCapacity,
    notifications,
    toggleCategory,
    appearance,
    setReducedMotion,
    restoreInterfaceDefaults,
    lastResetResult,
  } = useSettings();

  const addTempOverride = () => {
    const expires = new Date();
    expires.setDate(expires.getDate() + 7);
    addTemporaryOverride({ label: "This week", weekdayAcademicDeltaMinutes: 15, expiresAt: expires.toISOString() });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-text-primary text-xl font-semibold">Settings</h2>
        <p className="text-text-muted text-sm">Configure existing systems — nothing here duplicates a domain's own logic.</p>
      </div>

      <Card title="Operating Mode">
        <div className="flex gap-2 mb-4">
          {MODES.map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize ${
                mode === m ? "bg-action-primary text-text-inverse" : "bg-surface-inset text-text-secondary"
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        <div className="bg-surface-inset border border-border-subtle rounded-md p-3">
          <div className="text-text-muted text-xs mb-2">Configuration Precedence (live)</div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-text-secondary">Base {baseConfig.weekdayAcademicCapacityMinutes}m</span>
            <span className="text-text-disabled">→</span>
            <span className="text-text-secondary capitalize">{mode} mode</span>
            <span className="text-text-disabled">→</span>
            <span className="text-text-secondary">{temporaryOverrides.length} temp override(s)</span>
            <span className="text-text-disabled">→</span>
            <span className="text-text-primary font-semibold">Effective {effectiveWeekdayCapacity}m</span>
          </div>
          <p className="text-text-disabled text-[10px] mt-1">
            The base value above never changes — only the effective number, computed fresh each time.
          </p>
        </div>

        <button onClick={addTempOverride} className="mt-3 px-3 py-1.5 rounded-md bg-action-secondary text-text-primary text-xs font-medium">
          Add +15min Temporary Override (7 days)
        </button>
      </Card>

      <Card title="Notifications">
        <div className="grid grid-cols-3 gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => toggleCategory(c)}
              className="flex items-center justify-between px-3 py-2 rounded-md bg-surface-inset border border-border-subtle text-sm"
            >
              <span className="text-text-secondary capitalize">{c}</span>
              <Badge tone={notifications.categories[c] ? "success" : "neutral"}>
                {notifications.categories[c] ? "On" : "Off"}
              </Badge>
            </button>
          ))}
        </div>
        <p className="text-text-disabled text-[10px] mt-2">
          AI notifications default to off — deterministic systems get more room than AI-generated noise.
        </p>
      </Card>

      <Card title="Appearance">
        <button
          onClick={() => setReducedMotion(!appearance.reducedMotion)}
          className="flex items-center justify-between px-3 py-2 rounded-md bg-surface-inset border border-border-subtle text-sm w-full"
        >
          <span className="text-text-secondary">Reduced Motion</span>
          <Badge tone={appearance.reducedMotion ? "success" : "neutral"}>{appearance.reducedMotion ? "On" : "Off"}</Badge>
        </button>
      </Card>

      <Card title="Data & Storage">
        <PersistenceStatusLine />
      </Card>

      <Card title="Reset">
        <button onClick={restoreInterfaceDefaults} className="px-3 py-1.5 rounded-md bg-action-secondary text-text-primary text-xs font-medium">
          Restore Interface Defaults
        </button>
        {lastResetResult && (
          <div className="mt-3 text-xs">
            <p className="text-text-secondary mb-1">Last reset affected: {lastResetResult.affects.join(", ")}</p>
            <p className="text-status-success">
              Never touched: {lastResetResult.neverAffects.join(", ")} — academic records, goals, and schedule are safe.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
