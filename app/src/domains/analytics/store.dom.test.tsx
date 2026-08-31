// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, act, cleanup } from "@testing-library/react";
import { AcademicProvider } from "../academic/store";
import { FitnessProvider } from "../fitness-recovery/store";
import { MoneyProvider } from "../money/store";
import { RoutineProvider, useRoutine } from "../routine/store";
import { AnalyticsProvider, useAnalytics } from "./store";

vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => false, invoke: vi.fn() }));

/* eslint-disable react/globals */
let analytics: ReturnType<typeof useAnalytics>;
let routine: ReturnType<typeof useRoutine>;

function Probe() {
  analytics = useAnalytics();
  routine = useRoutine();
  return <div data-testid="ready">{String(analytics.loaded && routine.loaded)}</div>;
}
function Harness() {
  return (
    <AcademicProvider>
      <FitnessProvider>
        <MoneyProvider>
          <RoutineProvider>
            <AnalyticsProvider>
              <Probe />
            </AnalyticsProvider>
          </RoutineProvider>
        </MoneyProvider>
      </FitnessProvider>
    </AcademicProvider>
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

describe("Analytics store — durable reviews, honest no-data", () => {
  it("fresh profile: domain snapshots are honest, patterns report insufficient evidence", async () => {
    await mount();
    expect(analytics.domainSnapshots.find((s) => s.domain === "Academics")?.headline).toMatch(
      /No graded courses yet/,
    );
    expect(analytics.patterns[0].insufficient).toBe(true);
    const snap = analytics.weeklySnapshot();
    expect(snap.routineCompletion.rate).toBeNull(); // unknown ≠ zero
    expect(snap.dataSufficiency).toBe("insufficient");
  });

  it("logging a weekly review persists it as an immutable snapshot across reload", async () => {
    await mount();
    await act(async () => {
      await analytics.logWeeklyReview(["Shipped batch 6"], ["Missed a routine"]);
    });
    await waitFor(() => expect(analytics.weeklyReviews).toHaveLength(1));
    const id = analytics.weeklyReviews[0].id;

    // remount → the review reloads from the LocalRepo
    cleanup();
    await mount();
    await waitFor(() => expect(analytics.weeklyReviews.some((r) => r.id === id)).toBe(true));
    expect(analytics.weeklyReviews[0].wins).toEqual(["Shipped batch 6"]);
  });

  it("monthly comparison is 'insufficient' with no complete prior month, never 0%", async () => {
    await mount();
    const cmp = analytics.monthlyComparisons();
    expect(cmp[0].status).toBe("insufficient");
    expect(cmp[0].current).toBeNull();
  });

  it("logging a monthly review persists and stays frozen", async () => {
    await mount();
    await act(async () => {
      await analytics.logMonthlyReview(["Steady month"]);
    });
    await waitFor(() => expect(analytics.monthlyReviews).toHaveLength(1));
    // logging again in the same month does not create a duplicate (id is month-keyed)
    await act(async () => {
      await analytics.logMonthlyReview(["different note"]);
    });
    expect(analytics.monthlyReviews).toHaveLength(1);
    expect(analytics.monthlyReviews[0].observations).toEqual(["Steady month"]);
    void routine;
  });
});
