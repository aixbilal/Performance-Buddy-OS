// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => false, invoke: vi.fn() }));

import { RevisionProvider, useRevision } from "./store";
import { __resetRevisionRecorderForTest } from "./recorder";
import { PerformanceProvider, usePerformance } from "../performance/store";

function Harness() {
  const { createGoal, transitionGoal } = usePerformance();
  const { events, eventsFor } = useRevision();
  const [goalId, setGoalId] = useState<string | null>(null);
  return (
    <div>
      <button
        onClick={async () => {
          const r = await createGoal({ title: "Ship V1", type: "outcome", domain: "development", priority: "high", deadline: null, detail: "", metric: null });
          if (r.ok) setGoalId(r.id);
        }}
      >
        create
      </button>
      {goalId && (
        <button onClick={() => transitionGoal(goalId, "paused")}>pause</button>
      )}
      <span data-testid="total">{events.length}</span>
      <span data-testid="goal-events">{eventsFor({ domain: "performance", entityType: "goal" }).length}</span>
      <span data-testid="latest-op">{events[0]?.operation ?? "—"}</span>
      <span data-testid="latest-source">{events[0]?.source ?? "—"}</span>
      <span data-testid="latest-summary">{events[0]?.summary ?? "—"}</span>
    </div>
  );
}

beforeEach(() => {
  window.localStorage.clear();
  __resetRevisionRecorderForTest();
});

describe("revision wiring — performance mutations append audit events", () => {
  it("a real Goal create + lifecycle change each record one immutable event", async () => {
    const user = userEvent.setup();
    render(
      <RevisionProvider>
        <PerformanceProvider>
          <Harness />
        </PerformanceProvider>
      </RevisionProvider>,
    );

    await user.click(screen.getByRole("button", { name: "create" }));
    await waitFor(() => expect(screen.getByTestId("goal-events").textContent).toBe("1"));
    expect(screen.getByTestId("latest-op").textContent).toBe("create");

    await user.click(await screen.findByRole("button", { name: "pause" }));
    await waitFor(() => expect(screen.getByTestId("goal-events").textContent).toBe("2"));

    expect(screen.getByTestId("total").textContent).toBe("2");
    expect(screen.getByTestId("latest-op").textContent).toBe("status-change");
    expect(screen.getByTestId("latest-source").textContent).toBe("user");
    expect(screen.getByTestId("latest-summary").textContent).toContain("active → paused");
  });
});
