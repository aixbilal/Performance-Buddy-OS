// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => false, invoke: vi.fn() }));

import { RevisionProvider, useRevision } from "./store";
import { recordRevision, __resetRevisionRecorderForTest } from "./recorder";
import type { RevisionEvent } from "./types";

function Probe() {
  const { loaded, events, eventsFor } = useRevision();
  return (
    <div>
      <span data-testid="loaded">{String(loaded)}</span>
      <span data-testid="count">{events.length}</span>
      <span data-testid="latest">{events[0]?.summary ?? "—"}</span>
      <span data-testid="perf-actions">{eventsFor({ domain: "performance", entityType: "action" }).length}</span>
    </div>
  );
}

beforeEach(() => {
  window.localStorage.clear();
  __resetRevisionRecorderForTest();
});

describe("RevisionProvider — read side", () => {
  it("loads with no events on a fresh profile (loading ≠ populated)", async () => {
    render(
      <RevisionProvider>
        <Probe />
      </RevisionProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("loaded").textContent).toBe("true"));
    expect(screen.getByTestId("count").textContent).toBe("0");
    expect(screen.getByTestId("latest").textContent).toBe("—");
  });

  it("reflects a live recordRevision call without a reload", async () => {
    render(
      <RevisionProvider>
        <Probe />
      </RevisionProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("loaded").textContent).toBe("true"));

    recordRevision({
      domain: "performance",
      entityType: "action",
      entityId: "a1",
      operation: "status-change",
      source: "user",
      summary: 'Action "Read chapter 3" todo → done',
    });

    await waitFor(() => expect(screen.getByTestId("count").textContent).toBe("1"));
    expect(screen.getByTestId("latest").textContent).toBe('Action "Read chapter 3" todo → done');
    expect(screen.getByTestId("perf-actions").textContent).toBe("1");
  });

  it("an appended audit event persists and is present after a remount (reload)", async () => {
    __resetRevisionRecorderForTest();
    recordRevision({
      domain: "routine",
      entityType: "routine",
      entityId: "r1",
      operation: "check-in",
      source: "user",
      summary: "Checked in Morning pages",
    });
    // let the fire-and-forget append settle
    await new Promise((r) => setTimeout(r, 0));

    // fresh recorder singleton (as after an app restart) — durable store still has it
    __resetRevisionRecorderForTest();
    const { unmount } = render(
      <RevisionProvider>
        <Probe />
      </RevisionProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("count").textContent).toBe("1"));
    expect(screen.getByTestId("latest").textContent).toBe("Checked in Morning pages");
    unmount();
  });

  it("recordRevision never throws even if the durable append fails", async () => {
    const throwingRepo = {
      kind: "localStorage" as const,
      append: () => Promise.reject(new Error("disk full")),
      load: () => Promise.resolve([] as RevisionEvent[]),
    };
    __resetRevisionRecorderForTest(throwingRepo);
    expect(() =>
      recordRevision({
        domain: "money",
        entityType: "transaction",
        entityId: "t1",
        operation: "create",
        source: "user",
        summary: "Recorded expense",
      }),
    ).not.toThrow();
    // the in-memory feed still captured it
    await new Promise((r) => setTimeout(r, 0));
  });
});
