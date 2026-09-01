import { describe, it, expect } from "vitest";
import {
  buildProposals,
  classifySegment,
  nextWeekdayIso,
  routeForProvider,
  segmentCapture,
  type CaptureResolvers,
  type DuplicateDetector,
} from "./naturalCapture";
import type { DomainPermissions } from "../ai/context";

const NOW = new Date("2026-09-01T09:00:00.000Z"); // a Tuesday
let counter = 0;
const newId = () => `p${++counter}`;

const ALL_READ: DomainPermissions = {
  Today: "read-recommend",
  Academics: "read-recommend",
  "Goals & Systems": "read-recommend",
  Knowledge: "read-recommend",
  Routines: "read-recommend",
  "Reading & Language": "read-recommend",
  Planning: "read-recommend",
  Money: "no-access",
};

function run(rawText: string, over: Partial<Parameters<typeof buildProposals>[0]> = {}) {
  counter = 0;
  return buildProposals({
    captureId: "cap1",
    rawText,
    now: NOW,
    permissions: ALL_READ,
    newId,
    ...over,
  });
}

// -------------------------------------------------------------------------

describe("segmentCapture", () => {
  it("splits a mixed capture on connectives, newlines and sentences", () => {
    const segs = segmentCapture(
      "Prof covered AVL trees today. Spent 1200 on groceries and also did 25 min of German",
    );
    expect(segs.map((s) => s.text)).toEqual([
      "Prof covered AVL trees today",
      "Spent 1200 on groceries",
      "did 25 min of German",
    ]);
  });
  it("keeps a single clause intact", () => {
    expect(segmentCapture("just one thing here")).toHaveLength(1);
  });
});

describe("classifySegment", () => {
  it("expense → Money / create-expense / fact", () => {
    const c = classifySegment({ index: 0, text: "Spent 1200 on groceries" }, NOW);
    expect(c.domain).toBe("Money");
    expect(c.mutationKind).toBe("create-expense");
    expect(c.proposalClass).toBe("fact");
    expect(c.params.amount).toBe(1200);
  });
  it('"prof covered X" → interpretation, coverage=taught', () => {
    const c = classifySegment({ index: 0, text: "Prof covered AVL trees today" }, NOW);
    expect(c.mutationKind).toBe("set-professor-coverage");
    expect(c.proposalClass).toBe("interpretation");
    expect(c.params.coverage).toBe("taught");
    expect(c.params.topicTitle).toBe("AVL trees");
  });
  it("study statement never invents a personal-study %", () => {
    const c = classifySegment({ index: 0, text: "studied dynamic programming for a bit" }, NOW);
    expect(c.mutationKind).toBe("set-personal-study");
    expect(c.confidence).toBe("ambiguous");
    expect(c.params).not.toHaveProperty("percent");
  });
  it("language + duration → create-language-session (clear)", () => {
    const c = classifySegment({ index: 0, text: "did 25 min of German" }, NOW);
    expect(c.mutationKind).toBe("create-language-session");
    expect(c.params.durationMinutes).toBe(25);
    expect(c.params.language).toBe("German");
    expect(c.confidence).toBe("clear");
  });
  it("assessment move with an explicit date resolves; a vague one is ambiguous", () => {
    const withDate = classifySegment({ index: 0, text: "midterm moved to 2026-10-15" }, NOW);
    expect(withDate.mutationKind).toBe("update-assessment-date");
    expect(withDate.params.date).toBe("2026-10-15");
    const vague = classifySegment({ index: 0, text: "quiz rescheduled to sometime later" }, NOW);
    expect(vague.confidence).toBe("ambiguous");
    expect(vague.params.date).toBeUndefined();
  });
  it("tired tone → set-today-capacity low, needs-review (never auto)", () => {
    const c = classifySegment({ index: 0, text: "feeling exhausted after a rough night" }, NOW);
    expect(c.mutationKind).toBe("set-today-capacity");
    expect(c.params.capacityLevel).toBe("low");
    expect(c.confidence).toBe("needs-review");
  });
  it("unrecognised text stays unknown with no mutation kind", () => {
    const c = classifySegment({ index: 0, text: "the weather is nice" }, NOW);
    expect(c.domain).toBe("unknown");
    expect(c.mutationKind).toBeNull();
  });
});

describe("nextWeekdayIso", () => {
  it("resolves the next occurrence of a weekday after a given date", () => {
    // 2026-09-01 is a Tuesday → next Friday is 2026-09-04
    expect(nextWeekdayIso("friday", NOW)).toBe("2026-09-04");
    expect(nextWeekdayIso("tuesday", NOW)).toBe("2026-09-08");
  });
});

