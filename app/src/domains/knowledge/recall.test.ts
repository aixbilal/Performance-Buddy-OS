import { describe, it, expect, vi } from "vitest";
import {
  buildRecallRequest,
  deterministicRecallPrompts,
  generateRecall,
  parseRecallItems,
} from "./recall";

describe("deterministicRecallPrompts", () => {
  it("always produces prompts, folds in linked source titles first, respects the count", () => {
    const prompts = deterministicRecallPrompts("AVL trees", ["CLRS ch. 13"], 4);
    expect(prompts).toHaveLength(4);
    expect(prompts[0]).toMatch(/CLRS ch\. 13/);
    expect(prompts.every((p) => p.includes("AVL trees"))).toBe(true);
  });
  it("handles an empty topic without crashing", () => {
    expect(deterministicRecallPrompts("", [], 2).length).toBe(2);
  });
});

describe("buildRecallRequest", () => {
  it("includes a selected note preview ONLY when given, and never as raw domain facts", () => {
    const without = buildRecallRequest("Dijkstra");
    expect(without.user).not.toMatch(/excerpt/i);
    const withNote = buildRecallRequest("Dijkstra", { notePreview: "shortest path, greedy, priority queue" });
    expect(withNote.user).toMatch(/note excerpt as scope/i);
    expect(withNote.system).toMatch(/no answers/i);
  });
  it("truncates a long preview", () => {
    const long = "x".repeat(5000);
    expect(buildRecallRequest("T", { notePreview: long }).user.length).toBeLessThan(2000);
  });
});

describe("parseRecallItems", () => {
  it("strips bullets / numbering and drops blank lines", () => {
    const items = parseRecallItems("1. First?\n- Second?\n\n* Third?\n  \n4) Fourth?", 10);
    expect(items).toEqual(["First?", "Second?", "Third?", "Fourth?"]);
  });
});

describe("generateRecall", () => {
  it("AI off → deterministic prompts, no error state, provider never called", async () => {
    const runProvider = vi.fn();
    const res = await generateRecall({ topicTitle: "Graphs", aiAllowed: false, runProvider });
    expect(res.source).toBe("deterministic");
    expect(res.items.length).toBeGreaterThan(0);
    expect(runProvider).not.toHaveBeenCalled();
  });

  it("AI allowed + provider ok → uses the AI prompts", async () => {
    const res = await generateRecall({
      topicTitle: "Graphs",
      aiAllowed: true,
      runProvider: async () => ({ ok: true, text: "What is a graph?\nWhen is BFS better than DFS?" }),
    });
    expect(res.source).toBe("ai");
    expect(res.items).toEqual(["What is a graph?", "When is BFS better than DFS?"]);
  });

  it("AI allowed but provider fails → deterministic fallback with an honest message", async () => {
    const res = await generateRecall({
      topicTitle: "Graphs",
      aiAllowed: true,
      runProvider: async () => ({ ok: false, text: "" }),
    });
    expect(res.source).toBe("deterministic");
    expect(res.message).toMatch(/unavailable/i);
    expect(res.items.length).toBeGreaterThan(0);
  });

  it("aiAllowed with no provider wired → honest unavailable, no fabricated items", async () => {
    const res = await generateRecall({ topicTitle: "Graphs", aiAllowed: true });
    expect(res.source).toBe("unavailable");
    expect(res.items).toEqual([]);
  });
});
