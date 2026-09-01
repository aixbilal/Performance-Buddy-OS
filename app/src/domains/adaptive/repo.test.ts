// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ isTauri: vi.fn(() => false), invoke: vi.fn() }));

import { invoke, isTauri } from "@tauri-apps/api/core";
import {
  LocalAdaptivePlanningRepo,
  LocalAssessmentScopeRepo,
  LocalCaptureProposalsRepo,
  LocalTodayStateRepo,
  makeAdaptivePlanningRepo,
  makeAssessmentScopeRepo,
  makeCaptureProposalsRepo,
  makeTodayStateRepo,
} from "./repo";
import { parsePlanningDiffChanges } from "./types";
import type {
  ActionSchedulingConstraint,
  AssessmentTopicLink,
  CaptureProposalRecord,
  PlanningChangeSet,
  PlanningOccurrenceException,
  TodayOperatingState,
} from "./types";

const TS = "2026-09-01T08:00:00.000Z";

const proposal = (over: Partial<CaptureProposalRecord> = {}): CaptureProposalRecord => ({
  id: "p1",
  captureId: "cap1",
  proposalClass: "fact",
  domain: "Academics",
  mutationKind: "set-professor-coverage",
  title: "Prof covered AVL trees",
  sourceText: "prof covered avl today",
  confidence: "clear",
  ambiguityReason: null,
  rationale: "Matched an existing DSA topic",
  evidenceJson: '["topic: AVL trees"]',
  originalParamsJson: '{"topicId":"t1","coverage":"covered"}',
  effectiveParamsJson: '{"topicId":"t1","coverage":"covered"}',
  status: "proposed",
  validationJson: null,
  appliedResultJson: null,
  createdAt: TS,
  decidedAt: null,
  appliedAt: null,
  ...over,
});

const link = (over: Partial<AssessmentTopicLink> = {}): AssessmentTopicLink => ({
  assessmentId: "mid",
  topicId: "t1",
  source: "user",
  createdAt: TS,
  ...over,
});

const constraint = (over: Partial<ActionSchedulingConstraint> = {}): ActionSchedulingConstraint => ({
  actionId: "act1",
  requiredBefore: "2026-09-12",
  earliestDate: "2026-09-05",
  preferredTimeWindow: "morning",
  minimumBlockMinutes: 45,
  splittable: false,
  source: "user",
  createdAt: TS,
  updatedAt: TS,
  ...over,
});

const occurrence = (
  over: Partial<PlanningOccurrenceException> = {},
): PlanningOccurrenceException => ({
  id: "ex1",
  blockId: "rec1",
  occurrenceDate: "2026-09-08",
  state: "deferred",
  replacementBlockId: "repl1",
  source: "user",
  note: "moved to Sunday",
  createdAt: TS,
  updatedAt: TS,
  ...over,
});

const changeSet = (over: Partial<PlanningChangeSet> = {}): PlanningChangeSet => ({
  id: "cs1",
  scope: "day",
  status: "proposed",
  targetStartDate: "2026-09-08",
  targetEndDate: "2026-09-08",
  rationale: "a block elapsed unresolved",
  reasonCodesJson: '["ELAPSED_UNRESOLVED"]',
  changesJson: '[{"kind":"move","blockId":"b1","toStartMinute":600}]',
  inverseChangesJson: '[{"kind":"move","blockId":"b1","toStartMinute":540}]',
  source: "adaptive-planning",
  createdAt: TS,
  decidedAt: null,
  appliedAt: null,
  undoneAt: null,
  ...over,
});

const todayState = (over: Partial<TodayOperatingState> = {}): TodayOperatingState => ({
  date: "2026-09-01",
  capacityLevel: "low",
  source: "user",
  note: "short night",
  createdAt: TS,
  updatedAt: TS,
  ...over,
});

beforeEach(() => {
  window.localStorage.clear();
  vi.mocked(isTauri).mockReturnValue(false);
  vi.mocked(invoke).mockReset();
});

// -----------------------------------------------------------------------
// Factory selection
// -----------------------------------------------------------------------

describe("repo factories fall back to localStorage off Tauri", () => {
  it("all four", () => {
    expect(makeCaptureProposalsRepo()).toBeInstanceOf(LocalCaptureProposalsRepo);
    expect(makeAssessmentScopeRepo()).toBeInstanceOf(LocalAssessmentScopeRepo);
    expect(makeAdaptivePlanningRepo()).toBeInstanceOf(LocalAdaptivePlanningRepo);
    expect(makeTodayStateRepo()).toBeInstanceOf(LocalTodayStateRepo);
  });
});

// -----------------------------------------------------------------------
// LocalRepo durability
// -----------------------------------------------------------------------

