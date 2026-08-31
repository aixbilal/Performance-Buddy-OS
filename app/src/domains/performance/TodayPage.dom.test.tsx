// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { PerformanceProvider, usePerformance } from "./store";
import { PlanningProvider, usePlanning } from "../planning/store";
import { AcademicProvider } from "../academic/store";
import { KnowledgeProvider } from "../knowledge/store";
import { FitnessProvider } from "../fitness-recovery/store";
import { RoutineProvider } from "../routine/store";
import { MoneyProvider } from "../money/store";
import { AnalyticsProvider } from "../analytics/store";
import { AICoachProvider } from "../intelligence/store";
import { TodayPage } from "./TodayPage";

vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => false, invoke: vi.fn() }));

let perf: ReturnType<typeof usePerformance>;
let plan: ReturnType<typeof usePlanning>;

/* eslint-disable react/globals */
function Probe() {
  perf = usePerformance();
  plan = usePlanning();
  return <div data-testid="ready">{String(perf.loaded && plan.loaded)}</div>;
}
function App() {
  return (
    <PerformanceProvider>
      <AcademicProvider>
        <KnowledgeProvider>
          <FitnessProvider>
            <RoutineProvider>
              <MoneyProvider>
                <PlanningProvider>
                  <AnalyticsProvider>
                    <AICoachProvider>
                      <MemoryRouter>
                        <Probe />
                        <TodayPage />
                      </MemoryRouter>
                    </AICoachProvider>
                  </AnalyticsProvider>
                </PlanningProvider>
              </MoneyProvider>
            </RoutineProvider>
          </FitnessProvider>
        </KnowledgeProvider>
      </AcademicProvider>
    </PerformanceProvider>
  );
}

beforeEach(() => window.localStorage.clear());
afterEach(() => window.localStorage.clear());

async function mount() {
  render(<App />);
  await waitFor(() => expect(screen.getByTestId("ready")).toHaveTextContent("true"));
}

const base = {
  domain: "Planning",
  actionId: null as string | null,
  type: "flexible" as const,
  locked: false,
  source: "manual" as const,
  status: "scheduled" as const,
};

describe("TodayPage — canonical Planning integration", () => {
  it("shows the honest open-day state when nothing is scheduled today", async () => {
    await mount();
    expect(await screen.findByText(/your day is open/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /open planner/i })).toBeInTheDocument();
    // never a shaming message
    expect(screen.queryByText(/failed to plan|0 productivity/i)).not.toBeInTheDocument();
  });

  it("renders a canonical block scheduled for today", async () => {
    await mount();
    await plan.createBlock({
      ...base,
      title: "Today session",
      day: 0,
      date: plan.todayIso, // pin to today so it always matches regardless of run weekday
      startMinute: 9 * 60,
      endMinute: 10 * 60,
    });
    await waitFor(() => expect(screen.getByText("Today session")).toBeInTheDocument());
    expect(screen.getByText(/Scheduled Today/i).parentElement).toHaveTextContent(/1 block/);
  });

  it("a block linked to an Action shows the Action's live status and reflects completion", async () => {
    await mount();
    await perf.addAction({ systemId: null, title: "Revise Binary Trees", estMinutes: 30 });
    await waitFor(() => expect(perf.actions).toHaveLength(1));
    const actionId = perf.actions[0].id;
    await plan.createBlock({
      ...base,
      title: "Revise Binary Trees",
      actionId,
      day: 0,
      date: plan.todayIso,
      startMinute: 8 * 60,
      endMinute: 9 * 60,
    });
    await waitFor(() => expect(screen.getAllByText(/Revise Binary Trees/).length).toBeGreaterThan(0));
    // not done yet -> Start Focus offered, no "Action done"
    expect(screen.getByRole("button", { name: /start focus/i })).toBeInTheDocument();
    expect(screen.queryByText(/Action done/)).not.toBeInTheDocument();

    // mark the canonical Action done -> Today reflects it, block still present
    await perf.setActionStatus(actionId, "done");
    await waitFor(() => expect(screen.getByText(/Action done/)).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /start focus/i })).not.toBeInTheDocument();
    expect(plan.blocks).toHaveLength(1); // planning history kept
  });

  it("does not keep a second scheduling array — Today reads usePlanning().todaysBlocks", async () => {
    await mount();
    await plan.createBlock({ ...base, title: "X", day: 0, date: plan.todayIso, startMinute: 600, endMinute: 660 });
    await waitFor(() => expect(plan.todaysBlocks).toHaveLength(1));
    expect(screen.getByText("X")).toBeInTheDocument();
  });
});
