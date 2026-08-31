// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { PerformanceProvider, usePerformance } from "../performance/store";
import { PlanningProvider, usePlanning } from "./store";
import { PlannerPage } from "./PlannerPage";

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
          <PlannerPage />
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

async function addBlock(user: ReturnType<typeof userEvent.setup>, title: string, start: string, end: string, day = "Mon") {
  await user.clear(screen.getByLabelText("Block title"));
  await user.type(screen.getByLabelText("Block title"), title);
  await user.selectOptions(screen.getByLabelText("Weekday"), day);
  await user.clear(screen.getByLabelText("Start time"));
  await user.type(screen.getByLabelText("Start time"), start);
  await user.clear(screen.getByLabelText("End time"));
  await user.type(screen.getByLabelText("End time"), end);
  await user.click(screen.getByRole("button", { name: /^add block$/i }));
}

describe("PlannerPage — Plan Builder + conflict/capacity + Generate/Apply", () => {
  it("adds a manual block and shows it in This Week", async () => {
    const user = userEvent.setup();
    await mount();
    await addBlock(user, "DS Mastery", "14:00", "15:00");
    await waitFor(() => expect(plan.blocks).toHaveLength(1));
    expect(screen.getByText(/Mon 14:00–15:00 · DS Mastery/)).toBeInTheDocument();
  });

  it("reports Could Not Fit for an overlapping block and does not save it", async () => {
    const user = userEvent.setup();
    await mount();
    await addBlock(user, "Block A", "14:00", "15:00");
    await waitFor(() => expect(plan.blocks).toHaveLength(1));
    await addBlock(user, "Block B", "14:30", "15:30");
    await waitFor(() =>
      expect(screen.getByTestId("planner-feedback")).toHaveTextContent(/Could Not Fit/i),
    );
    expect(plan.blocks).toHaveLength(1); // not saved
  });

  it("lock/unlock toggles the block's locked flag", async () => {
    const user = userEvent.setup();
    await mount();
    await addBlock(user, "Lockme", "09:00", "10:00");
    await waitFor(() => expect(plan.blocks).toHaveLength(1));
    await user.click(screen.getByRole("button", { name: /^lock /i }));
    await waitFor(() => expect(plan.blocks[0].locked).toBe(true));
    await user.click(screen.getByRole("button", { name: /^unlock /i }));
    await waitFor(() => expect(plan.blocks[0].locked).toBe(false));
  });

  it("capacity editor persists a new weekly limit", async () => {
    const user = userEvent.setup();
    await mount();
    const weekly = screen.getByLabelText(/weekly capacity in hours/i);
    await user.clear(weekly);
    await user.type(weekly, "10");
    await user.click(screen.getByRole("button", { name: /save capacity/i }));
    await waitFor(() => expect(plan.capacity.weeklyCapacityMinutes).toBe(600));
  });

  it("Generate produces a proposal that does NOT mutate canonical blocks until Apply; Apply preserves the locked block", async () => {
    const user = userEvent.setup();
    await mount();

    // seed: one manual locked block + a linked Action to schedule
    await addBlock(user, "Protected AM", "08:00", "09:00");
    await waitFor(() => expect(plan.blocks).toHaveLength(1));
    await user.click(screen.getByRole("button", { name: /^lock /i }));
    await waitFor(() => expect(plan.blocks[0].locked).toBe(true));

    // a schedulable Action (direct commitment) via the store
    await perf.addAction({ systemId: null, title: "Revise Binary Trees", estMinutes: 60 });
    await waitFor(() => expect(perf.actions.some((a) => a.title === "Revise Binary Trees")).toBe(true));

    // pick it + generate
    await user.click(await screen.findByLabelText(/include revise binary trees in the generated plan/i));
    await user.click(screen.getByRole("button", { name: /generate proposal/i }));

    // proposal visible, but canonical blocks unchanged (still just the locked one)
    expect(await screen.findByText(/Proposed changes — review before applying/)).toBeInTheDocument();
    expect(plan.blocks).toHaveLength(1);
    expect(plan.blocks[0].title).toBe("Protected AM");

    // Apply
    await user.click(screen.getByRole("button", { name: /^apply$/i }));
    await waitFor(() => expect(plan.blocks.length).toBeGreaterThan(1));
    // locked manual block survived byte-for-byte
    const locked = plan.blocks.find((b) => b.title === "Protected AM")!;
    expect(locked.locked).toBe(true);
    expect(locked.source).toBe("manual");
    // a generated block for the Action now exists
    const gen = plan.blocks.find((b) => b.source === "generated");
    expect(gen?.actionId).toBe(perf.actions.find((a) => a.title === "Revise Binary Trees")!.id);
    // the Action itself is NOT completed by scheduling
    expect(perf.actions.find((a) => a.title === "Revise Binary Trees")!.status).not.toBe("done");
  });
});