describe("LocalCaptureProposalsRepo", () => {
  it("one capture owns many proposals; reload survives a fresh instance", async () => {
    const repo = new LocalCaptureProposalsRepo();
    await repo.upsert(proposal({ id: "p1", proposalClass: "fact" }));
    await repo.upsert(
      proposal({ id: "p2", proposalClass: "interpretation", domain: "Money", mutationKind: "create-expense" }),
    );
    const forCap = await new LocalCaptureProposalsRepo().loadFor("cap1");
    expect(forCap.map((p) => p.proposalClass)).toEqual(["fact", "interpretation"]);
  });

  it("upsert by id preserves createdAt and moves status", async () => {
    const repo = new LocalCaptureProposalsRepo();
    await repo.upsert(proposal());
    await repo.upsert(proposal({ status: "accepted", decidedAt: TS, createdAt: "2099-01-01" }));
    const [row] = await repo.load();
    expect(row.status).toBe("accepted");
    expect(row.createdAt).toBe(TS);
  });

  it("remove drops the proposal only", async () => {
    const repo = new LocalCaptureProposalsRepo();
    await repo.upsert(proposal({ id: "p1" }));
    await repo.upsert(proposal({ id: "p2" }));
    await repo.remove("p1");
    expect((await repo.load()).map((p) => p.id)).toEqual(["p2"]);
  });
});

describe("LocalAssessmentScopeRepo", () => {
  it("scope is explicit — nothing is in scope until added", async () => {
    const repo = new LocalAssessmentScopeRepo();
    expect(await repo.loadFor("mid")).toEqual([]);
    await repo.add(link({ topicId: "t1" }));
    expect((await repo.loadFor("mid")).map((l) => l.topicId)).toEqual(["t1"]);
  });

  it("set replaces the whole scope for one assessment, leaving others intact", async () => {
    const repo = new LocalAssessmentScopeRepo();
    await repo.add(link({ assessmentId: "final", topicId: "z9" }));
    await repo.set("mid", ["t1", "t2"], "user", TS);
    expect((await repo.loadFor("mid")).map((l) => l.topicId).sort()).toEqual(["t1", "t2"]);
    expect((await repo.loadFor("final")).map((l) => l.topicId)).toEqual(["z9"]);
    await repo.set("mid", ["t1"], "capture-approved", TS);
    expect(await repo.loadFor("mid")).toHaveLength(1);
  });

  it("remove clears one link", async () => {
    const repo = new LocalAssessmentScopeRepo();
    await repo.set("mid", ["t1", "t2"], "user", TS);
    await repo.remove("mid", "t1");
    expect((await repo.loadFor("mid")).map((l) => l.topicId)).toEqual(["t2"]);
  });
});

describe("LocalAdaptivePlanningRepo", () => {
  it("action constraints round-trip and default to unsplittable", async () => {
    const repo = new LocalAdaptivePlanningRepo();
    await repo.upsertConstraint(constraint());
    const [c] = await repo.loadConstraints();
    expect(c.splittable).toBe(false);
    expect(c.minimumBlockMinutes).toBe(45);
    await repo.removeConstraint("act1");
    expect(await repo.loadConstraints()).toEqual([]);
  });

  it("occurrence exceptions are keyed by (blockId, occurrenceDate)", async () => {
    const repo = new LocalAdaptivePlanningRepo();
    await repo.upsertOccurrence(occurrence({ id: "ex1", state: "skipped" }));
    await repo.upsertOccurrence(occurrence({ id: "ex2", state: "done" }));
    const all = await repo.loadOccurrences();
    expect(all).toHaveLength(1);
    expect(all[0].state).toBe("done");
  });

  it("change sets persist proposed + inverse changes through the apply→undo lifecycle", async () => {
    const repo = new LocalAdaptivePlanningRepo();
    await repo.upsertChangeSet(changeSet());
    await repo.upsertChangeSet(changeSet({ status: "applied", appliedAt: TS }));
    await repo.upsertChangeSet(changeSet({ status: "undone", undoneAt: TS }));
    const all = await repo.loadChangeSets();
    expect(all).toHaveLength(1);
    expect(all[0].status).toBe("undone");
    expect(parsePlanningDiffChanges(all[0].inverseChangesJson)).toEqual([
      { kind: "move", blockId: "b1", toStartMinute: 540 },
    ]);
  });
});

describe("LocalTodayStateRepo", () => {
  it("absence is not a stored value; a set level round-trips per date", async () => {
    const repo = new LocalTodayStateRepo();
    expect(await repo.get("2026-09-01")).toBeNull();
    await repo.set(todayState({ capacityLevel: "low" }));
    await repo.set(todayState({ capacityLevel: "high", updatedAt: "2026-09-01T20:00:00.000Z" }));
    expect((await repo.get("2026-09-01"))?.capacityLevel).toBe("high");
    expect(await repo.load()).toHaveLength(1);
    await repo.clear("2026-09-01");
    expect(await repo.get("2026-09-01")).toBeNull();
  });
});

