/**
 * Performance Buddy OS — the SHARED EXPLICIT MUTATION ENGINE (V2 Phase C).
 *
 * ONE place where a structured proposal — from the AI Coach, from Natural
 * Capture, or from a deterministic domain engine — becomes a canonical change:
 *
 *   structured params
 *     → explicit MutationKind (fails closed on anything unknown)
 *     → resolve the canonical entity
 *     → deterministic validate() — no AI, Phase-23-style reason codes
 *     → preview() before/after
 *     → apply() — calls EXACTLY ONE canonical domain store method
 *     → revision/audit
 *
 * There is deliberately NO generic `applyPatch` / `writeTable` / `runCommand` /
 * model-selected command / raw-SQL path. A `MutationKind` outside
 * `MUTATION_REGISTRY` cannot be applied.
 *
 * This file owns the low-level Apply types the V1 `intelligence/applyAdapters`
 * used to define; that module now re-exports them and projects the four
 * AI-allowlisted kinds out of this registry (no duplicated logic).
 */
import type { ActionInput } from "../performance/types";
import type { PlanningBlockInput, ScheduleBlock } from "../planning/types";
import type { RoutineInput, Routine, CheckInInput } from "../routine/types";
import type { TransactionInput } from "../money/types";
import type { AssessmentInput, CoverageStatus } from "../academic/types";
import type { SessionInput } from "../language/types";
import type { ReviewStateInput } from "../knowledge/types";
import type { RevisionDomain } from "../revision/types";
import type { ValidationResult } from "../intelligence/types";
import type { TodayCapacityLevel, TodayOperatingState } from "../adaptive/types";

export type { ValidationResult };

/** Uniform mutation result shape used by every canonical domain store method. */
export type MutResult = { ok: true; id: string } | { ok: false; errors: Record<string, string> };

// -------------------------------------------------------------------------
// The mutation-kind allowlist
// -------------------------------------------------------------------------

export type MutationKind =
  | "create-action"
  | "create-expense"
  | "routine-checkin"
  | "set-professor-coverage"
  | "set-personal-study"
  | "create-assessment"
  | "update-assessment-date"
  | "update-assessment-scope"
  | "create-language-session"
  | "set-today-capacity"
  | "schedule-block"
  | "set-knowledge-review"
  | "adjust-routine-cadence"
  | "adjust-routine-window"
  | "adjust-routine-duration"
  | "adjust-routine-days";

export const MUTATION_KINDS: readonly MutationKind[] = [
  "create-action",
  "create-expense",
  "routine-checkin",
  "set-professor-coverage",
  "set-personal-study",
  "create-assessment",
  "update-assessment-date",
  "update-assessment-scope",
  "create-language-session",
  "set-today-capacity",
  "schedule-block",
  "set-knowledge-review",
  "adjust-routine-cadence",
  "adjust-routine-window",
  "adjust-routine-duration",
  "adjust-routine-days",
];

export function isMutationKind(v: unknown): v is MutationKind {
  return typeof v === "string" && (MUTATION_KINDS as readonly string[]).includes(v);
}

// -------------------------------------------------------------------------
// Context — the live canonical-store bundle a mutation is allowed to touch
// -------------------------------------------------------------------------

/**
 * The V1 four-slice bundle. Kept as its own name because `intelligence/store`,
 * `RecommendationCard` and the V1 tests all type against it. `routine` gains an
 * OPTIONAL `checkInRoutine` — absent in the V1 AI path, present for Natural
 * Capture's `routine-checkin`.
 */
export type ApplyContext = {
  performance: {
    systems: { id: string; title: string }[];
    createAction: (systemId: string | null, input: ActionInput) => Promise<MutResult>;
  };
  planning: {
    blocks: ScheduleBlock[];
    capacity: { dailyCapacityMinutes: number; weeklyCapacityMinutes: number };
    checkFit: (candidate: ScheduleBlock) => { fits: boolean; reason: string | null };
    createBlock: (input: PlanningBlockInput) => Promise<MutResult>;
  };
  knowledge: {
    topics: { id: string; title: string; nextReviewDate: string | null; lastStudied: string | null }[];
    updateReviewState: (topicId: string, input: ReviewStateInput) => Promise<MutResult>;
  };
  routine: {
    routines: Routine[];
    updateRoutine: (id: string, input: RoutineInput) => Promise<MutResult>;
    checkInRoutine?: (routineId: string, input: CheckInInput) => Promise<MutResult>;
  };
};

