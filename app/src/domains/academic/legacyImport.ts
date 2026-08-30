/**
 * One-time migration of the pre-2A Academic KV blobs into the canonical
 * relational graph. Pure and fully testable.
 *
 * Legacy keys (see the old `usePersistedState` calls in store.tsx):
 *   pbos:academic-courses     -> Course[]      (old shape, no `archived`)
 *   pbos:academic-topics      -> Topic[]       (old shape: `order`, `masteryPercent`)
 *   pbos:academic-assessments -> Assessment[]  (old shape, no timestamps)
 *   pbos:academic-attempts    -> Record<courseId, CourseAttempt[]>  (a MAP)
 *
 * Guarantees (batch §5):
 *   - parse safely; malformed rows are reported, never thrown away silently
 *   - preserve existing IDs
 *   - legacy `Topic.masteryPercent` is preserved as `masterySelfAssessed`
 *     ONLY — it is NOT re-interpreted as mastery truth (that now lives in
 *     Knowledge). No grade/mastery/policy is invented.
 *   - deterministic relationship repair only (drop rows whose parent course
 *     is missing, and report them)
 */
import { newId } from "./ids";
import { isCoverageStatus, isGradeLetter } from "./engine";
import type {
  AcademicGraph,
  Assessment,
  AssessmentCategory,
  Course,
  CourseAttempt,
  CourseStatus,
  GradeLetter,
  Semester,
  Topic,
} from "./types";
import { ASSESSMENT_CATEGORIES, COURSE_STATUSES } from "./types";

export type AcademicLegacyReport = {
  parsed: { courses: number; topics: number; assessments: number; attempts: number };
  malformed: string[];
  repairs: string[];
};

export type AcademicLegacyResult = { graph: AcademicGraph; report: AcademicLegacyReport };

const NOW = () => new Date().toISOString();

function asArray(raw: string | null): { items: unknown[]; malformed: boolean } {
  if (raw == null) return { items: [], malformed: false };
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? { items: v, malformed: false } : { items: [], malformed: true };
  } catch {
    return { items: [], malformed: true };
  }
}

function asRecord(raw: string | null): { value: Record<string, unknown>; malformed: boolean } {
  if (raw == null) return { value: {}, malformed: false };
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" && !Array.isArray(v)
      ? { value: v as Record<string, unknown>, malformed: false }
      : { value: {}, malformed: true };
  } catch {
    return { value: {}, malformed: true };
  }
}

function coerceStatus(raw: unknown): CourseStatus {
  return (COURSE_STATUSES as readonly string[]).includes(raw as string)
    ? (raw as CourseStatus)
    : "on-track";
}

function coerceCategory(raw: unknown): AssessmentCategory {
  return (ASSESSMENT_CATEGORIES as readonly string[]).includes(raw as string)
    ? (raw as AssessmentCategory)
    : "quiz";
}

function coerceGrade(raw: unknown, report: AcademicLegacyReport, where: string): GradeLetter | null {
  if (raw == null) return null;
  if (isGradeLetter(raw)) return raw;
  report.repairs.push(`${where}: dropped unrecognised grade ${JSON.stringify(raw)} → null`);
  return null;
}