// -----------------------------------------------------------------------
// SqliteRepo — exact Tauri wire contract (command name + payload keys)
// -----------------------------------------------------------------------

describe("SqliteRepo wire contract", () => {
  function record() {
    const calls: { cmd: string; args: Record<string, unknown> }[] = [];
    vi.mocked(isTauri).mockReturnValue(true);
    vi.mocked(invoke).mockImplementation((async (cmd: string, args?: unknown) => {
      calls.push({ cmd, args: (args ?? {}) as Record<string, unknown> });
      return [];
    }) as typeof invoke);
    return calls;
  }

  it("capture proposals send `proposal` / `captureId` / `id` under the documented commands", async () => {
    const calls = record();
    const repo = makeCaptureProposalsRepo();
    await repo.load();
    await repo.loadFor("cap1");
    await repo.upsert(proposal());
    await repo.remove("p1");
    expect(calls.map((c) => c.cmd)).toEqual([
      "capture_proposals_load",
      "capture_proposals_for",
      "capture_proposal_upsert",
      "capture_proposal_delete",
    ]);
    expect(calls[1].args).toEqual({ captureId: "cap1" });
    expect(calls[2].args).toEqual({ proposal: proposal() });
    expect(calls[3].args).toEqual({ id: "p1" });
  });

  it("assessment scope set sends the flat argument list `acad_assessment_scope_set` expects", async () => {
    const calls = record();
    const repo = makeAssessmentScopeRepo();
    await repo.add(link());
    await repo.remove("mid", "t1");
    await repo.set("mid", ["t1", "t2"], "user", TS);
    expect(calls.map((c) => c.cmd)).toEqual([
      "acad_assessment_scope_add",
      "acad_assessment_scope_remove",
      "acad_assessment_scope_set",
    ]);
    expect(calls[0].args).toEqual({ link: link() });
    expect(calls[1].args).toEqual({ assessmentId: "mid", topicId: "t1" });
    expect(calls[2].args).toEqual({
      assessmentId: "mid",
      topicIds: ["t1", "t2"],
      source: "user",
      now: TS,
    });
  });

  it("adaptive planning uses `constraint` / `exception` / `changeSet` payload keys", async () => {
    const calls = record();
    const repo = makeAdaptivePlanningRepo();
    await repo.upsertConstraint(constraint());
    await repo.upsertOccurrence(occurrence());
    await repo.upsertChangeSet(changeSet());
    await repo.removeConstraint("act1");
    expect(calls.map((c) => c.cmd)).toEqual([
      "plan_action_constraint_upsert",
      "plan_occurrence_upsert",
      "plan_change_set_upsert",
      "plan_action_constraint_delete",
    ]);
    expect(calls[0].args).toEqual({ constraint: constraint() });
    expect(calls[1].args).toEqual({ exception: occurrence() });
    expect(calls[2].args).toEqual({ changeSet: changeSet() });
    expect(calls[3].args).toEqual({ actionId: "act1" });
  });

  it("today state sends `state` on set and `date` on get/clear", async () => {
    const calls = record();
    const repo = makeTodayStateRepo();
    await repo.set(todayState());
    await repo.get("2026-09-01");
    await repo.clear("2026-09-01");
    expect(calls.map((c) => c.cmd)).toEqual([
      "today_state_set",
      "today_state_get",
      "today_state_clear",
    ]);
    expect(calls[0].args).toEqual({ state: todayState() });
    expect(calls[1].args).toEqual({ date: "2026-09-01" });
  });
});

// -----------------------------------------------------------------------
// PlanningDiffChange validation
// -----------------------------------------------------------------------

describe("parsePlanningDiffChanges", () => {
  it("accepts the typed change vocabulary", () => {
    const json = JSON.stringify([
      { kind: "keep", blockId: "b1" },
      { kind: "move", blockId: "b2", toStartMinute: 600 },
      { kind: "drop-occurrence", blockId: "b3", occurrenceDate: "2026-09-08" },
    ]);
    expect(parsePlanningDiffChanges(json)).toHaveLength(3);
  });

  it("rejects malformed json, non-arrays, and unknown kinds (no partial trust)", () => {
    expect(parsePlanningDiffChanges("{not json")).toBeNull();
    expect(parsePlanningDiffChanges('{"kind":"move"}')).toBeNull();
    expect(parsePlanningDiffChanges('[{"kind":"could-not-fit"}]')).toBeNull();
    expect(parsePlanningDiffChanges('[{"kind":"keep","blockId":"b1"},null]')).toBeNull();
  });
});
