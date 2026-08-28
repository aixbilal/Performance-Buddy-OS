import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";
import { useOnboarding } from "./store";

const STATE_TONE = {
  configured: "success",
  partial: "warning",
  "not-set-up": "neutral",
  "disabled-optional": "neutral",
} as const;

const STATE_LABEL = {
  configured: "Configured",
  partial: "Partial",
  "not-set-up": "Not Set Up",
  "disabled-optional": "Disabled / Optional",
} as const;

const PRIORITY_OPTIONS = ["Academics", "Development", "Fitness", "Language", "Knowledge"];

export function OnboardingPage() {
  const { state, personalSetup, setPersonalSetup, goToNextStep, saveAndExit, systemStatuses, resumeStep, startupRoute, launchCheck, completeOnboarding, simulateRelaunch } =
    useOnboarding();

  const togglePriority = (p: string) => {
    const has = personalSetup.priorities.includes(p);
    setPersonalSetup({ priorities: has ? personalSetup.priorities.filter((x) => x !== p) : [...personalSetup.priorities, p] });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-text-primary text-xl font-semibold">Onboarding</h2>
        <p className="text-text-muted text-sm">Status: {state.status.replace("_", " ")} · Step: {state.currentStep}</p>
      </div>

      <div className="bg-surface-inset border border-border-subtle rounded-md px-4 py-3 text-xs text-text-muted">
        Resume step if interrupted right now: <b className="text-text-secondary">{resumeStep ?? "none — would go straight to Today"}</b>{" "}
        · Startup route this state would produce: <b className="text-text-secondary">{startupRoute}</b>
      </div>

      <div className="flex items-center justify-between bg-surface-inset border border-border-subtle rounded-md px-4 py-3">
        <p className="text-text-disabled text-[11px]">
          No real disk persistence exists yet, so a genuine app restart can't be demonstrated. This button
          replays the Day 15B splash/routing gate in place, using your current onboarding status — the
          cinematic splash will NOT replay (first-boot already seen), only the short splash + correct
          destination will.
        </p>
        <button onClick={simulateRelaunch} className="shrink-0 ml-3 px-3 py-1.5 rounded-md bg-action-secondary text-text-primary text-xs font-medium">
          Simulate Relaunch
        </button>
      </div>

      {state.currentStep === "welcome" && (
        <Card title="Welcome">
          <p className="text-text-secondary text-sm mb-3">
            Plan → Act → Evidence → Understand → Adjust. Goals become Systems and Actions. PBOS separates what
            you planned from what actually happened. AI interprets and recommends — you stay in control. The
            core is local-first; external AI is optional.
          </p>
          <button onClick={goToNextStep} className="px-3 py-1.5 rounded-md bg-action-primary text-text-inverse text-xs font-medium">
            Get Started
          </button>
        </Card>
      )}

      {state.currentStep === "personal-setup" && (
        <Card title="Personal Setup">
          <p className="text-text-disabled text-[11px] mb-3">Minimum useful baseline only — not a full configuration of every domain.</p>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="text-text-muted text-xs block mb-1">Name</label>
              <input
                value={personalSetup.name}
                onChange={(e) => setPersonalSetup({ name: e.target.value })}
                className="w-full bg-surface-inset border border-border-subtle rounded-md px-2 py-1.5 text-text-primary text-sm"
              />
            </div>
            <div>
              <label className="text-text-muted text-xs block mb-1">Sleep target (hours)</label>
              <input
                type="number"
                value={personalSetup.sleepTargetHours}
                onChange={(e) => setPersonalSetup({ sleepTargetHours: parseFloat(e.target.value) || 0 })}
                className="w-full bg-surface-inset border border-border-subtle rounded-md px-2 py-1.5 text-text-primary text-sm"
              />
            </div>
          </div>
          <label className="text-text-muted text-xs block mb-2">
            Initial priorities (affects Planner prominence only — does not disable other domains)
          </label>
          <div className="flex gap-2 mb-4 flex-wrap">
            {PRIORITY_OPTIONS.map((p) => (
              <button
                key={p}
                onClick={() => togglePriority(p)}
                className={`px-3 py-1 rounded-md text-xs ${
                  personalSetup.priorities.includes(p) ? "bg-action-primary text-text-inverse" : "bg-surface-inset text-text-secondary"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={goToNextStep} className="px-3 py-1.5 rounded-md bg-action-primary text-text-inverse text-xs font-medium">
              Continue
            </button>
            <button onClick={saveAndExit} className="px-3 py-1.5 rounded-md bg-action-secondary text-text-primary text-xs font-medium">
              Save &amp; Exit
            </button>
          </div>
        </Card>
      )}

      {state.currentStep === "connect-systems" && (
        <Card title="Connect Your Systems">
          <p className="text-text-disabled text-[11px] mb-3">
            Reads real state from each domain's own store — not a duplicate onboarding-only model. Each system
            is independent; none are required to launch.
          </p>
          <div className="space-y-2 mb-4">
            {systemStatuses.map((s) => (
              <div key={s.domain} className="flex items-center justify-between py-1.5 border-b border-border-subtle last:border-0 text-sm">
                <span className="text-text-primary">
                  {s.domain} {s.isOptional && <span className="text-text-disabled text-[10px]">(optional)</span>}
                </span>
                <Badge tone={STATE_TONE[s.state]}>{STATE_LABEL[s.state]}</Badge>
              </div>
            ))}
          </div>
          <button onClick={goToNextStep} className="px-3 py-1.5 rounded-md bg-action-primary text-text-inverse text-xs font-medium">
            Continue
          </button>
        </Card>
      )}

      {state.currentStep === "review-launch" && (
        <Card title="Review & Launch">
          <div className="space-y-2 mb-4 text-sm">
            <div className="flex justify-between"><span className="text-text-muted">Name</span><span className="text-text-primary">{personalSetup.name || "—"}</span></div>
            <div className="flex justify-between"><span className="text-text-muted">Sleep target</span><span className="text-text-primary">{personalSetup.sleepTargetHours}h</span></div>
            <div className="flex justify-between"><span className="text-text-muted">Priorities</span><span className="text-text-primary">{personalSetup.priorities.join(", ") || "None selected"}</span></div>
          </div>

          <div className="bg-surface-inset border border-border-subtle rounded-md p-3 mb-4">
            <div className="text-text-muted text-xs mb-1">Launch Readiness</div>
            <Badge tone={launchCheck.canLaunch ? "success" : "danger"}>
              {launchCheck.canLaunch ? "Ready to Launch" : "Blocked"}
            </Badge>
            <p className="text-text-disabled text-[10px] mt-2">
              "Ready to Launch," not "100% Complete" — partial/optional configuration (Money, Obsidian, AI all
              disabled above) is legitimate and does not block this.
            </p>
          </div>

          <button
            onClick={completeOnboarding}
            disabled={!launchCheck.canLaunch}
            className="px-3 py-1.5 rounded-md bg-action-primary text-text-inverse text-xs font-medium disabled:opacity-50"
          >
            Launch PBOS
          </button>
        </Card>
      )}

      {state.status === "completed" && (
        <Card title="Onboarding Complete">
          <p className="text-text-secondary text-sm">
            Completed at {state.completedAt}. On a real launch, this state means Welcome is never shown again —
            startup routes straight to Today.
          </p>
        </Card>
      )}
    </div>
  );
}
