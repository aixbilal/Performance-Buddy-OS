// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { PerformanceProvider, usePerformance } from "../performance/store";
import { PlanningProvider, usePlanning } from "./store";
import { CalendarWeekPage } from "./CalendarWeekPage";
import { isoDateOf, startOfWeekIso, addDaysIso, mondayIndexOf } from "./engine";

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
      <PlanningProvider>
        <MemoryRouter>
          <Probe />
          <CalendarWeekPage />
        </MemoryRouter>
      </PlanningProvider>
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

describe("CalendarWeekPage — a view over canonical Planning Blocks", () => {
  it("renders a 7-day grid with an honest empty state and no fixture data", async () => {
    await mount();
    expect(screen.getByRole("heading", { name: "Calendar" })).toBeInTheDocument();
    for (const d of ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]) {
      expect(screen.getAllByText(d).length).toBeGreaterThan(0);
    }
    expect(plan.blocks).toHaveLength(0);
  });

  it("a dated block shows only in the week containing its exact date", async () => {
    await mount();
    const thisMon = startOfWeekIso(isoDateOf(new Date()));
    const wedThisWeek = addDaysIso(thisMon, 2);
    await plan.createBlock({
      ...base,
      title: "Dated Wed block",
      day: mondayIndexOf(wedThisWeek),
      date: wedThisWeek,
      startMinute: 600,
      endMinute: 660,
    });
    await waitFor(() => expect(screen.getByText("Dated Wed block")).toBeInTheDocument());

    // move to next week — the dated block must disappear
    await userEvent.setup().click(screen.getByRole("button", { name: /next week/i }));
    await waitFor(() => expect(screen.queryByText("Dated Wed block")).not.toBeInTheDocument());
  });

  it("an undated block recurs — visible in this week and the next", async () => {
    await mount();
    await plan.createBlock({
      ...base,
      title: "Weekly Tue block",
      day: 1, // Tuesday
      date: null,
      startMinute: 540,
      endMinute: 600,
    });
    await waitFor(() => expect(screen.getByText("Weekly Tue block")).toBeInTheDocument());
    await userEvent.setup().click(screen.getByRole("button", { name: /next week/i }));
    expect(screen.getByText("Weekly Tue block")).toBeInTheDocument();
  });

  it("a block linked to an Action shows the Action's live status; a deleted Action leaves the block as history", async () => {
    await mount();
    await perf.addAction({ systemId: null, title: "Linked task", estMinutes: 30 });
    await waitFor(() => expect(perf.actions).toHaveLength(1));
    const actionId = perf.actions[0].id;
    await plan.createBlock({
      ...base,
      title: "Linked block",
      actionId,
      day: 0,
      date: null,
      startMinute: 600,
      endMinute: 660,
    });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /Linked block, 10:00 to 11:00/i }));
    expect(await screen.findByText(/Linked Action:/)).toBeInTheDocument();
    expect(screen.getByText(/read live; not copied here/i)).toBeInTheDocument();

    // delete the Action → the block survives; the panel shows history wording
    // and never crashes on the now-unresolvable actionId. (In the packaged app
    // the FK SET NULLs the column; in browser dev the store keeps the stale id
    // and the UI resolves it to "deleted" — either way the block stays.)
    await perf.deleteAction(actionId);
    await waitFor(() => expect(perf.actions).toHaveLength(0));
    await user.click(screen.getByRole("button", { name: /Linked block, 10:00 to 11:00/i }));
    expect(await screen.findByText(/linked Action was deleted/i)).toBeInTheDocument();
    expect(plan.blocks).toHaveLength(1);
  });

  it("week navigation is labelled and returns to the current week", async () => {
    await mount();
    const user = userEvent.setup();
    const current = plan.weekStartIso;
    await user.click(screen.getByRole("button", { name: /next week/i }));
    await waitFor(() => expect(plan.weekStartIso).not.toBe(current));
    await user.click(screen.getByRole("button", { name: /go to current week/i }));
    await waitFor(() => expect(plan.weekStartIso).toBe(current));
  });
});
