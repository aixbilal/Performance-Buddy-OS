import { useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";
import { SaveIndicator } from "../../components/SaveIndicator";
import { PersistenceStatusLine } from "../../components/PersistenceStatusLine";
import { LoadingState } from "../../components/StateViews";
import { useSettings } from "./store";
import { useAICoach } from "../intelligence/store";
import { useObsidian } from "../obsidian/store";
import { useOnboarding } from "../onboarding/store";
import type { NotificationCategory, OperatingMode } from "./types";
import { Button } from "../../components/Button";

const MODES: OperatingMode[] = ["normal", "midterm", "final", "recovery"];
const CATEGORIES: NotificationCategory[] = [
  "academics",
  "planner",
  "routines",
  "fitness",
  "reviews",
  "ai",
];

export function SettingsPage() {
  const s = useSettings();
  const coach = useAICoach();
  const obs = useObsidian();
  const onboarding = useOnboarding();
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetNote, setResetNote] = useState<string | null>(null);

  const addTempOverride = () => {
    const expires = new Date();
    expires.setDate(expires.getDate() + 7);
    s.addTemporaryOverride({
      label: "This week",
      weekdayAcademicDeltaMinutes: 15,
      expiresAt: expires.toISOString(),
    });
  };

  const eff = s.effectiveConfig;

  // LOADING ≠ EMPTY — never render defaults as if they were the user's saved config.
  if (!s.loaded) return <LoadingState label="Loading settings…" />;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="t-h2 text-text-primary">Settings</h2>
          <p className="text-text-muted text-sm">
            Configure existing systems. Nothing here duplicates a domain's own data — Planning owns
            the schedule, the AI Coach owns permissions, Obsidian owns the vault.
          </p>
        </div>
        <SaveIndicator state={s.saveState} />
      </div>

      {/* --- Overview --- */}
      <Card title="Overview">
        <ul className="text-sm space-y-1.5">
          <li className="flex justify-between border-b border-border-subtle pb-1.5">
            <span className="text-text-secondary">Performance / Planning</span>
            <span className="text-text-muted text-xs capitalize">
              {s.mode} mode · effective weekday capacity {eff.weekdayAcademicCapacityMinutes} min
            </span>
          </li>
          <li className="flex justify-between border-b border-border-subtle pb-1.5">
            <span className="text-text-secondary">AI / Privacy / Data</span>
            <span className="text-text-muted text-xs">
              AI {coach.aiAvailability === "not-configured" ? "not configured" : coach.aiAvailability} ·
              vault {obs.hubState === "indexed" || obs.hubState === "empty" ? "connected" : "not connected"}
            </span>
          </li>
          <li className="flex justify-between">
            <span className="text-text-secondary">Notifications / Appearance</span>
            <span className="text-text-muted text-xs">
              notifications {s.notifications.masterEnabled ? "on" : "off"} · reduced motion{" "}
              {s.appearance.reducedMotion ? "on" : "off"} · {s.appearance.density}
            </span>
          </li>
        </ul>
      </Card>

      {/* --- Performance / Planning --- */}
      <Card title="Performance & Planning">
        <div className="text-text-secondary text-xs mb-2">Operating mode</div>
        <div className="flex gap-2 mb-4">
          {MODES.map((m) => (
            <button
              key={m}
              onClick={() => s.setMode(m)}
              aria-pressed={s.mode === m}
              className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize ${
                s.mode === m
                  ? "bg-action-primary text-text-inverse"
                  : "bg-surface-inset text-text-secondary"
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        <div className="bg-surface-inset border border-border-subtle rounded-md p-3 mb-3" data-testid="effective-config">
          <div className="text-text-muted text-xs mb-2">Effective configuration (derived, never stored)</div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-text-secondary">Base {eff.precedence.base}m</span>
            <span aria-hidden>→</span>
            <span className="text-text-secondary capitalize">
              {s.mode} mode {eff.precedence.modeDelta >= 0 ? "+" : ""}
              {eff.precedence.modeDelta}m
            </span>
            <span aria-hidden>→</span>
            <span className="text-text-secondary">
              {eff.precedence.activeTemporaryOverrides.length} temp override(s){" "}
              {eff.precedence.temporaryDelta >= 0 ? "+" : ""}
              {eff.precedence.temporaryDelta}m
            </span>
            <span aria-hidden>→</span>
            <span className="text-text-primary font-semibold">
              Effective {eff.weekdayAcademicCapacityMinutes}m
            </span>
          </div>
          <p className="text-text-muted text-[11px] mt-1">
            Temporary &gt; mode &gt; base. Changing a temporary override never edits the mode or the
            base; changing the mode never edits the base.
          </p>
        </div>

        <div className="flex items-center gap-2 mb-3">
          <Button variant="secondary" onClick={addTempOverride}>
            Add +15 min temporary override (7 days)
          </Button>
          {s.temporaryOverrides.length > 0 && (
            <Button variant="secondary" onClick={s.clearAllTemporaryOverrides}>
              Clear all temporary overrides
            </Button>
          )}
        </div>
        {s.temporaryOverrides.length > 0 && (
          <ul className="text-xs space-y-1 mb-3">
            {s.temporaryOverrides.map((t) => (
              <li key={t.id} className="flex items-center justify-between">
                <span className="text-text-secondary">
                  {t.label} · {t.weekdayAcademicDeltaMinutes >= 0 ? "+" : ""}
                  {t.weekdayAcademicDeltaMinutes}m · until {t.expiresAt.slice(0, 10)}
                </span>
                <button
                  onClick={() => s.clearTemporaryOverride(t.id)}
                  aria-label={`Clear temporary override ${t.label}`}
                  className="text-text-muted underline hover:text-status-danger"
                >
                  Clear
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="grid grid-cols-2 gap-3">
          <label className="text-text-secondary text-xs">
            Protected sleep (hours)
            <input
              type="number"
              min={4}
              max={12}
              value={s.baseConfig.protectedSleepHours}
              onChange={(e) =>
                s.setBaseConfig({ protectedSleepHours: parseFloat(e.target.value) || 0 })
              }
              className="block mt-1 w-full bg-surface-inset border border-border-subtle rounded px-2 py-1.5 text-text-primary text-sm outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
            />
          </label>
          <label className="text-text-secondary text-xs">
            Weekday academic capacity — BASE (minutes)
            <input
              type="number"
              min={0}
              max={600}
              value={s.baseConfig.weekdayAcademicCapacityMinutes}
              onChange={(e) =>
                s.setBaseConfig({
                  weekdayAcademicCapacityMinutes: parseInt(e.target.value, 10) || 0,
                })
              }
              className="block mt-1 w-full bg-surface-inset border border-border-subtle rounded px-2 py-1.5 text-text-primary text-sm outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
            />
          </label>
        </div>
        <p className="text-text-muted text-[11px] mt-2">
          The Planner owns your actual weekly schedule and its per-day/week capacity —{" "}
          <Link to="/planner" className="underline hover:text-text-secondary">
            edit planning capacity in the Planner
          </Link>
          .
        </p>
      </Card>

      {/* --- AI / Privacy / Data --- */}
      <Card title="AI, Privacy & Data">
        <div className="flex items-center justify-between mb-2 text-sm">
          <span className="text-text-secondary">AI Coach</span>
          <div className="flex items-center gap-2">
            <Badge
              tone={
                coach.aiAvailability === "ready"
                  ? "success"
                  : coach.aiAvailability === "disabled"
                    ? "neutral"
                    : "warning"
              }
            >
              {coach.aiAvailability === "not-configured" ? "not configured" : coach.aiAvailability}
            </Badge>
            <button
              onClick={() => coach.setEnabled(!coach.config.enabled)}
              className="px-2.5 py-1 rounded bg-action-secondary text-text-primary text-[11px]"
            >
              {coach.config.enabled ? "Disable" : "Enable"}
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between mb-3 text-sm">
          <span className="text-text-secondary">Obsidian vault</span>
          <Badge tone={obs.hubState === "indexed" || obs.hubState === "empty" ? "success" : "neutral"}>
            {obs.hubState === "indexed" || obs.hubState === "empty"
              ? "connected"
              : obs.hubState === "missing"
                ? "offline"
                : "not connected"}
          </Badge>
        </div>
        <ul className="text-text-secondary text-xs list-disc list-inside space-y-1 mb-3">
          <li>All records live in a local database on this machine — nothing is uploaded.</li>
          <li>
            The AI Coach only ever receives short summary facts from domains you set to Read or Read
            + Recommend. No marks, transaction amounts, or note bodies.
          </li>
          <li>No provider API key is stored by PBOS — it is read from an environment variable.</li>
        </ul>
        <div className="flex gap-3 text-xs">
          <Link to="/ai-coach/permissions" className="text-text-secondary underline hover:text-text-primary">
            Manage AI permissions
          </Link>
          <Link to="/knowledge/notes" className="text-text-secondary underline hover:text-text-primary">
            Manage the vault
          </Link>
        </div>
      </Card>

      {/* --- Notifications --- */}
      <Card title="Notifications">
        <label className="flex items-center justify-between px-3 py-2 rounded-md bg-surface-inset border border-border-subtle text-sm mb-2">
          <span className="text-text-secondary">All notifications</span>
          <input
            type="checkbox"
            checked={s.notifications.masterEnabled}
            onChange={(e) => s.setMasterNotifications(e.target.checked)}
            aria-label="Enable all notifications"
            className="accent-action-primary"
          />
        </label>
        <div className="grid grid-cols-3 gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => s.toggleCategory(c)}
              aria-pressed={s.notifications.categories[c]}
              disabled={!s.notifications.masterEnabled}
              className="flex items-center justify-between px-3 py-2 rounded-md bg-surface-inset border border-border-subtle text-sm disabled:opacity-40"
            >
              <span className="text-text-secondary capitalize">{c}</span>
              <Badge tone={s.notifications.categories[c] ? "success" : "neutral"}>
                {s.notifications.categories[c] ? "On" : "Off"}
              </Badge>
            </button>
          ))}
        </div>
        <p className="text-text-muted text-[11px] mt-2">
          These are preferences only — PBOS does not yet schedule OS-level notifications, so nothing
          here claims to fire a system alert.
        </p>
      </Card>

      {/* --- Appearance --- */}
      <Card title="Appearance">
        <label className="flex items-center justify-between px-3 py-2 rounded-md bg-surface-inset border border-border-subtle text-sm w-full mb-2">
          <span className="text-text-secondary">Reduced motion</span>
          <input
            type="checkbox"
            checked={s.appearance.reducedMotion}
            onChange={(e) => s.setReducedMotion(e.target.checked)}
            aria-label="Reduced motion"
            className="accent-action-primary"
          />
        </label>
        <label className="flex items-center justify-between px-3 py-2 rounded-md bg-surface-inset border border-border-subtle text-sm w-full">
          <span className="text-text-secondary">Density</span>
          <select
            value={s.appearance.density}
            onChange={(e) => s.setDensity(e.target.value as "comfortable" | "compact")}
            aria-label="Interface density"
            className="bg-surface-base border border-border-subtle rounded px-2 py-1 text-text-primary text-xs"
          >
            <option value="comfortable">Comfortable</option>
            <option value="compact">Compact</option>
          </select>
        </label>
        <p className="text-text-muted text-[11px] mt-2">
          PBOS ships a single dark theme in V1 — there is no light theme to switch to.
        </p>
      </Card>

      {/* --- Data & Storage --- */}
      <Card title="Data & Storage">
        <PersistenceStatusLine />
        <div className="mt-3">
          <Button variant="secondary" onClick={s.restoreInterfaceDefaults}>
            Restore interface defaults
          </Button>
          {s.lastResetResult && (
            <p className="text-status-success text-[11px] mt-2">
              Reset notifications + appearance only. Never touched:{" "}
              {s.lastResetResult.neverAffects.join(", ")} — records, goals and schedule are safe.
            </p>
          )}
        </div>

        <div className="mt-4 border-t border-border-subtle pt-3">
          <div className="text-text-secondary text-xs mb-1">Re-run onboarding</div>
          <p className="text-text-muted text-[11px] mb-2">
            This resets only the setup workflow. Your Goals, Courses, Knowledge, Plans, Money, the
            Obsidian index and AI settings are <strong>not</strong> deleted.
          </p>
          {!confirmReset ? (
            <Button variant="secondary" onClick={() => setConfirmReset(true)}>
              Reset onboarding…
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  await onboarding.resetOnboarding();
                  setConfirmReset(false);
                  setResetNote("Onboarding reset. It will run again on the next launch; your data is intact.");
                }}
                className="px-3 py-1.5 rounded-md bg-status-danger/20 text-status-danger text-xs font-medium"
              >
                Yes, reset onboarding only
              </button>
              <Button variant="secondary" onClick={() => setConfirmReset(false)}>
                Cancel
              </Button>
            </div>
          )}
          {resetNote && (
            <p role="status" className="text-status-success text-[11px] mt-2">
              {resetNote}
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}
