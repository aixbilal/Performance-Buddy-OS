import { describe, it, expect } from "vitest";
import {
  deriveNextUnit,
  derivePathProgress,
  deriveReadingProgress,
  deriveSessionEffects,
} from "./engine";

describe("derivePathProgress — mechanical only, no mastery claim", () => {
  it("returns a NULL percent (not 0%) when there are no units yet", () => {
    expect(derivePathProgress([])).toEqual({ percent: null, completed: 0, total: 0 });
  });
  it("computes a real ratio once units exist", () => {
    expect(
      derivePathProgress([{ completed: true }, { completed: true }, { completed: false }, { completed: false }, { completed: false }]),
    ).toEqual({ percent: 40, completed: 2, total: 5 });
  });
});

describe("deriveReadingProgress — pages read, not knowledge gained", () => {
  it("page 124 of 320 rounds to 39%", () => {
    expect(deriveReadingProgress({ currentPage: 124, totalPages: 320 })).toEqual({
      percent: 39,
      currentPage: 124,
      totalPages: 320,
    });
  });
  it("UNKNOWN total pages → NULL percent, never 0%", () => {
    expect(deriveReadingProgress({ currentPage: 40, totalPages: null })).toEqual({
      percent: null,
      currentPage: 40,
      totalPages: null,
    });
    expect(deriveReadingProgress({ currentPage: 10, totalPages: 0 }).percent).toBeNull();
  });
  it("clamps a current page past the total to 100%", () => {
    expect(deriveReadingProgress({ currentPage: 400, totalPages: 320 })).toEqual({
      percent: 100,
      currentPage: 320,
      totalPages: 320,
    });
  });
});

describe("deriveNextUnit", () => {
  it("returns the first incomplete unit by position", () => {
    const units = [
      { id: "a", completed: true, position: 0 },
      { id: "b", completed: false, position: 2 },
      { id: "c", completed: false, position: 1 },
    ];
    expect(deriveNextUnit(units)?.id).toBe("c");
  });
  it("returns null when every unit is done (or there are none)", () => {
    expect(deriveNextUnit([])).toBeNull();
    expect(deriveNextUnit([{ id: "a", completed: true, position: 0 }])).toBeNull();
  });
});

describe("deriveSessionEffects — the core §5.3 / §5.5 rule", () => {
  it("a completed 30-minute session with NO recall check produces NO knowledge evidence", () => {
    const e = deriveSessionEffects({ durationMinutes: 30, recallScore: null, recallMax: 10, completed: true });
    expect(e.completesUnit).toBe(true); // mechanical completion is fine
    expect(e.knowledgeEvidence).toBeNull(); // minutes alone are never mastery
    expect(e.practiceMinutes).toBe(30);
  });
  it("a real recall check produces an evidence signal with the actual score", () => {
    const e = deriveSessionEffects({ durationMinutes: 15, recallScore: 8, recallMax: 10, completed: true });
    expect(e.knowledgeEvidence).toEqual({ score: 8, maxScore: 10 });
  });
  it("an incomplete session does not complete the unit but still counts practice minutes", () => {
    const e = deriveSessionEffects({ durationMinutes: 10, recallScore: null, recallMax: 10, completed: false });
    expect(e.completesUnit).toBe(false);
    expect(e.practiceMinutes).toBe(10);
  });
});
