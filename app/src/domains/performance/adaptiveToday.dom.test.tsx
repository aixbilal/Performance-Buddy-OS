// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, act, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { RevisionProvider } from "../revision/store";
import { PerformanceProvider } from "./store";
import { AcademicProvider } from "../academic/store";
import { KnowledgeProvider } from "../knowledge/store";
import { FitnessProvider } from "../fitness-recovery/store";
import { RoutineProvider } from "../routine/store";
import { MoneyProvider } from "../money/store";
import { LanguageProvider } from "../language/store";
import { AnalyticsProvider } from "../analytics/store";
import { AICoachProvider } from "../intelligence/store";
import { FocusProvider } from "../focus/store";
import { PlanningProvider, usePlanning } from "../planning/store";
import { TodayPage } from "./TodayPage";

vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => false, invoke: vi.fn() }));

/* eslint-disable react/globals */
let plan: ReturnType<typeof usePlanning>;
function Probe() {
  plan = usePlanning();
  return <div data-testid="ready">{String(plan.loaded)}</div>;
}
function App() {
  return (
    <RevisionProvider>
      <PerformanceProvider>
        <AcademicProvider>
          <KnowledgeProvider>
            <FitnessProvider>
              <RoutineProvider>
                <LanguageProvider>
                  <MoneyProvider>
                  <PlanningProvider>
                    <AnalyticsProvider>
                      <AICoachProvider>
                        <FocusProvider>
                          <MemoryRouter>
                            <Probe />
                            <TodayPage />
                          </MemoryRouter>
                        </FocusProvider>
                      </AICoachProvider>
                    </AnalyticsProvider>
                  </PlanningProvider>
                  </MoneyProvider>
                </LanguageProvider>
              </RoutineProvider>
            </FitnessProvider>
          </KnowledgeProvider>
        </AcademicProvider>
      </PerformanceProvider>
    </RevisionProvider>
  );
}

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

async function mount() {
  render(<App />);
  await waitFor(() => expect(screen.getByTestId("ready")).toHaveTextContent("true"));
}

const base = {
  domain: "Academics",
  actionId: null as string | null,
  type: "flexible" as const,
  locked: false,
  source: "manual" as const,
  status: "scheduled" as const,
};

describe("Adaptive Today", () => {
  it("a valid plan with nothing elapsed shows no 'Adaptation needed' card", async () => {
    await mount();
    await act(async () => {
      await plan.createBlock({
        ...base,
        title: "Deep work",
        day: 0,
        date: plan.todayIso,
        startMinute: 0,
        endMinute: 24 * 60, // spans now → active, valid
      });
    });
    await waitFor(() => expect(screen.getAllByText("Deep work").length).toBeGreaterThan(0));
    expect(screen.queryByText(/Adaptation needed/i)).not.toBeInTheDocument();
  });

  it("a block that has fully elapsed without evidence surfaces 'Adaptation needed'", async () => {
    await mount();
    await act(async () => {
      await plan.createBlock({
        ...base,
        title: "Missed-looking block",
        day: 0,
        date: plan.todayIso,
        startMinute: 0,
        endMinute: 1, // ends at 00:01 → always in the past by run time
      });
    });
    await waitFor(() => expect(screen.getByText(/Adaptation needed/i)).toBeInTheDocument());
    expect(screen.getByText(/without being resolved/i)).toBeInTheDocument();
    // resolving it clears the adaptation
    await act(async () => {
      const block = plan.blocks.find((b) => b.title === "Missed-looking block")!;
      await plan.resolveOccurrence(block.id, plan.todayIso, "skipped");
    });
    await waitFor(() => expect(screen.queryByText(/Adaptation needed/i)).not.toBeInTheDocument());
  });

  it("the capacity control persists the subjective level and never writes Planner capacity", async () => {
    await mount();
    const before = plan.capacity;
    await act(async () => {
      screen.getByRole("button", { name: "low" }).click();
    });
    await waitFor(() =>
      expect(window.localStorage.getItem("pbos:today-operating-state-v2")).toContain('"capacityLevel":"low"'),
    );
    expect(plan.capacity).toEqual(before); // Planner capacity untouched
  });
});