/** Minimal canonical shape a Money mutation may read/write. */
export type MoneyMutationSlice = {
  /** Known expense categories, for resolution. Empty ⇒ category stays unknown. */
  categories: string[];
  createTransaction: (input: TransactionInput) => Promise<MutResult>;
};

/** Minimal canonical shape an Academic mutation may read/write. */
export type AcademicMutationSlice = {
  courses: { id: string; title: string; code: string }[];
  topics: {
    id: string;
    courseId: string;
    title: string;
    professorCoverage: CoverageStatus;
    personalStudyPercent: number;
  }[];
  assessments: {
    id: string;
    courseId: string;
    title: string;
    category: AssessmentInput["category"];
    obtainedMarks: number | null;
    totalMarks: number;
    weightPercent: number;
    date: string;
  }[];
  setProfessorCoverage: (topicId: string, coverage: CoverageStatus) => Promise<MutResult>;
  setPersonalStudyCoverage: (topicId: string, percent: number) => Promise<MutResult>;
  createAssessment: (courseId: string, input: AssessmentInput) => Promise<MutResult>;
  updateAssessment: (id: string, input: AssessmentInput) => Promise<MutResult>;
  /** Topic ids already in an assessment's explicit scope (schema v11). */
  scopeTopicIds: (assessmentId: string) => string[];
  setAssessmentScope: (
    assessmentId: string,
    topicIds: string[],
    source: string,
    now: string,
  ) => Promise<void>;
};

export type LanguageMutationSlice = {
  paths: { id: string; language: string; title: string }[];
  logSession: (pathId: string, input: SessionInput) => Promise<MutResult | { ok: boolean }>;
};

export type TodayMutationSlice = {
  getCapacity: (date: string) => TodayCapacityLevel | null;
  setCapacity: (state: TodayOperatingState) => Promise<void>;
};

/**
 * The full context. The four V1 slices are always present; the V2 slices are
 * optional so a caller that only wires the AI path still typechecks, and a
 * mutation whose slice is missing fails validation with a clear reason rather
 * than throwing.
 */
export type MutationContext = ApplyContext & {
  money?: MoneyMutationSlice;
  academic?: AcademicMutationSlice;
  language?: LanguageMutationSlice;
  today?: TodayMutationSlice;
};

// -------------------------------------------------------------------------
// The descriptor
// -------------------------------------------------------------------------

export type ApplyOutcome = {
  ok: boolean;
  result: Record<string, unknown>;
  message: string;
};

export type MutationDescriptor = {
  kind: MutationKind;
  /** Product domain label, e.g. "Academics", "Planning". */
  domain: string;
  label: string;
  /** True ⇒ applying this should prompt a re-plan (Planning Diff). */
  triggersReplan: boolean;
  /** Which cross-domain revision log this mutation writes to. */
  revisionDomain: RevisionDomain;
  /** Entity-type tag for the revision row (defaults to `kind`). */
  revisionEntityType?: string;
  validate: (params: Record<string, unknown>, ctx: MutationContext) => ValidationResult;
  describeCurrent: (params: Record<string, unknown>, ctx: MutationContext) => Record<string, unknown>;
  preview: (params: Record<string, unknown>, ctx: MutationContext) => { before: string; after: string };
  apply: (params: Record<string, unknown>, ctx: MutationContext) => Promise<ApplyOutcome>;
};

// -------------------------------------------------------------------------
// Shared coercion + result helpers (used by every descriptor)
// -------------------------------------------------------------------------

export const str = (v: unknown, fb = ""): string => (typeof v === "string" ? v.trim() : fb);
export const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;
export const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

export function ok(message: string): ValidationResult {
  return { ok: true, reasonCodes: [], message };
}
export function fail(code: string, message: string): ValidationResult {
  return { ok: false, reasonCodes: [code], message };
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
export function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function isIsoDate(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
}
export function hhmm(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
export const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
