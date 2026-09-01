/**
 * Academic Intelligence — deterministic attention + Study Requirement derivation
 * (V2 Phase E). Extends `studyEngine.ts` (which stays as-is) rather than
 * replacing it.
 *
 * Laws it keeps:
 *   - NO universal `priorityScore`. Ordering is an inspectable predicate list
 *     that changes with the study mode; nothing is a weighted sum.
 *   - Assessment scope is EXPLICIT. A topic is "in scope" only if the caller
 *     passes it in `scopedAssessments`; it is never inferred from the course.
 *   - Unknown stays unknown. No evidence ⇒ `no-evidence`, never "0% mastered".
 *   - Repeated unresolved weakness yields a METHOD-change reason, never a
 *     mastery change.
 *   - Course attention is DERIVED (`immediate | watch | stable`); it never
 *     mutates the stored `Course.status`.
 *   - Grade / SGPA / CGPA math is untouched — this module does no arithmetic
 *     on marks.
 */
import type { KnowledgeState } from "../knowledge/types";
import type { CoverageStatus } from "./types";
import type { StudyMode, StudyReason } from "./studyEngine";

// -------------------------------------------------------------------------
// Reason vocabulary (superset of studyEngine's StudyReason)
// -------------------------------------------------------------------------

export type AttentionReason =
  | StudyReason
  | "assessment-imminent"
  | "in-assessment-scope"
  | "high-weight-assessment"
  | "repeated-unresolved-weakness"
  | "recently-studied"
  | "user-priority";

export const ATTENTION_REASON_LABEL: Record<AttentionReason, string> = {
  "review-due": "Knowledge review due",
  "professor-covered-not-studied": "Professor covered · not personally completed",
  "evidence-weak": "Knowledge evidence weak",
  "no-evidence": "No mastery evidence yet",
  "in-progress": "Personal study in progress",
  "not-started": "Not personally started",
  "assessment-imminent": "An assessment covering this is close",
  "in-assessment-scope": "Explicitly in the nearest assessment's scope",
  "high-weight-assessment": "The nearest scoped assessment carries heavy weight",
  "repeated-unresolved-weakness": "Weak across repeated checks — the method may need to change",
  "recently-studied": "Recently studied — likely fine for now",
  "user-priority": "You marked this a priority",
};

// -------------------------------------------------------------------------
// Input
// -------------------------------------------------------------------------

export type ScopedAssessmentRef = {
  assessmentId: string;
  title: string;
  /** ISO date. "" ⇒ no date set — never treated as imminent. */
  date: string;
  weightPercent: number;
};

export type AcademicTopicSignal = {
  academicTopicId: string;
  courseId: string;
  courseTitle: string;
  topicTitle: string;
  professorCoverage: CoverageStatus;
  personalStudyPercent: number;
  knowledgeTopicId: string | null;
  knowledge: { state: KnowledgeState; hasEvidence: boolean; reviewDue: boolean } | null;
  /** Assessments whose EXPLICIT scope includes this topic (schema v11). */
  scopedAssessments: ScopedAssessmentRef[];
  /** Days since the last linked Focus session, or null when never. */
  daysSinceLastFocus: number | null;
  /** How many consecutive governed checks left this topic weak/unresolved. */
  unresolvedWeaknessStreak: number;
  /** The user flagged this topic to prioritise. */
  userPriority: boolean;
  /** Suggested total study minutes (from the caller — never invented here). */
  suggestedMinutes: number | null;
};

// -------------------------------------------------------------------------
// Config (centralised, tested)
// -------------------------------------------------------------------------

export const ATTENTION_CONFIG = {
  /** An assessment within this many days counts as "imminent". */
  imminentDays: 10,
  /** weightPercent at/above this is "high weight" context. */
  highWeightPercent: 25,
  /** A Focus session within this many days makes a topic "recently studied". */
  recentlyStudiedDays: 3,
  /** Streak length that flips a topic to "method may need to change". */
  repeatedWeaknessStreak: 3,
  /** Default minimum useful contiguous study block. */
  defaultMinimumBlockMinutes: 30,
  /** Fallback suggested total when the caller gives none. */
  fallbackSuggestedMinutes: 45,
} as const;

function daysUntil(iso: string, now: Date): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const target = new Date(`${iso}T00:00:00Z`).getTime();
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  ).getTime();
  return Math.round((target - today) / 86_400_000);
}

