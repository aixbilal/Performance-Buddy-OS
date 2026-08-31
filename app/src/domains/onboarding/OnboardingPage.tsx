import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";
import { useOnboarding } from "./store";
import { STEP_ORDER } from "./engine";
import type { OperatingMode } from "../settings/types";

const STATE_TONE = {
  configured: "success",
  partial: "warning",
  "not-set-up": "neutral",
  "disabled-optional": "neutral",
} as const;
const STATE_LABEL = {
  configured: "Configured",
  partial: "Partial",
  "not-set-up": "Not set up",
  "disabled-optional": "Optional — not connected",
} as const;

const STEP_TITLE: Record<string, string> = {
  welcome: "Welcome",
  "personal-setup": "Personal setup",
  "connect-systems": "Connect your systems",
  "review-launch": "Review & launch",
};
const PRIORITY_OPTIONS = ["Academics", "Development", "Fitness", "Language", "Knowledge"];
const MODES: OperatingMode[] = ["normal", "midterm", "final", "recovery"];

export function OnboardingPage() {
  const navigate = useNavigate();
  const {
    loaded,
    state,
    personalSetup,
    setPersonalSetup,
    systemChoices,
    setSystemChoice,
    goToNextStep,
    goToPrevStep,
    stepIndex,
    totalSteps,
    systemStatuses,
    resumeStep,
    launchCheck,
    completeOnboarding,
    simulateRelaunch,
  } = useOnboarding();

  const step = state.currentStep;
  const headingRef = useRef<HTMLHeadingElement>(null);

  // A completed profile should never sit on the wizard.
  useEffect(() => {
    if (loaded && (state.status === "completed" || state.status === "skipped")) {
      navigate("/", { replace: true });
    }
  }, [loaded, state.status, navigate]);

  // move focus to the step heading after each step change (§44)
  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  const togglePriority = (p: string) => {
    const has = personalSetup.priorities.includes(p);
    setPersonalSetup({
      priorities: has
        ? personalSetup.priorities.filter((x) => x !== p)
        : [...personalSetup.priorities, p],
    });
  };

  const launch = () => {
    completeOnboarding();
    navigate("/", { replace: true });
  };

  return (
    <div className="min-h-screen bg-surface-base px-6 py-10">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <div className="text-text-secondary text-xs tracking-wide">Performance Buddy OS · Setup</div>
          <ol className="flex gap-2 mt-2" aria-label="Onboarding progress">
            {STEP_ORDER.map((s, i) => (
              <li
                key={s}
                aria-current={s === step ? "step" : undefined}
                className={`flex-1 rounded-full h-1.5 ${
                  i <= stepIndex ? "bg-action-primary" : "bg-surface-overlay"
                }`}
              />
            ))}
          </ol>
          <p className="text-text-secondary text-xs mt-1">
            Step {stepIndex + 1} of {totalSteps} — {STEP_TITLE[step]}
          </p>
        </div>

        {state.status === "in_progress" && step !== "welcome" && (
          <div
            role="status"
            className="bg-surface-inset border border-border-subtle rounded-md px-4 py-2 text-xs text-text-secondary"
          >
            Setup is in progress. If you close PBOS now it resumes here ({resumeStep}) — nothing you
            entered is lost.
          </div>
        )}

        {step === "welcome" && (
          <Card>
            <h2 ref={headingRef} tabIndex={-1} className="text-text-primary text-xl font-semibold outline-none">
              Welcome
            </h2>
            <p className="text-text-secondary text-sm my-3">
              Plan → Act → Evidence → Understand → Adjust. Goals become Systems and Actions; PBOS
              keeps what you planned separate from what actually happened. AI interprets and
              recommends — you stay in control. Everything core is local-first; external AI is
              optional and off by default.
            </p>
            <p className="text-text-secondary text-xs mb-4">
              No account, no cloud sign-up. This is your machine.
            </p>
            <button
              onClick={goToNextStep}
              className="px-3 py-1.5 rounded-md bg-action-primary text-text-inverse text-xs font-medium"
            >
              {state.status === "in_progress" ? "Resume setup" : "Start setup"}
            </button>
          </Card>
        )}

        {step === "personal-setup" && (
          <Card>
            <h2 ref={headingRef} tabIndex={-1} className="text-text-primary text-xl font-semibold outline-none">
              Personal setup
            </h2>
            <p className="text-text-secondary text-xs mt-1 mb-4">
              A minimum useful baseline — this writes into your canonical Settings, not a separate
              onboarding copy. You can change all of it later in Settings.
            </p>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <label className="text-text-secondary text-xs">
                Name (optional)
                <input
                  value={personalSetup.name}
                  onChange={(e) => setPersonalSetup({ name: e.target.value })}
                  className="block mt-1 w-full bg-surface-inset border border-border-subtle rounded px-2 py-1.5 text-text-primary text-sm outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
                />
              </label>
              <label className="text-text-secondary text-xs">
                Protected sleep (hours)
                <input
                  type="number"
                  min={4}
                  max={12}
                  value={personalSetup.sleepTargetHours}
                  onChange={(e) =>
                    setPersonalSetup({ sleepTargetHours: parseFloat(e.target.value) || 0 })
                  }
                  className="block mt-1 w-full bg-surface-inset border border-border-subtle rounded px-2 py-1.5 text-text-primary text-sm outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
                />
              </label>
              <label className="text-text-secondary text-xs">
                Weekday academic capacity (minutes)
                <input
                  type="number"
                  min={0}
                  max={600}
                  value={personalSetup.weekdayCapacityMinutes}
                  onChange={(e) =>
                    setPersonalSetup({ weekdayCapacityMinutes: parseInt(e.target.value, 10) || 0 })
                  }
                  className="block mt-1 w-full bg-surface-inset border border-border-subtle rounded px-2 py-1.5 text-text-primary text-sm outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
                />
              </label>
              <label className="text-text-secondary text-xs">
                Starting operating mode
                <select
                  value={personalSetup.defaultMode}
                  onChange={(e) =>
                    setPersonalSetup({ defaultMode: e.target.value as OperatingMode })
                  }
                  className="block mt-1 w-full bg-surface-inset border border-border-subtle rounded px-2 py-1.5 text-text-primary text-sm outline-none focus-visible:ring-2 focus-visible:ring-border-focus capitalize"
                >
                  {MODES.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <fieldset className="mb-4">
              <legend className="text-text-secondary text-xs mb-2">
                Initial priorities (affects Planner prominence only — does not disable any domain)
              </legend>
              <div className="flex gap-2 flex-wrap">
                {PRIORITY_OPTIONS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    aria-pressed={personalSetup.priorities.includes(p)}
                    onClick={() => togglePriority(p)}
                    className={`px-3 py-1 rounded-md text-xs ${
                      personalSetup.priorities.includes(p)
                        ? "bg-action-primary text-text-inverse"
                        : "bg-surface-inset text-text-secondary"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </fieldset>
            <StepNav onBack={goToPrevStep} onNext={goToNextStep} />
          </Card>
        )}

        {step === "connect-systems" && (
          <Card>
            <h2 ref={headingRef} tabIndex={-1} className="text-text-primary text-xl font-semibold outline-none">
              Connect your systems
            </h2>
            <p className="text-text-secondary text-xs mt-1 mb-4">
              This reads the real status of each domain — nothing here is a fake "connected" card.
              Optional systems can be left for later; none of them block launch.
            </p>
            <ul className="space-y-2 mb-4">
              {systemStatuses.map((s) => (
                <li
                  key={s.domain}
                  className="flex items-center justify-between py-1.5 border-b border-border-subtle last:border-0 text-sm"
                >
                  <span className="text-text-primary">
                    {s.domain}{" "}
                    {s.isOptional && (
                      <span className="text-text-secondary text-[10px]">(optional)</span>
                    )}
                  </span>
                  <div className="flex items-center gap-2">
                    <Badge tone={STATE_TONE[s.state]}>{STATE_LABEL[s.state]}</Badge>
                    {s.domain === "Obsidian" && s.state !== "configured" && (
                      <>
                        <button
                          onClick={() => navigate("/knowledge/notes")}
                          className="text-text-secondary text-[11px] underline hover:text-text-primary"
                        >
                          Connect
                        </button>
                        <button
                          onClick={() => setSystemChoice("obsidian", "skipped")}
                          aria-label="Skip Obsidian for now"
                          className="text-text-secondary text-[11px] underline hover:text-text-secondary"
                        >
                          Skip
                        </button>
                      </>
                    )}
                    {s.domain === "AI Coach" && s.state !== "configured" && (
                      <>
                        <button
                          onClick={() => navigate("/ai-coach/permissions")}
                          className="text-text-secondary text-[11px] underline hover:text-text-primary"
                        >
                          Set up
                        </button>
                        <button
                          onClick={() => setSystemChoice("ai", "skipped")}
                          aria-label="Skip AI Coach for now"
                          className="text-text-secondary text-[11px] underline hover:text-text-secondary"
                        >
                          Skip
                        </button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <StepNav onBack={goToPrevStep} onNext={goToNextStep} />
          </Card>
        )}

        {step === "review-launch" && (
          <Card>
            <h2 ref={headingRef} tabIndex={-1} className="text-text-primary text-xl font-semibold outline-none">
              Review &amp; launch
            </h2>
            <dl className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm my-4">
              <Row k="Name" v={personalSetup.name || "—"} />
              <Row k="Starting mode" v={personalSetup.defaultMode} />
              <Row k="Protected sleep" v={`${personalSetup.sleepTargetHours}h`} />
              <Row k="Weekday capacity" v={`${personalSetup.weekdayCapacityMinutes} min`} />
              <Row
                k="Priorities"
                v={personalSetup.priorities.join(", ") || "none selected"}
              />
              <Row
                k="Obsidian"
                v={
                  systemStatuses.find((s) => s.domain === "Obsidian")?.state === "configured"
                    ? "connected"
                    : systemChoices.obsidian === "skipped"
                      ? "skipped for now"
                      : "not connected"
                }
              />
              <Row
                k="AI Coach"
                v={
                  systemStatuses.find((s) => s.domain === "AI Coach")?.state === "configured"
                    ? "ready"
                    : systemChoices.ai === "skipped"
                      ? "skipped for now"
                      : "not configured"
                }
              />
            </dl>

            <div className="bg-surface-inset border border-border-subtle rounded-md p-3 mb-4">
              <div className="text-text-secondary text-xs mb-1">Launch readiness</div>
              <Badge tone={launchCheck.canLaunch ? "success" : "danger"}>
                {launchCheck.canLaunch ? "Ready to launch" : `Blocked: ${launchCheck.blockers.join(", ")}`}
              </Badge>
              <p className="text-text-secondary text-[11px] mt-2">
                Optional systems being unconfigured is legitimate and does not block launch.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={goToPrevStep}
                className="px-3 py-1.5 rounded-md bg-action-secondary text-text-primary text-xs font-medium"
              >
                Back
              </button>
              <button
                onClick={launch}
                disabled={!launchCheck.canLaunch}
                className="px-3 py-1.5 rounded-md bg-action-primary text-text-inverse text-xs font-medium disabled:opacity-50"
              >
                Launch PBOS
              </button>
            </div>
          </Card>
        )}

        <div className="text-center">
          <button
            onClick={simulateRelaunch}
            className="text-text-secondary text-[11px] underline hover:text-text-secondary"
          >
            Simulate relaunch (replays the startup gate in place)
          </button>
        </div>
      </div>
    </div>
  );
}

function StepNav({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  return (
    <div className="flex gap-2">
      <button
        onClick={onBack}
        className="px-3 py-1.5 rounded-md bg-action-secondary text-text-primary text-xs font-medium"
      >
        Back
      </button>
      <button
        onClick={onNext}
        className="px-3 py-1.5 rounded-md bg-action-primary text-text-inverse text-xs font-medium"
      >
        Continue
      </button>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt className="text-text-secondary">{k}</dt>
      <dd className="text-text-primary capitalize">{v}</dd>
    </>
  );
}
