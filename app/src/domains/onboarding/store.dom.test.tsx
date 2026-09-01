// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, act, cleanup } from "@testing-library/react";
import { PerformanceProvider } from "../performance/store";
import { AcademicProvider } from "../academic/store";
import { KnowledgeProvider, useKnowledge } from "../knowledge/store";
import { ObsidianProvider } from "../obsidian/store";
import { FitnessProvider } from "../fitness-recovery/store";
import { RoutineProvider } from "../routine/store";
import { MoneyProvider } from "../money/store";
import { LanguageProvider } from "../language/store";
import { PlanningProvider } from "../planning/store";
import { SettingsProvider, useSettings } from "../settings/store";
import { AnalyticsProvider } from "../analytics/store";
import { AICoachProvider } from "../intelligence/store";
import { OnboardingProvider, useOnboarding } from "./store";

vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => false, invoke: vi.fn() }));

/* eslint-disable react/globals */
let onb: ReturnType<typeof useOnboarding>;
let settings: ReturnType<typeof useSettings>;
let know: ReturnType<typeof useKnowledge>;

function Probe() {
  onb = useOnboarding();
  settings = useSettings();
  know = useKnowledge();
  return <div data-testid="ready">{String(onb.loaded && settings.loaded && know.loaded)}</div>;
}
function Harness() {
  return (
    <PerformanceProvider>
      <AcademicProvider>
        <KnowledgeProvider>
          <ObsidianProvider>
            <FitnessProvider>
              <RoutineProvider>
                <LanguageProvider>
                  <MoneyProvider>
                  <PlanningProvider>
                    <SettingsProvider>
                      <AnalyticsProvider>
                        <AICoachProvider>
                          <OnboardingProvider>
                            <Probe />
                          </OnboardingProvider>
                        </AICoachProvider>
                      </AnalyticsProvider>
                    </SettingsProvider>
                  </PlanningProvider>
                  </MoneyProvider>
                </LanguageProvider>
              </RoutineProvider>
            </FitnessProvider>
          </ObsidianProvider>
        </KnowledgeProvider>
      </AcademicProvider>
    </PerformanceProvider>
  );
}
beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});
async function mount() {
  render(<Harness />);
  await waitFor(() => expect(screen.getByTestId("ready")).toHaveTextContent("true"));
}

describe("Onboarding store — durable first-run, canonical writes, safe reset", () => {
  it("a fresh profile requires onboarding, resuming at welcome", async () => {
    await mount();
    expect(onb.state.status).toBe("not_started");
    expect(onb.resumeStep).toBe("welcome");
    expect(onb.firstBootExperienceSeen).toBe(false);
  });

  it("the current step persists and a remount resumes exactly there", async () => {
    await mount();
    await act(async () => onb.goToNextStep()); // welcome -> personal-setup
    await act(async () => onb.setPersonalSetup({ name: "Bilal", weekdayCapacityMinutes: 120 }));
    await act(async () => onb.goToNextStep()); // -> connect-systems
    expect(onb.state.currentStep).toBe("connect-systems");
    expect(onb.state.status).toBe("in_progress");

    cleanup();
    await mount();
    expect(onb.state.currentStep).toBe("connect-systems");
    expect(onb.personalSetup.name).toBe("Bilal"); // entered data preserved
    expect(onb.resumeStep).toBe("connect-systems");
  });

  it("Launch writes the entered baseline into the CANONICAL Settings store, then marks complete", async () => {
    await mount();
    await act(async () => onb.setPersonalSetup({
      weekdayCapacityMinutes: 150,
      sleepTargetHours: 7,
      defaultMode: "midterm",
    }));
    await act(async () => onb.completeOnboarding());
    await waitFor(() => expect(onb.state.status).toBe("completed"));
    // Settings — not an onboarding-owned copy
    expect(settings.baseConfig.weekdayAcademicCapacityMinutes).toBe(150);
    expect(settings.baseConfig.protectedSleepHours).toBe(7);
    expect(settings.mode).toBe("midterm");
  });

  it("completion is idempotent — reload does not reopen onboarding or duplicate anything", async () => {
    await mount();
    await act(async () => onb.completeOnboarding());
    await act(async () => onb.completeOnboarding()); // twice
    cleanup();
    await mount();
    expect(onb.state.status).toBe("completed");
    expect(onb.resumeStep).toBeNull(); // nothing to resume -> straight to Today
  });

  it("Connect Systems reflects real domain status, not fake connected cards", async () => {
    await mount();
    const byDomain = Object.fromEntries(onb.systemStatuses.map((s) => [s.domain, s.state]));
    expect(byDomain["Academics"]).toBe("not-set-up"); // no courses on a fresh profile
    expect(byDomain["Obsidian"]).toBe("not-set-up"); // no vault connected
    // the built-in deterministic AI provider is genuinely ready
    expect(byDomain["AI Coach"]).toBe("configured");
  });

  it("reset onboarding returns to first-run WITHOUT deleting domain data or Settings", async () => {
    await mount();
    await act(async () => {
      know.createTopic({ title: "Binary Trees", category: "academic", context: "", relatedGoalId: null });
    });
    await act(async () => onb.setPersonalSetup({ defaultMode: "recovery", weekdayCapacityMinutes: 200 }));
    await act(async () => onb.completeOnboarding());
    await waitFor(() => expect(onb.state.status).toBe("completed"));
    expect(settings.mode).toBe("recovery");

    await act(async () => {
      await onb.resetOnboarding();
    });
    expect(onb.state.status).toBe("not_started");
    expect(onb.state.currentStep).toBe("welcome");
    // domain data + the Settings the user just configured both survive
    expect(know.topics).toHaveLength(1);
    expect(settings.mode).toBe("recovery");
    expect(settings.baseConfig.weekdayAcademicCapacityMinutes).toBe(200);
  });
});
