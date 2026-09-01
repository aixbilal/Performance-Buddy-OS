/**
 * Natural Capture V2 — the DETERMINISTIC local engine (V2 Phase D).
 *
 * Pure, testable, no React, no network. Given raw text it:
 *   1. segments the text on connectives / newlines / sentences,
 *   2. classifies each segment to a domain + a `MutationKind` + a
 *      fact/interpretation class + a qualitative confidence,
 *   3. routes segments for optional remote enhancement — a segment is only
 *      remote-eligible when its domain is identified locally AND that domain has
 *      at least Read permission (Money is no-access by default, so it never
 *      leaves the device),
 *   4. resolves canonical entities through injected resolvers (existing first;
 *      ambiguous ⇒ ask, never guess),
 *   5. flags a segment that duplicates an existing canonical Focus/session
 *      event so the user can reuse it instead of double-logging,
 *   6. produces `CaptureProposalRecord`s ready for the shared mutation registry.
 *
 * What it never does: invent a number the user did not say (a personal-study %,
 * a mastery score), store a "you should…" as a fact, or send a no-access
 * segment anywhere.
 */
import type {
  CaptureProposalClass,
  CaptureProposalConfidence,
  CaptureProposalRecord,
} from "../adaptive/types";
import type { MutationKind } from "../mutations/types";
import { canReadDomain, type DomainPermissions } from "../ai/context";

// -------------------------------------------------------------------------
// Segmentation
// -------------------------------------------------------------------------

export type CaptureSegment = { index: number; text: string };

const SEGMENT_SPLIT =
  /\s*(?:\r?\n+|;|\.\s+|\band also\b|\balso,?\b|\band then\b|\bthen\b|\band\b(?=\s+(?:i|we|prof|the|my)\b))\s*/i;

/** Break raw text into reviewable clauses. Order and 1:1 provenance are kept. */
export function segmentCapture(rawText: string): CaptureSegment[] {
  return rawText
    .split(SEGMENT_SPLIT)
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .map((text, index) => ({ index, text }));
}

// -------------------------------------------------------------------------
// Classification
// -------------------------------------------------------------------------

/** AI-context domain labels (subset used by Natural Capture). */
export type CaptureDomain =
  | "Money"
  | "Academics"
  | "Reading & Language"
  | "Routines"
  | "Goals & Systems"
  | "Today"
  | "unknown";

export type SegmentClassification = {
  segment: CaptureSegment;
  domain: CaptureDomain;
  /** null ⇒ no canonical destination; the segment stays in the inbox. */
  mutationKind: MutationKind | null;
  proposalClass: CaptureProposalClass;
  confidence: CaptureProposalConfidence;
  /** Extracted, literal params only — never a guessed number. */
  params: Record<string, unknown>;
  rationale: string;
  ambiguityReason?: string;
};

const AMOUNT = /(?:rs\.?|pkr|\$|€|£)?\s*(\d[\d,]*(?:\.\d+)?)/i;
const EXPENSE_VERB = /\b(spent|paid|bought|purchased|expense|cost)\b/i;
const CURRENCY = /\b(rs\.?|pkr|\$|€|£)\b/i;
const COVERAGE_VERB = /\b(cover(?:ed|ing)?|taught|went over|finished|did|got through)\b/i;
const PROF_SUBJECT = /\b(prof(?:essor)?|lecturer|teacher|class|lecture|course)\b/i;
const STUDY_VERB = /\b(studied|revised|reviewed|practi[cs]ed|worked on|read up on)\b/i;
const ASSESSMENT_NOUN = /\b(quiz|midterm|mid-term|final|exam|test|assignment|assessment|viva)\b/i;
const ASSESSMENT_MOVE = /\b(moved to|rescheduled to|postponed to|now on|is on|shifted to)\b/i;
const SCOPE_VERB = /\b(covers|includes|will be on|scope is|is about|focuses on)\b/i;
const LANG_NAME =
  /\b(german|french|spanish|arabic|urdu|mandarin|chinese|japanese|italian|portuguese|russian|korean|hindi|turkish|dutch)\b/i;
