import { describe, it, expect } from "vitest";
import { resolveLegacyPlanning } from "./legacyImport";
import { DEFAULT_CAPACITY } from "./types";

describe("resolveLegacyPlanning — safe, id-preserving, non-fabricating", () => {
  it("returns an empty graph + default capacity when there is nothing to migrate", () => {
    const { graph, report } = resolveLegacyPlanning({ blocks: null, capacity: null });
    expect(graph.blocks).toEqual([]);
    expect(graph.capacity).toEqual(DEFAULT_CAPACITY);
    expect(report.parsed.blocks).toBe(0);
    expect(report.malformed).toEqual([]);
  });

  it("preserves block ids and defaults missing provenance/status", () => {
    const legacyBlocks = JSON.stringify([
      { id: "blk-old", title: "DS Mastery", domain: "Academics", day: 5, startMinute: 840, endMinute: 930, type: "flexible", locked: true, actionId: "act-1" },
    ]);
    const { graph } = resolveLegacyPlanning({ blocks: legacyBlocks, capacity: null });
    expect(graph.blocks).toHaveLength(1);
    expect(graph.blocks[0].id).toBe("blk-old");
    expect(graph.blocks[0].actionId).toBe("act-1");
    expect(graph.blocks[0].locked).toBe(true);
    expect(graph.blocks[0].source).toBe("manual");
    expect(graph.blocks[0].status).toBe("scheduled");
    expect(graph.blocks[0].date).toBeNull();
  });

  it("drops a zero/negative-duration block and reports the repair", () => {
    const legacyBlocks = JSON.stringify([
      { id: "bad", title: "x", day: 0, startMinute: 600, endMinute: 600 },
      { id: "good", title: "y", day: 0, startMinute: 600, endMinute: 660 },
    ]);
    const { graph, report } = resolveLegacyPlanning({ blocks: legacyBlocks, capacity: null });
    expect(graph.blocks.map((b) => b.id)).toEqual(["good"]);
    expect(report.repairs.some((r) => r.includes("bad"))).toBe(true);
  });

  it("flags malformed JSON without throwing", () => {
    const { graph, report } = resolveLegacyPlanning({ blocks: "{not json", capacity: "{bad" });
    expect(graph.blocks).toEqual([]);
    expect(report.malformed).toContain("pbos:planning-blocks");
    expect(report.malformed).toContain("pbos:planning-capacity");
  });

  it("reads a stored capacity config", () => {
    const cap = JSON.stringify({ dailyCapacityMinutes: 200, weeklyCapacityMinutes: 1000 });
    const { graph } = resolveLegacyPlanning({ blocks: null, capacity: cap });
    expect(graph.capacity).toEqual({ dailyCapacityMinutes: 200, weeklyCapacityMinutes: 1000 });
  });
});
