/**
 * Durable persistence for the V2 ADAPTIVE INTELLIGENCE foundation (schema v11).
 *
 *   store / engine  ->  <slice>Repo  ->  { Tauri commands -> Rust -> SQLite }
 *                                   \->  { localStorage JSON }  (browser dev only)
 *
 * Four independent slices, one file so the "V2 persistence foundation" stays
 * reviewable as a unit. Each SqliteRepo targets its own domain's Rust commands
 * (`capture_*`, `acad_assessment_scope_*`, `plan_*`, `today_state_*`). None of
 * these is a second canonical store — they layer on top of the existing
 * `capture_inbox`, `academic_*`, `planning_blocks` and Planner capacity truth.
 */
import { invoke, isTauri } from "@tauri-apps/api/core";
import type {
  ActionSchedulingConstraint,
  ApplyChangeSetRequest,
  AssessmentTopicLink,
  CaptureProposalRecord,
  ChangeSetApplyReport,
  PlanningChangeSet,
  PlanningOccurrenceException,
  TodayOperatingState,
  UndoChangeSetRequest,
} from "./types";

function underTauri(): boolean {
  try {
    return isTauri();
  } catch {
    return false;
  }
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode / quota — a dev-only fallback, safe to drop */
  }
}
/** Upsert by a string key into a plain array; preserves `createdAt` on update. */
function upsertBy<T extends Record<string, unknown>>(
  list: T[],
  row: T,
  keys: (keyof T)[],
): T[] {
  const match = (x: T) => keys.every((k) => x[k] === row[k]);
  const i = list.findIndex(match);
  if (i >= 0) {
    const createdAt = (list[i] as { createdAt?: unknown }).createdAt;
    list[i] = createdAt !== undefined ? { ...row, createdAt } : row;
  } else {
    list.push(row);
  }
  return list;
}

// =========================================================================
// Capture Proposals
// =========================================================================

export interface CaptureProposalsRepo {
  readonly kind: "sqlite" | "localStorage";
  load(): Promise<CaptureProposalRecord[]>;
  loadFor(captureId: string): Promise<CaptureProposalRecord[]>;
  upsert(proposal: CaptureProposalRecord): Promise<void>;
  remove(id: string): Promise<void>;
}

class SqliteCaptureProposalsRepo implements CaptureProposalsRepo {
  readonly kind = "sqlite" as const;
  load() {
    return invoke<CaptureProposalRecord[]>("capture_proposals_load");
  }
  loadFor(captureId: string) {
    return invoke<CaptureProposalRecord[]>("capture_proposals_for", { captureId });
  }
  async upsert(proposal: CaptureProposalRecord) {
    await invoke("capture_proposal_upsert", { proposal });
  }
  async remove(id: string) {
    await invoke("capture_proposal_delete", { id });
  }
}

const LS_PROPOSALS = "pbos:capture-proposals-v2";

export class LocalCaptureProposalsRepo implements CaptureProposalsRepo {
  readonly kind = "localStorage" as const;
  private all() {
    return readJson<CaptureProposalRecord[]>(LS_PROPOSALS, []);
  }
  async load() {
    return this.all();
  }
  async loadFor(captureId: string) {
    return this.all().filter((p) => p.captureId === captureId);
  }
  async upsert(proposal: CaptureProposalRecord) {
    writeJson(LS_PROPOSALS, upsertBy(this.all(), proposal, ["id"]));
  }
  async remove(id: string) {
    writeJson(
      LS_PROPOSALS,
      this.all().filter((p) => p.id !== id),
    );
  }
}

export function makeCaptureProposalsRepo(): CaptureProposalsRepo {
  return underTauri() ? new SqliteCaptureProposalsRepo() : new LocalCaptureProposalsRepo();
}

// =========================================================================
// Assessment ↔ Topic scope
// =========================================================================

export interface AssessmentScopeRepo {
  readonly kind: "sqlite" | "localStorage";
  load(): Promise<AssessmentTopicLink[]>;
  loadFor(assessmentId: string): Promise<AssessmentTopicLink[]>;
  add(link: AssessmentTopicLink): Promise<void>;
  remove(assessmentId: string, topicId: string): Promise<void>;
  /** Replace the whole scope for one assessment (the editor's Save). */
  set(
    assessmentId: string,
    topicIds: string[],
    source: string,
    now: string,
  ): Promise<void>;
}