const DURATION = /\b(\d+(?:\.\d+)?)\s*(min(?:ute)?s?|h(?:ou)?rs?)\b/i;
const ROUTINE_DONE = /\b(did|done|completed|finished|kept up|hit)\b/i;
const ROUTINE_HINT =
  /\b(hydration|water|prayer|skincare|workout|exercise|meditat|journal|review|reading|stretch|walk|steps)\b/i;
const ACTION_INTENT = /\b(need to|have to|must|should|remember to|to-?do|task:|don't forget to)\b/i;
const LOW_ENERGY = /\b(tired|exhausted|drained|rough night|no energy|low energy|burnt out|worn out|sick)\b/i;
const HIGH_ENERGY = /\b(well rested|great energy|high energy|feeling sharp|energised|energized|fresh)\b/i;
const ISO_DATE = /\b(\d{4}-\d{2}-\d{2})\b/;
const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

function minutesFrom(match: RegExpMatchArray | null): number | null {
  if (!match) return null;
  const n = parseFloat(match[1]);
  if (!Number.isFinite(n)) return null;
  return /^h/i.test(match[2]) ? Math.round(n * 60) : Math.round(n);
}

/** Resolve "on friday" → the next ISO date that is that weekday (>= today). */
export function nextWeekdayIso(name: string, from: Date): string | null {
  const target = WEEKDAYS.indexOf(name.toLowerCase());
  if (target < 0) return null;
  // JS getDay(): 0=Sun..6=Sat; our WEEKDAYS index 0=Mon..6=Sun.
  const jsTarget = (target + 1) % 7;
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  for (let i = 1; i <= 7; i++) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (d.getUTCDay() === jsTarget) return d.toISOString().slice(0, 10);
  }
  return null;
}