/** The nearest scoped assessment that is today or later. */
export function nearestScopedAssessment(
  t: AcademicTopicSignal,
  now: Date,
): ScopedAssessmentRef | null {
  const upcoming = t.scopedAssessments
    .map((a) => ({ a, d: daysUntil(a.date, now) }))
    .filter((x): x is { a: ScopedAssessmentRef; d: number } => x.d !== null && x.d >= 0)
    .sort((x, y) => x.d - y.d);
  return upcoming[0]?.a ?? null;
}

// -------------------------------------------------------------------------
// Reasons
// -------------------------------------------------------------------------

export function reasonsForSignal(t: AcademicTopicSignal, now: Date): AttentionReason[] {
  const out: AttentionReason[] = [];
  const reviewDue = t.knowledge?.reviewDue ?? false;
  const weak =
    !!t.knowledge?.hasEvidence && (t.knowledge.state === "new" || t.knowledge.state === "learning");
  const noEvidence = !!t.knowledgeTopicId && !(t.knowledge?.hasEvidence ?? false);
  const covered = t.professorCoverage === "taught" || t.professorCoverage === "in-progress";
  const nearest = nearestScopedAssessment(t, now);
  const daysToNearest = nearest ? daysUntil(nearest.date, now) : null;

  if (t.userPriority) out.push("user-priority");
  if (nearest) out.push("in-assessment-scope");
  if (daysToNearest !== null && daysToNearest <= ATTENTION_CONFIG.imminentDays) {
    out.push("assessment-imminent");
  }
  if (nearest && nearest.weightPercent >= ATTENTION_CONFIG.highWeightPercent) {
    out.push("high-weight-assessment");
  }
  if (reviewDue) out.push("review-due");
  if (covered && t.personalStudyPercent < 100) out.push("professor-covered-not-studied");
  if (t.unresolvedWeaknessStreak >= ATTENTION_CONFIG.repeatedWeaknessStreak) {
    out.push("repeated-unresolved-weakness");
  }
  if (weak) out.push("evidence-weak");
  if (noEvidence) out.push("no-evidence");
  if (t.personalStudyPercent > 0 && t.personalStudyPercent < 100) out.push("in-progress");
  if (t.personalStudyPercent === 0) out.push("not-started");
  if (
    t.daysSinceLastFocus !== null &&
    t.daysSinceLastFocus <= ATTENTION_CONFIG.recentlyStudiedDays
  ) {
    out.push("recently-studied");
  }
  return out;
}

// -------------------------------------------------------------------------
// Mode-specific ordering (predicate lists — first match sets the rank)
// -------------------------------------------------------------------------

type Pred = (r: AttentionReason[]) => boolean;
const has =
  (...codes: AttentionReason[]): Pred =>
  (r) =>
    codes.every((c) => r.includes(c));

const MODE_PREDICATES: Record<StudyMode, Pred[]> = {
  normal: [
    has("review-due"),
    has("assessment-imminent", "in-assessment-scope"),
    has("professor-covered-not-studied"),
    has("repeated-unresolved-weakness"),
    has("evidence-weak"),
    has("no-evidence"),
    has("in-progress"),
    has("not-started"),
  ],
  // Midterm / Final: topics explicitly in the nearest assessment's scope and
  // still unresolved come FIRST. Scope is never invented; a topic with no
  // scoped assessment simply cannot match the first two predicates.
  exam: [
    has("in-assessment-scope", "no-evidence"),
    has("in-assessment-scope", "evidence-weak"),
    has("in-assessment-scope", "professor-covered-not-studied"),
    has("in-assessment-scope"),
    has("review-due"),
    has("professor-covered-not-studied"),
    has("evidence-weak"),
    has("no-evidence"),
    has("in-progress"),
    has("not-started"),
  ],
  // Recovery: smallest useful restart among the weakest; no backlog punishment.
  recovery: [
    has("evidence-weak"),
    has("professor-covered-not-studied"),
    has("no-evidence"),
    has("not-started"),
  ],
};

// -------------------------------------------------------------------------
// Study Requirement — a transient typed candidate, NOT a persisted task
// -------------------------------------------------------------------------

export type StudyRequirement = {
  academicTopicId: string;
  courseId: string;
  courseTitle: string;
  topicTitle: string;
  reasons: AttentionReason[];
  /** ISO date the nearest scoped assessment falls on, or null. */
  requiredBefore: string | null;
  suggestedMinutes: number;
  minimumBlockMinutes: number;
  evidenceState: "review-due" | "weak" | "none" | "unknown" | "recently-studied";
  /** A linked canonical Action, if the caller found one. Never invented here. */
  linkedActionId: string | null;
  /** Present only when repeated weakness suggests changing HOW it is studied. */
  methodSuggestion: string | null;
  /** Lower = sooner. Set purely by which predicate first matched. */
  rank: number;
};