class SqliteAssessmentScopeRepo implements AssessmentScopeRepo {
  readonly kind = "sqlite" as const;
  load() {
    return invoke<AssessmentTopicLink[]>("acad_assessment_scope_load");
  }
  loadFor(assessmentId: string) {
    return invoke<AssessmentTopicLink[]>("acad_assessment_scope_for", { assessmentId });
  }
  async add(link: AssessmentTopicLink) {
    await invoke("acad_assessment_scope_add", { link });
  }
  async remove(assessmentId: string, topicId: string) {
    await invoke("acad_assessment_scope_remove", { assessmentId, topicId });
  }
  async set(assessmentId: string, topicIds: string[], source: string, now: string) {
    await invoke("acad_assessment_scope_set", { assessmentId, topicIds, source, now });
  }
}

const LS_SCOPE = "pbos:academic-assessment-scope-v2";

/** Browser-dev fallback. The same-course guard lives in Rust; this stand-in
 *  cannot see the academic graph, so it trusts its caller (the store, which is
 *  built from in-course topic lists). */
export class LocalAssessmentScopeRepo implements AssessmentScopeRepo {
  readonly kind = "localStorage" as const;
  private all() {
    return readJson<AssessmentTopicLink[]>(LS_SCOPE, []);
  }
  async load() {
    return this.all();
  }
  async loadFor(assessmentId: string) {
    return this.all().filter((l) => l.assessmentId === assessmentId);
  }
  async add(link: AssessmentTopicLink) {
    writeJson(LS_SCOPE, upsertBy(this.all(), link, ["assessmentId", "topicId"]));
  }
  async remove(assessmentId: string, topicId: string) {
    writeJson(
      LS_SCOPE,
      this.all().filter((l) => !(l.assessmentId === assessmentId && l.topicId === topicId)),
    );
  }
  async set(assessmentId: string, topicIds: string[], source: string, now: string) {
    const others = this.all().filter((l) => l.assessmentId !== assessmentId);
    const next = topicIds.map((topicId) => ({
      assessmentId,
      topicId,
      source: source as AssessmentTopicLink["source"],
      createdAt: now,
    }));
    writeJson(LS_SCOPE, [...others, ...next]);
  }
}

export function makeAssessmentScopeRepo(): AssessmentScopeRepo {
  return underTauri() ? new SqliteAssessmentScopeRepo() : new LocalAssessmentScopeRepo();
}

// =========================================================================
// Adaptive Planning — constraints, occurrence exceptions, change sets
// =========================================================================

export interface AdaptivePlanningRepo {
  readonly kind: "sqlite" | "localStorage";
  loadConstraints(): Promise<ActionSchedulingConstraint[]>;
  upsertConstraint(c: ActionSchedulingConstraint): Promise<void>;
  removeConstraint(actionId: string): Promise<void>;
  loadOccurrences(): Promise<PlanningOccurrenceException[]>;
  upsertOccurrence(e: PlanningOccurrenceException): Promise<void>;
  removeOccurrence(id: string): Promise<void>;
  loadChangeSets(): Promise<PlanningChangeSet[]>;
  upsertChangeSet(cs: PlanningChangeSet): Promise<void>;
  removeChangeSet(id: string): Promise<void>;
  /**
   * Apply a whole Planning Diff in ONE SQLite transaction (Rust). `null` means
   * the transactional path is unavailable in this backend — the caller falls
   * back to its own sequential apply + compensating rollback.
   */
  applyChangeSet(request: ApplyChangeSetRequest): Promise<ChangeSetApplyReport | null>;
  undoChangeSet(request: UndoChangeSetRequest): Promise<ChangeSetApplyReport | null>;
}

class SqliteAdaptivePlanningRepo implements AdaptivePlanningRepo {
  readonly kind = "sqlite" as const;
  loadConstraints() {
    return invoke<ActionSchedulingConstraint[]>("plan_action_constraints_load");
  }
  async upsertConstraint(constraint: ActionSchedulingConstraint) {
    await invoke("plan_action_constraint_upsert", { constraint });
  }
  async removeConstraint(actionId: string) {
    await invoke("plan_action_constraint_delete", { actionId });
  }
  loadOccurrences() {
    return invoke<PlanningOccurrenceException[]>("plan_occurrences_load");
  }
  async upsertOccurrence(exception: PlanningOccurrenceException) {
    await invoke("plan_occurrence_upsert", { exception });
  }
  async removeOccurrence(id: string) {
    await invoke("plan_occurrence_delete", { id });
  }
  loadChangeSets() {
    return invoke<PlanningChangeSet[]>("plan_change_sets_load");
  }
  async upsertChangeSet(changeSet: PlanningChangeSet) {
    await invoke("plan_change_set_upsert", { changeSet });
  }
  async removeChangeSet(id: string) {
    await invoke("plan_change_set_delete", { id });
  }
  applyChangeSet(request: ApplyChangeSetRequest) {
    return invoke<ChangeSetApplyReport>("plan_apply_change_set", { request });
  }
  undoChangeSet(request: UndoChangeSetRequest) {
    return invoke<ChangeSetApplyReport>("plan_undo_change_set", { request });
  }
}