export function classifySegment(segment: CaptureSegment, now: Date = new Date()): SegmentClassification {
  const text = segment.text;
  const lower = text.toLowerCase();
  const base = { segment, params: {} as Record<string, unknown> };

  // --- Money — expense -------------------------------------------------
  if (EXPENSE_VERB.test(lower) || (CURRENCY.test(lower) && AMOUNT.test(lower))) {
    const amt = lower.match(AMOUNT);
    const amount = amt ? parseFloat(amt[1].replace(/,/g, "")) : null;
    const onFor = lower.match(/\bon\s+([a-z][a-z ]{2,30})|\bfor\s+([a-z][a-z ]{2,30})/i);
    const category = onFor ? (onFor[1] ?? onFor[2] ?? "").trim() : "";
    return {
      ...base,
      domain: "Money",
      mutationKind: "create-expense",
      proposalClass: "fact",
      confidence: amount !== null ? "needs-review" : "ambiguous",
      params: { amount: amount ?? undefined, category, description: text },
      rationale: "Reads as money that was actually spent.",
      ambiguityReason: amount === null ? "No amount could be read from the text." : undefined,
    };
  }

  // --- Academics — professor coverage --------------------------------
  if (PROF_SUBJECT.test(lower) && COVERAGE_VERB.test(lower)) {
    const topic = extractSubject(text, /\b(cover(?:ed|ing)?|taught|went over|finished|did|got through)\b/i);
    return {
      ...base,
      domain: "Academics",
      mutationKind: "set-professor-coverage",
      proposalClass: "interpretation",
      confidence: topic ? "needs-review" : "ambiguous",
      params: { topicTitle: topic ?? "", coverage: "taught" },
      rationale: 'Interpreted "covered / taught" as professor coverage = taught.',
      ambiguityReason: topic ? undefined : "Could not tell which topic was covered.",
    };
  }

  // --- Academics — assessment date move -----------------------------
  if (ASSESSMENT_NOUN.test(lower) && ASSESSMENT_MOVE.test(lower)) {
    const iso = text.match(ISO_DATE)?.[1] ?? null;
    const wd = WEEKDAYS.find((w) => lower.includes(w));
    const date = iso ?? (wd ? nextWeekdayIso(wd, now) : null);
    const title = extractSubject(text, ASSESSMENT_MOVE) ?? text.match(ASSESSMENT_NOUN)?.[0] ?? "";
    return {
      ...base,
      domain: "Academics",
      mutationKind: "update-assessment-date",
      proposalClass: "fact",
      confidence: date ? "needs-review" : "ambiguous",
      params: { assessmentTitle: title, date: date ?? undefined },
      rationale: "Reads as an assessment being moved to a new date.",
      ambiguityReason: date ? undefined : "The new date is not specific enough to use.",
    };
  }

  // --- Academics — assessment scope --------------------------------
  if (ASSESSMENT_NOUN.test(lower) && SCOPE_VERB.test(lower)) {
    const after = text.split(SCOPE_VERB)[1] ?? "";
    const topicTitles = after
      .split(/\s*(?:,|and)\s*/i)
      .map((t) => t.replace(/[.!?]+$/, "").trim())
      .filter((t) => t.length > 1);
    return {
      ...base,
      domain: "Academics",
      mutationKind: "update-assessment-scope",
      proposalClass: "fact",
      confidence: "ambiguous",
      params: { assessmentTitle: text.match(ASSESSMENT_NOUN)?.[0] ?? "", topicTitles },
      rationale: "Reads as the topic scope of an assessment.",
      ambiguityReason: "Confirm which assessment and which existing topics this maps to.",
    };
  }

  // --- Reading & Language — study session --------------------------
  if (LANG_NAME.test(lower) && DURATION.test(lower)) {
    const minutes = minutesFrom(lower.match(DURATION));
    const language = (lower.match(LANG_NAME)?.[0] ?? "").replace(/^\w/, (c) => c.toUpperCase());
    return {
      ...base,
      domain: "Reading & Language",
      mutationKind: "create-language-session",
      proposalClass: "fact",
      confidence: minutes ? "clear" : "needs-review",
      params: { language, durationMinutes: minutes ?? undefined, activity: "lesson", description: text },
      rationale: "Reads as a completed language study session.",
    };
  }

  // --- Academics — personal study (activity, NOT a % ) ------------
  if (STUDY_VERB.test(lower)) {
    const topic = extractSubject(text, STUDY_VERB);
    return {
      ...base,
      domain: "Academics",
      mutationKind: "set-personal-study",
      proposalClass: "interpretation",
      confidence: "ambiguous",
      params: { topicTitle: topic ?? "" },
      rationale: "Reads as personal study of a topic.",
      ambiguityReason:
        "Personal study is a percentage you set — the text says you studied, not how far along you are.",
    };
  }

  // --- Routines — check-in ---------------------------------------
  if (ROUTINE_HINT.test(lower) && ROUTINE_DONE.test(lower)) {
    const hint = (lower.match(ROUTINE_HINT)?.[0] ?? "").trim();
    return {
      ...base,
      domain: "Routines",
      mutationKind: "routine-checkin",
      proposalClass: "fact",
      confidence: "needs-review",
      params: { match: hint, state: "complete", date: now.toISOString().slice(0, 10) },
      rationale: "Reads as a routine being completed today.",
    };
  }

  // --- Today — subjective capacity -----------------------------
  if (LOW_ENERGY.test(lower) || HIGH_ENERGY.test(lower)) {
    const level = LOW_ENERGY.test(lower) ? "low" : "high";
    return {
      ...base,
      domain: "Today",
      mutationKind: "set-today-capacity",
      proposalClass: "interpretation",
      confidence: "needs-review",
      params: { capacityLevel: level, date: now.toISOString().slice(0, 10), note: text },
      rationale: `Interpreted the tone as ${level} operating capacity for today — confirm before it changes anything.`,
    };
  }

  // --- Goals & Systems — an intent to do something ------------
  if (ACTION_INTENT.test(lower)) {
    const title = text.replace(ACTION_INTENT, "").replace(/^[\s:,-]+/, "").trim() || text;
    return {
      ...base,
      domain: "Goals & Systems",
      mutationKind: "create-action",
      proposalClass: "interpretation",
      confidence: "needs-review",
      params: { title, context: "Natural Capture" },
      rationale: "Reads as a task you intend to do.",
    };
  }

  // --- Nothing structured -----------------------------------
  return {
    ...base,
    domain: "unknown",
    mutationKind: null,
    proposalClass: "fact",
    confidence: "ambiguous",
    params: {},
    rationale: "No canonical structure was recognised — kept as raw capture.",
    ambiguityReason: "PBOS could not classify this — leave it, or classify it manually.",
  };
}

