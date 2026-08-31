import { describe, it, expect } from "vitest";
import {
  deriveProjectProgress,
  validateEvidenceInput,
  validateMilestoneInput,
  validateProjectInput,
  validateSkillInput,
} from "./engine";

describe("validateProjectInput", () => {
  it("accepts a well-formed project and trims", () => {
    const r = validateProjectInput({ title: "  PBOS  ", status: "active", description: "  x " });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.title).toBe("PBOS");
      expect(r.value.description).toBe("x");
    }
  });
  it("rejects empty title / bad status", () => {
    expect(validateProjectInput({ title: "", status: "active", description: "" }).ok).toBe(false);
    expect(
      validateProjectInput({ title: "X", status: "done" as never, description: "" }).ok,
    ).toBe(false);
  });
});

describe("validateSkillInput — Knowledge / Practice are separate axes", () => {
  it("accepts independent knowledge + practice values", () => {
    const r = validateSkillInput({
      title: "React",
      category: "FE",
      knowledgePercent: 80,
      practicePercent: 20,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.knowledgePercent).toBe(80);
      expect(r.value.practicePercent).toBe(20);
    }
  });
  it("has NO evidence field on the validated shape", () => {
    const r = validateSkillInput({
      title: "React",
      category: "",
      knowledgePercent: 0,
      practicePercent: 0,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect("evidencePercent" in r.value).toBe(false);
  });
  it("rejects a percent outside 0–100 (UNKNOWN ≠ clamped)", () => {
    expect(
      validateSkillInput({ title: "X", category: "", knowledgePercent: -1, practicePercent: 0 }).ok,
    ).toBe(false);
    expect(
      validateSkillInput({ title: "X", category: "", knowledgePercent: 0, practicePercent: 150 }).ok,
    ).toBe(false);
  });
});

describe("validateMilestoneInput", () => {
  it("requires a title", () => {
    expect(validateMilestoneInput({ title: "  " }).ok).toBe(false);
    expect(validateMilestoneInput({ title: "Ship v1" }).ok).toBe(true);
  });
});

describe("validateEvidenceInput — provenance is required", () => {
  it("accepts an independent evidence record", () => {
    expect(
      validateEvidenceInput({
        title: "Built it myself",
        provenance: "independent",
        projectId: null,
        date: "2026-08-01",
      }).ok,
    ).toBe(true);
  });
  it("rejects an empty description and a bad provenance", () => {
    expect(
      validateEvidenceInput({ title: "", provenance: "independent", projectId: null, date: "" }).ok,
    ).toBe(false);
    expect(
      validateEvidenceInput({
        title: "x",
        provenance: "magic" as never,
        projectId: null,
        date: "",
      }).ok,
    ).toBe(false);
  });
});

describe("deriveProjectProgress — no milestones ≠ 0%", () => {
  it("returns percent null when there are no milestones", () => {
    expect(deriveProjectProgress([])).toEqual({ completed: 0, total: 0, percent: null });
  });
  it("computes a real ratio once milestones exist", () => {
    expect(
      deriveProjectProgress([{ completed: true }, { completed: false }, { completed: true }]),
    ).toEqual({ completed: 2, total: 3, percent: 67 });
  });
});