export function resolveLegacyAcademic(raw: {
  courses: string | null;
  topics: string | null;
  assessments: string | null;
  attempts: string | null;
}): AcademicLegacyResult {
  const report: AcademicLegacyReport = {
    parsed: { courses: 0, topics: 0, assessments: 0, attempts: 0 },
    malformed: [],
    repairs: [],
  };

  const c = asArray(raw.courses);
  const t = asArray(raw.topics);
  const a = asArray(raw.assessments);
  const at = asRecord(raw.attempts);
  if (c.malformed) report.malformed.push("pbos:academic-courses");
  if (t.malformed) report.malformed.push("pbos:academic-topics");
  if (a.malformed) report.malformed.push("pbos:academic-assessments");
  if (at.malformed) report.malformed.push("pbos:academic-attempts");

  // --- courses ---
  const courses: Course[] = [];
  const courseIds = new Set<string>();
  const semesterUse = new Map<string, number>();
  for (const row of c.items) {
    if (!row || typeof row !== "object") {
      report.malformed.push("a course row");
      continue;
    }
    const r = row as Record<string, unknown>;
    const id = typeof r.id === "string" && r.id ? r.id : newId("course");
    if (courseIds.has(id)) {
      report.repairs.push(`duplicate course id ${id} skipped`);
      continue;
    }
    courseIds.add(id);
    const semesterId = typeof r.semesterId === "string" && r.semesterId ? r.semesterId : null;
    if (semesterId) semesterUse.set(semesterId, (semesterUse.get(semesterId) ?? 0) + 1);
    const ch = Number(r.creditHours);
    courses.push({
      id,
      semesterId,
      code: typeof r.code === "string" ? r.code : "",
      title: typeof r.title === "string" ? r.title : "Untitled course",
      creditHours: Number.isFinite(ch) && ch > 0 ? ch : 3,
      professorName: typeof r.professorName === "string" ? r.professorName : "",
      status: coerceStatus(r.status),
      targetGrade: coerceGrade(r.targetGrade, report, `course ${id} targetGrade`),
      projectedGrade: coerceGrade(r.projectedGrade, report, `course ${id} projectedGrade`),
      archived: r.archived === true,
      createdAt: NOW(),
      updatedAt: NOW(),
    });
    report.parsed.courses++;
  }

  // --- semesters (synthesised — the label lived only in code pre-2A) ---
  const semesters: Semester[] = [];
  const topSemester = [...semesterUse.entries()].sort((x, y) => y[1] - x[1])[0]?.[0];
  let pos = 0;
  for (const [sid] of semesterUse) {
    semesters.push({
      id: sid,
      label: sid,
      position: pos++,
      isCurrent: sid === topSemester,
      createdAt: NOW(),
      updatedAt: NOW(),
    });
  }

  // --- topics --- (legacy `order` -> `position`, `masteryPercent` -> `masterySelfAssessed`)
  const topics: Topic[] = [];
  const topicIds = new Set<string>();
  const positionByCourse = new Map<string, number>();
  const sortedTopics = [...t.items]
    .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
    .sort((x, y) => Number(x.order ?? 0) - Number(y.order ?? 0));
  for (const r of sortedTopics) {
    const id = typeof r.id === "string" && r.id ? r.id : newId("topic");
    if (topicIds.has(id)) {
      report.repairs.push(`duplicate topic id ${id} skipped`);
      continue;
    }
    const courseId = typeof r.courseId === "string" ? r.courseId : "";
    if (!courseIds.has(courseId)) {
      report.repairs.push(`topic ${id} → missing course ${courseId || "(none)"} — dropped`);
      continue;
    }
    topicIds.add(id);
    const p = positionByCourse.get(courseId) ?? 0;
    positionByCourse.set(courseId, p + 1);
    const legacyMastery = Number(r.masteryPercent);
    topics.push({
      id,
      courseId,
      title: typeof r.title === "string" ? r.title : "Untitled topic",
      position: p,
      professorCoverage: isCoverageStatus(r.professorCoverage) ? r.professorCoverage : "not-taught",
      personalStudyPercent: clampPercent(Number(r.personalStudyPercent)),
      knowledgeTopicId:
        typeof r.knowledgeTopicId === "string" && r.knowledgeTopicId ? r.knowledgeTopicId : null,
      masterySelfAssessed:
        Number.isFinite(legacyMastery) && legacyMastery > 0 ? clampPercent(legacyMastery) : null,
      createdAt: NOW(),
      updatedAt: NOW(),
    });
    report.parsed.topics++;
  }

  // --- assessments ---
  const assessments: Assessment[] = [];
  const assessmentIds = new Set<string>();
  for (const row of a.items) {
    if (!row || typeof row !== "object") {
      report.malformed.push("an assessment row");
      continue;
    }
    const r = row as Record<string, unknown>;
    const id = typeof r.id === "string" && r.id ? r.id : newId("assess");
    if (assessmentIds.has(id)) {
      report.repairs.push(`duplicate assessment id ${id} skipped`);
      continue;
    }
    const courseId = typeof r.courseId === "string" ? r.courseId : "";
    if (!courseIds.has(courseId)) {
      report.repairs.push(`assessment ${id} → missing course ${courseId || "(none)"} — dropped`);
      continue;
    }
    assessmentIds.add(id);
    const total = Number(r.totalMarks);
    const obtained = r.obtainedMarks == null ? null : Number(r.obtainedMarks);
    const weight = Number(r.weightPercent);
    assessments.push({
      id,
      courseId,
      category: coerceCategory(r.category),
      title: typeof r.title === "string" ? r.title : "Untitled assessment",
      obtainedMarks: obtained !== null && Number.isFinite(obtained) ? obtained : null,
      totalMarks: Number.isFinite(total) && total > 0 ? total : 100,
      weightPercent: Number.isFinite(weight) && weight >= 0 ? weight : 0,
      date: typeof r.date === "string" ? r.date : "",
      createdAt: NOW(),
      updatedAt: NOW(),
    });
    report.parsed.assessments++;
  }

  // --- attempts (legacy MAP -> flat array) ---
  const attempts: CourseAttempt[] = [];
  const attemptIds = new Set<string>();
  for (const [courseId, list] of Object.entries(at.value)) {
    if (!Array.isArray(list)) {
      report.malformed.push(`attempts for ${courseId}`);
      continue;
    }
    for (const row of list) {
      if (!row || typeof row !== "object") {
        report.malformed.push("an attempt row");
        continue;
      }
      const r = row as Record<string, unknown>;
      const id = typeof r.id === "string" && r.id ? r.id : newId("attempt");
      if (attemptIds.has(id)) {
        report.repairs.push(`duplicate attempt id ${id} skipped`);
        continue;
      }
      const cid = typeof r.courseId === "string" && r.courseId ? r.courseId : courseId;
      if (!courseIds.has(cid)) {
        report.repairs.push(`attempt ${id} → missing course ${cid || "(none)"} — dropped`);
        continue;
      }
      attemptIds.add(id);
      const n = Number(r.attemptNumber);
      attempts.push({
        id,
        courseId: cid,
        attemptNumber: Number.isInteger(n) && n >= 1 ? n : 1,
        term: typeof r.term === "string" ? r.term : "",
        finalGrade: coerceGrade(r.finalGrade, report, `attempt ${id} finalGrade`),
        createdAt: NOW(),
        updatedAt: NOW(),
      });
      report.parsed.attempts++;
    }
  }

  return { graph: { semesters, courses, topics, assessments, attempts }, report };
}

function clampPercent(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, Math.round(n)));
}