describe("routeForProvider — privacy gate", () => {
  it("keeps a no-access (Money) segment local and allows a permitted one", () => {
    const classified = [
      classifySegment({ index: 0, text: "Spent 1200 on groceries" }, NOW),
      classifySegment({ index: 1, text: "did 25 min of German" }, NOW),
    ];
    const { remoteEligible, localOnly } = routeForProvider(classified, ALL_READ);
    expect(remoteEligible.map((c) => c.domain)).toEqual(["Reading & Language"]);
    expect(localOnly.map((c) => c.domain)).toEqual(["Money"]);
  });
  it("keeps an unclassified segment local", () => {
    const classified = [classifySegment({ index: 0, text: "the weather is nice" }, NOW)];
    expect(routeForProvider(classified, ALL_READ).remoteEligible).toHaveLength(0);
  });
});

// -------------------------------------------------------------------------

describe("buildProposals", () => {
  it("one raw input → multiple proposals, each with its own source text and class", () => {
    const { proposals, unclassified } = run(
      "Prof covered AVL trees today. Spent 1200 on groceries and also did 25 min of German",
    );
    expect(proposals).toHaveLength(3);
    expect(proposals.map((p) => p.mutationKind)).toEqual([
      "set-professor-coverage",
      "create-expense",
      "create-language-session",
    ]);
    expect(proposals.map((p) => p.proposalClass)).toEqual(["interpretation", "fact", "fact"]);
    expect(proposals[0].sourceText).toBe("Prof covered AVL trees today");
    expect(unclassified).toHaveLength(0);
  });

  it("keeps an unclassifiable segment out of the proposal set", () => {
    const { proposals, unclassified } = run("Spent 500 on fuel. the sky was purple today");
    expect(proposals).toHaveLength(1);
    expect(unclassified.map((s) => s.text)).toEqual(["the sky was purple today"]);
  });

  it("a resolvable entity is matched without creating a duplicate", () => {
    const resolvers: CaptureResolvers = {
      resolveAcademicTopic: () => ({ status: "resolved", id: "t1", label: "AVL Trees (Data Structures)" }),
    };
    const { proposals } = run("Prof covered AVL trees today", { resolvers });
    expect(JSON.parse(proposals[0].effectiveParamsJson).topicId).toBe("t1");
    expect(JSON.parse(proposals[0].evidenceJson)[0]).toMatch(/Matched existing/);
  });

  it("an ambiguous entity forces selection, never a guess", () => {
    const resolvers: CaptureResolvers = {
      resolveAcademicTopic: () => ({
        status: "ambiguous",
        candidates: [
          { id: "t1", label: "AVL Trees (DS)" },
          { id: "t2", label: "AVL Trees (Algorithms)" },
        ],
      }),
    };
    const { proposals } = run("Prof covered AVL trees today", { resolvers });
    expect(proposals[0].confidence).toBe("ambiguous");
    expect(proposals[0].ambiguityReason).toMatch(/pick one/);
    expect(JSON.parse(proposals[0].effectiveParamsJson).candidates).toHaveLength(2);
  });

  it("detects a duplicate canonical Focus session and offers reuse", () => {
    const detectDuplicate: DuplicateDetector = (c) =>
      c.mutationKind === "create-language-session"
        ? { label: "Focus · German · 25 min · 2026-09-01", sessionId: "fs_9" }
        : null;
    const { proposals } = run("did 25 min of German", { detectDuplicate });
    expect(proposals[0].confidence).toBe("needs-review");
    expect(proposals[0].ambiguityReason).toMatch(/already recorded/);
    expect(JSON.parse(proposals[0].effectiveParamsJson).duplicateOf).toBe("fs_9");
  });

  it("a 'PBOS recommends' style intent is not a fact — it is an interpretation (create-action)", () => {
    const { proposals } = run("need to email the professor about the missed lab");
    expect(proposals[0].mutationKind).toBe("create-action");
    expect(proposals[0].proposalClass).toBe("interpretation");
  });

  it("routing keeps Money local while the rest is remote-eligible", () => {
    const { routing } = run("Spent 1200 on groceries and also did 25 min of German");
    expect(routing.localOnly.map((c) => c.domain)).toEqual(["Money"]);
    expect(routing.remoteEligible.map((c) => c.domain)).toEqual(["Reading & Language"]);
  });

  it("proposal rows carry qualitative confidence only — never a percentage", () => {
    const { proposals } = run("Spent 1200 on groceries. studied graphs. did 30 min of French");
    for (const p of proposals) {
      expect(["clear", "needs-review", "ambiguous"]).toContain(p.confidence);
    }
  });
});
