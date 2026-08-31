import { describe, it, expect } from "vitest";
import { resolveLegacyRoutine } from "./legacyImport";

describe("resolveLegacyRoutine", () => {
  it("returns an empty graph for empty input", () => {
    const { graph, report } = resolveLegacyRoutine({ definitions: null, logs: null });
    expect(graph).toEqual({ routines: [], logs: [] });
    expect(report.parsed).toEqual({ routines: 0, logs: 0 });
  });

  it("migrates a pre-2B routine with no cadence → daily, preserving id", () => {
    const { graph, report } = resolveLegacyRoutine({
      definitions: JSON.stringify([
        {
          id: "rt-hydration",
          title: "Hydration",
          category: "Hydration",
          timeWindow: "day",
          completionType: "quantity",
          targetQuantity: 2500,
          targetUnit: "ml",
          priority: "important",
          relatedSystemId: null,
        },
      ]),
      logs: null,
    });
    expect(graph.routines).toHaveLength(1);
    expect(graph.routines[0].id).toBe("rt-hydration");
    expect(graph.routines[0].scheduleType).toBe("daily");
    expect(graph.routines[0].scheduleDays).toEqual([]);
    expect(graph.routines[0].paused).toBe(false);
    expect(report.repairs.some((r) => r.includes("defaulted to"))).toBe(true);
  });

  it("keeps a recorded weekly-days cadence and sorts/filters the days", () => {
    const { graph } = resolveLegacyRoutine({
      definitions: JSON.stringify([
        { id: "r1", title: "German", scheduleType: "weekly-days", scheduleDays: [4, 0, 9, 2] },
      ]),
      logs: null,
    });
    expect(graph.routines[0].scheduleDays).toEqual([0, 2, 4]);
  });

  it("drops a log whose routine is missing, and reports it", () => {
    const { graph, report } = resolveLegacyRoutine({
      definitions: JSON.stringify([{ id: "r1", title: "A" }]),
      logs: JSON.stringify([
        { id: "l1", routineId: "r1", date: "2026-08-30", state: "complete" },
        { id: "l2", routineId: "ghost", date: "2026-08-30", state: "complete" },
      ]),
    });
    expect(graph.logs).toHaveLength(1);
    expect(graph.logs[0].id).toBe("l1");
    expect(report.repairs.some((r) => r.includes("missing routine"))).toBe(true);
  });

  it("collapses duplicate (routine, date) logs deterministically — keeps the first", () => {
    const { graph, report } = resolveLegacyRoutine({
      definitions: JSON.stringify([{ id: "r1", title: "A" }]),
      logs: JSON.stringify([
        { id: "l1", routineId: "r1", date: "2026-08-30", state: "complete" },
        { id: "l2", routineId: "r1", date: "2026-08-30", state: "missed" },
      ]),
    });
    expect(graph.logs).toHaveLength(1);
    expect(graph.logs[0].state).toBe("complete");
    expect(report.repairs.some((r) => r.includes("collapsed"))).toBe(true);
  });

  it("adds created/updated timestamps to migrated logs and never fabricates history", () => {
    const { graph } = resolveLegacyRoutine({
      definitions: JSON.stringify([{ id: "r1", title: "A" }]),
      logs: JSON.stringify([{ id: "l1", routineId: "r1", date: "2026-08-30", state: "partial" }]),
    });
    expect(graph.logs[0].createdAt).toBeTruthy();
    expect(graph.logs[0].updatedAt).toBeTruthy();
    // exactly the one real log — nothing invented
    expect(graph.logs).toHaveLength(1);
  });

  it("reports malformed blobs without throwing", () => {
    const { graph, report } = resolveLegacyRoutine({ definitions: "{not json", logs: "also bad" });
    expect(graph).toEqual({ routines: [], logs: [] });
    expect(report.malformed).toContain("pbos:routine-definitions");
    expect(report.malformed).toContain("pbos:routine-logs");
  });

  it("keeps a System reference as-is (repo layer clears it if dangling)", () => {
    const { graph } = resolveLegacyRoutine({
      definitions: JSON.stringify([{ id: "r1", title: "A", relatedSystemId: "sys-x" }]),
      logs: null,
    });
    expect(graph.routines[0].relatedSystemId).toBe("sys-x");
  });
});
