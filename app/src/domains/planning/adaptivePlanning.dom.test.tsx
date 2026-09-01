// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, act, cleanup } from "@testing-library/react";
import { RevisionProvider } from "../revision/store";
import { PerformanceProvider } from "../performance/store";
import { PlanningProvider, usePlanning } from "./store";
import { buildPlanningDiff, placeCandidates, type PlanningCandidate } from "./adaptiveEngine";

vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => false, invoke: vi.fn() }));

/* eslint-disable react/globals */
let planning: ReturnType<typeof usePlanning>;
function Probe() {
  planning = usePlanning();
  return <div data-testid="ready">{String(planning.loaded)}</div>;
}
function Harness() {
  return (
    <RevisionProvider>
      <PerformanceProvider>
        <PlanningProvider>
          <Probe />
        </PlanningProvider>
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
  render(<Harness />);
  await waitFor(() => expect(screen.getByTestId("ready")).toHaveTextContent("true"));
}

async function makeRecurring(title = "German practice") {
  let id = "";
  await act(async () => {
    const res = await planning.createBlock({
      title,
      domain: "Reading & Language",
      actionId: null,
      day: 1, // Tuesday, recurs weekly (date null)
      date: null,
      startMinute: 9 * 60,
      endMinute: 9 * 60 + 30,
      type: "flexible",
      locked: false,
      source: "manual",
      status: "scheduled",
    });
    id = res.ok ? res.id : "";
  });
  return id;
}

describe("recurring occurrence semantics", () => {
  it("skipping one occurrence records an exception and does NOT touch the template", async () => {
    await mount();
    const id = await makeRecurring();
    const before = planning.getBlock(id);
    await act(async () => {
      const res = await planning.resolveOccurrence(id, "2026-09-08", "skipped");
      expect(res.ok).toBe(true);
    });
    expect(planning.occurrenceStateFor(id, "2026-09-08")).toBe("skipped");
    const after = planning.getBlock(id);
    expect(after?.date).toBeNull(); // still recurring
    expect(after?.startMinute).toBe(before?.startMinute); // template untouched
    expect(planning.blocks.filter((b) => b.id === id)).toHaveLength(1);
  });

  it("deferring one occurrence creates a date-pinned replacement and links it", async () => {
    await mount();
    const id = await makeRecurring();
    await act(async () => {
      await planning.resolveOccurrence(id, "2026-09-08", "deferred", "2026-09-10");
    });
    expect(planning.occurrenceStateFor(id, "2026-09-08")).toBe("deferred");
    const ex = planning.occurrenceExceptions.find((e) => e.blockId === id);
    expect(ex?.replacementBlockId).toBeTruthy();
    const replacement = planning.getBlock(ex!.replacementBlockId!);
    expect(replacement?.date).toBe("2026-09-10");
    expect(replacement?.source).toBe("generated");
    // template still recurs
    expect(planning.getBlock(id)?.date).toBeNull();
  });

  it("editing the recurring template is a separate explicit operation (updateBlock)", async () => {
    await mount();
    const id = await makeRecurring();
    await act(async () => {
      await planning.updateBlock(id, {
        title: "German practice",
        domain: "Reading & Language",
        actionId: null,
        day: 3,
        date: null,
        startMinute: 10 * 60,
        endMinute: 10 * 60 + 30,
        type: "flexible",
        locked: false,
        source: "manual",
        status: "scheduled",
      });
    });
    expect(planning.getBlock(id)?.day).toBe(3);
    expect(planning.getBlock(id)?.startMinute).toBe(10 * 60);
  });
});

describe("Planning Diff apply + undo", () => {
  function candidate(over: Partial<PlanningCandidate> = {}): PlanningCandidate {
    return {
      id: "c1",
      sourceDomain: "Academics",
      sourceEntityType: "topic",
      sourceEntityId: "t1",
      actionId: null,
      title: "Study graphs",
      context: "",
      estMinutes: 60,
      requiredBefore: null,
      earliestDate: null,
      preferredTimeWindow: null,
      minimumBlockMinutes: null,
      splittable: false,
      reasonCodes: ["NEAREST_SCOPED_ASSESSMENT"],
      priority: 0,
      ...over,
    };
  }

  it("applies an add-diff atomically, persists a change set, and undo removes the block", async () => {
    await mount();
    const plan = placeCandidates({
      candidates: [candidate()],
      horizonStartIso: "2026-09-07",
      horizonEndIso: "2026-09-13",
      datedBlocks: [],
      dailyCapacityMinutes: 240,
      weeklyCapacityMinutes: 900,
      scope: "week",
    });
    const diff = buildPlanningDiff(plan, [], []);

    let changeSetId = "";
    await act(async () => {
      const res = await planning.applyPlanningDiff(diff, { scope: "week", rationale: "prep for scoped assessment" });
      expect(res.ok).toBe(true);
      changeSetId = res.changeSetId!;
    });
    expect(planning.blocks.some((b) => b.title === "Study graphs" && b.source === "generated")).toBe(true);
    expect(planning.changeSets.find((c) => c.id === changeSetId)?.status).toBe("applied");

    await act(async () => {
      const res = await planning.undoPlanningChangeSet(changeSetId);
      expect(res.ok).toBe(true);
    });
    expect(planning.changeSets.find((c) => c.id === changeSetId)?.status).toBe("undone");
  });

  it("an occurrence-defer diff persists, and everything survives a remount", async () => {
    await mount();
    const id = await makeRecurring();
    const diff = buildPlanningDiff({ placements: [], nudges: [], couldNotFit: [] }, [
      { blockId: id, occurrenceDate: "2026-09-08", kind: "defer", toDate: "2026-09-11" },
    ]);
    await act(async () => {
      const res = await planning.applyPlanningDiff(diff, { scope: "micro" });
      expect(res.ok).toBe(true);
    });
    cleanup();
    await mount();
    await waitFor(() => expect(planning.occurrenceStateFor(id, "2026-09-08")).toBe("deferred"));
    expect(planning.changeSets.some((c) => c.status === "applied")).toBe(true);
  });
});