function evidenceStateOf(reasons: AttentionReason[]): StudyRequirement["evidenceState"] {
  if (reasons.includes("recently-studied")) return "recently-studied";
  if (reasons.includes("review-due")) return "review-due";
  if (reasons.includes("evidence-weak")) return "weak";
  if (reasons.includes("no-evidence")) return "none";
  return "unknown";
}

export function selectStudyRequirements(
  signals: AcademicTopicSignal[],
  mode: StudyMode,
  now: Date = new Date(),
): StudyRequirement[] {
  const preds = MODE_PREDICATES[mode];
  const out: StudyRequirement[] = [];
  for (const t of signals) {
    const reasons = reasonsForSignal(t, now);
    let rank = preds.findIndex((p) => p(reasons));
    if (rank === -1) {
      if (mode === "recovery") continue;
      rank = preds.length;
    }
    const nearest = nearestScopedAssessment(t, now);
    out.push({
      academicTopicId: t.academicTopicId,
      courseId: t.courseId,
      courseTitle: t.courseTitle,
      topicTitle: t.topicTitle,
      reasons,
      requiredBefore: nearest && /^\d{4}-\d{2}-\d{2}$/.test(nearest.date) ? nearest.date : null,
      suggestedMinutes: t.suggestedMinutes ?? ATTENTION_CONFIG.fallbackSuggestedMinutes,
      minimumBlockMinutes: ATTENTION_CONFIG.defaultMinimumBlockMinutes,
      evidenceState: evidenceStateOf(reasons),
      linkedActionId: null,
      methodSuggestion: reasons.includes("repeated-unresolved-weakness")
        ? `“${t.topicTitle}” has stayed weak across ${t.unresolvedWeaknessStreak} checks — try a different method (worked examples, teach-back, spaced recall) rather than more of the same.`
        : null,
      rank,
    });
  }
  return out.sort(
    (a, b) =>
      a.rank - b.rank ||
      a.courseTitle.localeCompare(b.courseTitle) ||
      a.topicTitle.localeCompare(b.topicTitle),
  );
}

export function nextStudyRequirement(
  signals: AcademicTopicSignal[],
  mode: StudyMode,
  now: Date = new Date(),
): StudyRequirement | null {
  return selectStudyRequirements(signals, mode, now)[0] ?? null;
}

// -------------------------------------------------------------------------
// Course-level attention (derived; never mutates Course.status)
// -------------------------------------------------------------------------

export type CourseAttention = {
  courseId: string;
  state: "immediate" | "watch" | "stable";
  reasons: string[];
};

export function deriveCourseAttention(
  courseId: string,
  courseSignals: AcademicTopicSignal[],
  now: Date = new Date(),
): CourseAttention {
  const perTopic = courseSignals.map((t) => ({ reasons: reasonsForSignal(t, now) }));

  const immediate = perTopic.filter(
    ({ reasons }) =>
      reasons.includes("assessment-imminent") &&
      reasons.includes("in-assessment-scope") &&
      (reasons.includes("no-evidence") ||
        reasons.includes("evidence-weak") ||
        reasons.includes("professor-covered-not-studied") ||
        reasons.includes("review-due")),
  );
  if (immediate.length > 0) {
    return {
      courseId,
      state: "immediate",
      reasons: [
        `${immediate.length} scoped topic(s) still unresolved with an assessment within ${ATTENTION_CONFIG.imminentDays} days`,
      ],
    };
  }

  const watch = perTopic.filter(
    ({ reasons }) =>
      reasons.includes("professor-covered-not-studied") ||
      reasons.includes("review-due") ||
      reasons.includes("repeated-unresolved-weakness") ||
      reasons.includes("no-evidence"),
  );
  if (watch.length > 0) {
    const bits: string[] = [];
    const covered = watch.filter((w) => w.reasons.includes("professor-covered-not-studied")).length;
    const due = watch.filter((w) => w.reasons.includes("review-due")).length;
    const method = watch.filter((w) => w.reasons.includes("repeated-unresolved-weakness")).length;
    if (covered) bits.push(`${covered} covered but not studied`);
    if (due) bits.push(`${due} review due`);
    if (method) bits.push(`${method} needing a method change`);
    return { courseId, state: "watch", reasons: bits.length ? bits : ["coverage / evidence gap"] };
  }

  return { courseId, state: "stable", reasons: ["No material current attention signal"] };
}