const LS_CONSTRAINTS = "pbos:planning-action-constraints-v2";
const LS_OCCURRENCES = "pbos:planning-occurrence-exceptions-v2";
const LS_CHANGE_SETS = "pbos:planning-change-sets-v2";

export class LocalAdaptivePlanningRepo implements AdaptivePlanningRepo {
  readonly kind = "localStorage" as const;
  async loadConstraints() {
    return readJson<ActionSchedulingConstraint[]>(LS_CONSTRAINTS, []);
  }
  async upsertConstraint(c: ActionSchedulingConstraint) {
    writeJson(
      LS_CONSTRAINTS,
      upsertBy(await this.loadConstraints(), c, ["actionId"]),
    );
  }
  async removeConstraint(actionId: string) {
    writeJson(
      LS_CONSTRAINTS,
      (await this.loadConstraints()).filter((c) => c.actionId !== actionId),
    );
  }
  async loadOccurrences() {
    return readJson<PlanningOccurrenceException[]>(LS_OCCURRENCES, []);
  }
  async upsertOccurrence(e: PlanningOccurrenceException) {
    writeJson(
      LS_OCCURRENCES,
      upsertBy(await this.loadOccurrences(), e, ["blockId", "occurrenceDate"]),
    );
  }
  async removeOccurrence(id: string) {
    writeJson(
      LS_OCCURRENCES,
      (await this.loadOccurrences()).filter((e) => e.id !== id),
    );
  }
  async loadChangeSets() {
    return readJson<PlanningChangeSet[]>(LS_CHANGE_SETS, []);
  }
  async upsertChangeSet(cs: PlanningChangeSet) {
    writeJson(
      LS_CHANGE_SETS,
      upsertBy(await this.loadChangeSets(), cs, ["id"]),
    );
  }
  async removeChangeSet(id: string) {
    writeJson(
      LS_CHANGE_SETS,
      (await this.loadChangeSets()).filter((cs) => cs.id !== id),
    );
  }
  /** No SQLite transaction in the browser — the store's sequential path runs. */
  async applyChangeSet(_request: ApplyChangeSetRequest): Promise<ChangeSetApplyReport | null> {
    void _request;
    return null;
  }
  async undoChangeSet(_request: UndoChangeSetRequest): Promise<ChangeSetApplyReport | null> {
    void _request;
    return null;
  }
}

export function makeAdaptivePlanningRepo(): AdaptivePlanningRepo {
  return underTauri() ? new SqliteAdaptivePlanningRepo() : new LocalAdaptivePlanningRepo();
}

// =========================================================================
// Today subjective operating state
// =========================================================================

export interface TodayStateRepo {
  readonly kind: "sqlite" | "localStorage";
  load(): Promise<TodayOperatingState[]>;
  get(date: string): Promise<TodayOperatingState | null>;
  set(state: TodayOperatingState): Promise<void>;
  clear(date: string): Promise<void>;
}

class SqliteTodayStateRepo implements TodayStateRepo {
  readonly kind = "sqlite" as const;
  load() {
    return invoke<TodayOperatingState[]>("today_state_load");
  }
  async get(date: string) {
    return (await invoke<TodayOperatingState | null>("today_state_get", { date })) ?? null;
  }
  async set(state: TodayOperatingState) {
    await invoke("today_state_set", { state });
  }
  async clear(date: string) {
    await invoke("today_state_clear", { date });
  }
}

const LS_TODAY = "pbos:today-operating-state-v2";

export class LocalTodayStateRepo implements TodayStateRepo {
  readonly kind = "localStorage" as const;
  private all() {
    return readJson<TodayOperatingState[]>(LS_TODAY, []);
  }
  async load() {
    return this.all().sort((a, b) => (a.date < b.date ? 1 : -1));
  }
  async get(date: string) {
    return this.all().find((s) => s.date === date) ?? null;
  }
  async set(state: TodayOperatingState) {
    writeJson(LS_TODAY, upsertBy(this.all(), state, ["date"]));
  }
  async clear(date: string) {
    writeJson(
      LS_TODAY,
      this.all().filter((s) => s.date !== date),
    );
  }
}

export function makeTodayStateRepo(): TodayStateRepo {
  return underTauri() ? new SqliteTodayStateRepo() : new LocalTodayStateRepo();
}