/** Grab the noun-ish phrase after a trigger verb, trimmed to a topic label. */
function extractSubject(text: string, trigger: RegExp): string | null {
  const parts = text.split(trigger);
  const tail = (parts[parts.length - 1] ?? "").trim();
  const cleaned = tail
    .replace(/^(the|a|an|our|my|some|todays?|today's)\s+/i, "")
    .replace(/\b(today|yesterday|in class|this week|already)\b/gi, "")
    .replace(/[.!?,]+$/, "")
    .trim();
  return cleaned.length > 1 ? cleaned : null;
}

// -------------------------------------------------------------------------
// Permission routing — what may be sent to a remote provider
// -------------------------------------------------------------------------

const DOMAIN_TO_PERMISSION: Record<Exclude<CaptureDomain, "unknown">, string> = {
  Money: "Money",
  Academics: "Academics",
  "Reading & Language": "Reading & Language",
  Routines: "Routines",
  "Goals & Systems": "Goals & Systems",
  Today: "Today",
};

export type ProviderRouting = {
  remoteEligible: SegmentClassification[];
  localOnly: SegmentClassification[];
};

/**
 * A segment may be sent for remote enhancement ONLY if its domain was
 * identified locally AND that domain has at least Read permission. Unknown or
 * no-access segments stay on the device.
 */
export function routeForProvider(
  classified: SegmentClassification[],
  permissions: DomainPermissions,
): ProviderRouting {
  const remoteEligible: SegmentClassification[] = [];
  const localOnly: SegmentClassification[] = [];
  for (const c of classified) {
    const permDomain = c.domain === "unknown" ? null : DOMAIN_TO_PERMISSION[c.domain];
    if (permDomain && canReadDomain(permDomain, permissions)) remoteEligible.push(c);
    else localOnly.push(c);
  }
  return { remoteEligible, localOnly };
}

// -------------------------------------------------------------------------
// Entity resolution + duplicate detection (injected — pure engine stays testable)
// -------------------------------------------------------------------------

export type EntityResolution =
  | { status: "resolved"; id: string; label: string }
  | { status: "ambiguous"; candidates: { id: string; label: string }[] }
  | { status: "none" };

export type CaptureResolvers = {
  resolveAcademicTopic?: (title: string) => EntityResolution;
  resolveAssessment?: (title: string) => EntityResolution;
  resolveRoutine?: (hint: string) => EntityResolution;
  resolveLanguagePath?: (language: string) => EntityResolution;
  resolveExpenseCategory?: (raw: string) => EntityResolution;
};

export type DuplicateEvidence = {
  /** e.g. "Focus session · German · 25 min · 2026-09-01" */
  label: string;
  sessionId: string;
};

export type DuplicateDetector = (c: SegmentClassification) => DuplicateEvidence | null;

// -------------------------------------------------------------------------
// Proposal building
// -------------------------------------------------------------------------

export type BuildProposalsArgs = {
  captureId: string;
  rawText: string;
  now?: Date;
  permissions: DomainPermissions;
  resolvers?: CaptureResolvers;
  detectDuplicate?: DuplicateDetector;
  newId: () => string;
};

export type BuildProposalsResult = {
  proposals: CaptureProposalRecord[];
  /** Segments with no canonical structure — kept on the raw inbox item. */
  unclassified: CaptureSegment[];
  routing: ProviderRouting;
};

const RESOLVE_FIELD: Partial<Record<MutationKind, { param: string; resolver: keyof CaptureResolvers; idParam: string }>> = {
  "set-professor-coverage": { param: "topicTitle", resolver: "resolveAcademicTopic", idParam: "topicId" },
  "set-personal-study": { param: "topicTitle", resolver: "resolveAcademicTopic", idParam: "topicId" },
  "update-assessment-date": { param: "assessmentTitle", resolver: "resolveAssessment", idParam: "assessmentId" },
  "update-assessment-scope": { param: "assessmentTitle", resolver: "resolveAssessment", idParam: "assessmentId" },
  "routine-checkin": { param: "match", resolver: "resolveRoutine", idParam: "routineId" },
  "create-language-session": { param: "language", resolver: "resolveLanguagePath", idParam: "pathId" },
  "create-expense": { param: "category", resolver: "resolveExpenseCategory", idParam: "category" },
};

export function buildProposals(args: BuildProposalsArgs): BuildProposalsResult {
  const now = args.now ?? new Date();
  const nowIso = now.toISOString();
  const segments = segmentCapture(args.rawText);
  const classified = segments.map((s) => classifySegment(s, now));
  const routing = routeForProvider(classified, args.permissions);

  const proposals: CaptureProposalRecord[] = [];
  const unclassified: CaptureSegment[] = [];

  for (const c of classified) {
    if (!c.mutationKind) {
      unclassified.push(c.segment);
      continue;
    }
    let params = { ...c.params };
    let confidence = c.confidence;
    let ambiguityReason = c.ambiguityReason;
    const evidence: string[] = [];

    // Entity resolution — existing first, ambiguous ⇒ ask.
    const rf = RESOLVE_FIELD[c.mutationKind];
    if (rf && args.resolvers?.[rf.resolver]) {
      const raw = String(params[rf.param] ?? "").trim();
      if (raw) {
        const res = args.resolvers[rf.resolver]!(raw);
        if (res.status === "resolved") {
          params[rf.idParam] = res.id;
          evidence.push(`Matched existing: ${res.label}`);
        } else if (res.status === "ambiguous") {
          confidence = "ambiguous";
          ambiguityReason = `"${raw}" matches ${res.candidates.length} existing entries — pick one.`;
          params.candidates = res.candidates;
        } else {
          // none — a new canonical entity would be needed; keep it review-worthy
          if (confidence === "clear") confidence = "needs-review";
          evidence.push(`No existing match for "${raw}" — creating a new one needs confirmation.`);
        }
      }
    }

    // Duplicate canonical evidence — offer reuse instead of a second log.
    const dup = args.detectDuplicate?.(c) ?? null;
    if (dup) {
      confidence = "needs-review";
      ambiguityReason = "PBOS already recorded a matching session — reuse it or record separately.";
      params.duplicateOf = dup.sessionId;
      evidence.push(`Possible duplicate of ${dup.label}`);
    }

    proposals.push({
      id: args.newId(),
      captureId: args.captureId,
      proposalClass: c.proposalClass,
      domain: c.domain,
      mutationKind: c.mutationKind,
      title: proposalTitle(c),
      sourceText: c.segment.text,
      confidence,
      ambiguityReason: ambiguityReason ?? null,
      rationale: c.rationale,
      evidenceJson: JSON.stringify(evidence),
      originalParamsJson: JSON.stringify(c.params),
      effectiveParamsJson: JSON.stringify(params),
      status: "proposed",
      validationJson: null,
      appliedResultJson: null,
      createdAt: nowIso,
      decidedAt: null,
      appliedAt: null,
    });
  }

  return { proposals, unclassified, routing };
}

function proposalTitle(c: SegmentClassification): string {
  switch (c.mutationKind) {
    case "create-expense":
      return `Expense${c.params.amount ? ` of ${c.params.amount}` : ""}${c.params.category ? ` · ${String(c.params.category)}` : ""}`;
    case "set-professor-coverage":
      return `Professor covered "${String(c.params.topicTitle) || "a topic"}"`;
    case "set-personal-study":
      return `Studied "${String(c.params.topicTitle) || "a topic"}"`;
    case "update-assessment-date":
      return `Move "${String(c.params.assessmentTitle) || "assessment"}"${c.params.date ? ` to ${String(c.params.date)}` : ""}`;
    case "update-assessment-scope":
      return `Scope for "${String(c.params.assessmentTitle) || "assessment"}"`;
    case "create-language-session":
      return `${String(c.params.language) || "Language"} session${c.params.durationMinutes ? ` · ${String(c.params.durationMinutes)} min` : ""}`;
    case "routine-checkin":
      return `Routine check-in · ${String(c.params.match) || "routine"}`;
    case "set-today-capacity":
      return `Today capacity: ${String(c.params.capacityLevel)}`;
    case "create-action":
      return `Action: ${String(c.params.title) || c.segment.text}`;
    default:
      return c.segment.text.slice(0, 60);
  }
}
