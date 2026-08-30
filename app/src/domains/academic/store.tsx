/**
 * Academic OS store — the ONE place Semester/Course/Topic/Assessment/Attempt
 * state lives.
 *
 * - Canonical persistence is relational SQLite via `AcademicRepo` (Batch 2A).
 *   The in-memory graph here is a projection loaded once on mount; every
 *   mutation writes through to the repo and updates the projection.
 * - No seed data. A fresh profile is genuinely empty; a returning user's
 *   pre-2A KV blobs are imported once (idempotent, non-destructive).
 * - Professor Coverage, Personal Study Coverage and Mastery are THREE
 *   independent facts. Mastery is NOT stored here — a Topic optionally links
 *   (`knowledgeTopicId`) to the canonical Knowledge concept and mastery is read
 *   from that concept's evidence by whatever renders it (both providers are in
 *   scope at page level). No second Academic mastery value is ever persisted.
 * - No score→letter-grade conversion. No repeat/replacement policy. Grades are
 *   user-entered or NULL.
 */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cacheAdapter } from "../persistence/cache";
import type { SaveState } from "../resilience/types";
import {
  analyzeAssessmentWeighting,
  calculateCGPA,
  calculateSGPA,
  calculateWeightedScore,
  validateAssessmentInput,
  validateAttemptInput,
  validateCourseInput,
  validateTopicInput,
  type CGPAInclusionResult,
  type WeightingAnalysis,
} from "./engine";
import { newId } from "./ids";
import { resolveLegacyAcademic, type AcademicLegacyReport } from "./legacyImport";
import { makeAcademicRepo, type AcademicRepo } from "./repo";
import type {
  AcademicGraph,
  Assessment,
  AssessmentInput,
  AttemptInput,
  Course,
  CourseAttempt,
  CourseInput,
  CoverageStatus,
  Semester,
  Topic,
  TopicInput,
} from "./types";

type MutResult = { ok: true; id: string } | { ok: false; errors: Record<string, string> };

type AcademicContextValue = {
  loaded: boolean;
  loadError: string | null;
  saveState: SaveState;
  /** Back-compat alias — pages/consumers pre-2A read `assessmentsSaveState`. */
  assessmentsSaveState: SaveState;
  saveError: string | null;
  backend: "sqlite" | "localStorage";
  legacyImport: AcademicLegacyReport | null;

  semesters: Semester[];
  courses: Course[];
  topics: Topic[];
  assessments: Assessment[];
  attempts: CourseAttempt[];

  // back-compat derived
  semester: { id: string; label: string; courseIds: string[] };
  attemptsByCourseId: Record<string, CourseAttempt[]>;
  cgpa: CGPAInclusionResult;
  projectedSGPA: number | null;

  // reads
  getCourse: (id: string) => Course | undefined;
  getTopicsForCourse: (courseId: string) => Topic[];
  getAssessmentsForCourse: (courseId: string) => Assessment[];
  getAttemptsForCourse: (courseId: string) => CourseAttempt[];
  getCourseWeightedScore: (courseId: string) => number;
  getCourseWeighting: (courseId: string) => WeightingAnalysis;

  // course CRUD
  createCourse: (input: CourseInput) => Promise<MutResult>;
  updateCourse: (id: string, input: CourseInput) => Promise<MutResult>;
  archiveCourse: (id: string, archived?: boolean) => Promise<void>;
  deleteCourse: (id: string) => Promise<void>;

  // topic CRUD
  createTopic: (courseId: string, input: TopicInput) => Promise<MutResult>;
  updateTopic: (id: string, input: TopicInput) => Promise<MutResult>;
  deleteTopic: (id: string) => Promise<void>;
  setProfessorCoverage: (id: string, coverage: CoverageStatus) => Promise<MutResult>;
  setPersonalStudyCoverage: (id: string, percent: number) => Promise<MutResult>;
  linkTopicToKnowledge: (topicId: string, knowledgeTopicId: string) => Promise<MutResult>;
  unlinkTopicFromKnowledge: (topicId: string) => Promise<MutResult>;

  // assessment CRUD
  createAssessment: (courseId: string, input: AssessmentInput) => Promise<MutResult>;
  updateAssessment: (id: string, input: AssessmentInput) => Promise<MutResult>;
  deleteAssessment: (id: string) => Promise<void>;
  setAssessmentMarks: (assessmentId: string, obtainedMarks: number | null) => Promise<MutResult>;

  // attempts
  upsertAttempt: (courseId: string, input: AttemptInput, id?: string) => Promise<MutResult>;
  deleteAttempt: (id: string) => Promise<void>;

  // semesters (light)
  createSemester: (label: string, makeCurrent?: boolean) => Promise<MutResult>;
};

const AcademicContext = createContext<AcademicContextValue | null>(null);

const nowIso = () => new Date().toISOString();
const EMPTY: AcademicGraph = {
  semesters: [],
  courses: [],
  topics: [],
  assessments: [],
  attempts: [],
};

export function AcademicProvider({ children }: { children: ReactNode }) {
  const repoRef = useRef<AcademicRepo>(makeAcademicRepo());
  const [graph, setGraph] = useState<AcademicGraph>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [legacyImport, setLegacyImport] = useState<AcademicLegacyReport | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const repo = repoRef.current;
        const legacy = resolveLegacyAcademic({
          courses: cacheAdapter.getItem("pbos:academic-courses"),
          topics: cacheAdapter.getItem("pbos:academic-topics"),
          assessments: cacheAdapter.getItem("pbos:academic-assessments"),
          attempts: cacheAdapter.getItem("pbos:academic-attempts"),
        });
        const report = await repo.importGraph(legacy.graph);
        if (report.ran) setLegacyImport(legacy.report);

        const g = await repo.load();
        if (!cancelled) {
          setGraph(g);
          setLoaded(true);
        }
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : String(e));
          setLoaded(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function persist(fn: () => Promise<void>) {
    setSaveState("saving");
    try {
      await fn();
      setSaveState("saved");
      setSaveError(null);
    } catch (e) {
      setSaveState("failed");
      setSaveError(e instanceof Error ? e.message : String(e));
    }
  }

  // --- reads ------------------------------------------------------------
  const getCourse = (id: string) => graph.courses.find((c) => c.id === id);
  const getTopicsForCourse = (courseId: string) =>
    graph.topics.filter((t) => t.courseId === courseId).sort((a, b) => a.position - b.position);
  const getAssessmentsForCourse = (courseId: string) =>
    graph.assessments.filter((a) => a.courseId === courseId);
  const getAttemptsForCourse = (courseId: string) =>
    graph.attempts
      .filter((a) => a.courseId === courseId)
      .sort((a, b) => a.attemptNumber - b.attemptNumber);

  const getCourseWeightedScore = (courseId: string) => {
    const graded = getAssessmentsForCourse(courseId).filter((a) => a.obtainedMarks !== null);
    return calculateWeightedScore(
      graded.map((a) => ({
        obtainedMarks: a.obtainedMarks as number,
        totalMarks: a.totalMarks,
        weightPercent: a.weightPercent,
      })),
    );
  };
  const getCourseWeighting = (courseId: string) =>
    analyzeAssessmentWeighting(
      getAssessmentsForCourse(courseId).map((a) => ({
        weightPercent: a.weightPercent,
        obtainedMarks: a.obtainedMarks,
      })),
    );

  const attemptsByCourseId = useMemo(() => {
    const map: Record<string, CourseAttempt[]> = {};
    for (const a of graph.attempts) (map[a.courseId] ??= []).push(a);
    return map;
  }, [graph.attempts]);

  const activeCourses = graph.courses.filter((c) => !c.archived);
  const cgpa = calculateCGPA(
    activeCourses.map((c) => ({ id: c.id, creditHours: c.creditHours })),
    attemptsByCourseId,
  );
  const projectedSGPA = calculateSGPA(
    activeCourses.map((c) => ({ creditHours: c.creditHours, grade: c.projectedGrade })),
  );

  const currentSemester = graph.semesters.find((s) => s.isCurrent) ?? graph.semesters[0];
  const semester = {
    id: currentSemester?.id ?? "",
    label: currentSemester?.label ?? "Current Semester",
    courseIds: (currentSemester
      ? graph.courses.filter((c) => c.semesterId === currentSemester.id)
      : graph.courses
    ).map((c) => c.id),
  };

  // --- course CRUD ---------------------------------------------------
  const createCourse = async (input: CourseInput): Promise<MutResult> => {
    const v = validateCourseInput(input);
    if (!v.ok) return v;
    const course: Course = {
      id: newId("course"),
      ...v.value,
      archived: false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    setGraph((g) => ({ ...g, courses: [...g.courses, course] }));
    await persist(() => repoRef.current.courseUpsert(course));
    return { ok: true, id: course.id };
  };

  const updateCourse = async (id: string, input: CourseInput): Promise<MutResult> => {
    const existing = getCourse(id);
    if (!existing) return { ok: false, errors: { _: "Course not found." } };
    const v = validateCourseInput(input);
    if (!v.ok) return v;
    const course: Course = { ...existing, ...v.value, updatedAt: nowIso() };
    setGraph((g) => ({ ...g, courses: g.courses.map((c) => (c.id === id ? course : c)) }));
    await persist(() => repoRef.current.courseUpsert(course));
    return { ok: true, id };
  };

  const archiveCourse = async (id: string, archived = true) => {
    const existing = getCourse(id);
    if (!existing) return;
    const course: Course = { ...existing, archived, updatedAt: nowIso() };
    setGraph((g) => ({ ...g, courses: g.courses.map((c) => (c.id === id ? course : c)) }));
    await persist(() => repoRef.current.courseUpsert(course));
  };

  const deleteCourse = async (id: string) => {
    setGraph((g) => ({
      ...g,
      courses: g.courses.filter((c) => c.id !== id),
      topics: g.topics.filter((t) => t.courseId !== id),
      assessments: g.assessments.filter((a) => a.courseId !== id),
      attempts: g.attempts.filter((a) => a.courseId !== id),
    }));
    await persist(() => repoRef.current.courseDelete(id));
  };

  // --- topic CRUD -------------------------------------------------
  const createTopic = async (courseId: string, input: TopicInput): Promise<MutResult> => {
    if (!getCourse(courseId)) return { ok: false, errors: { _: "Course not found." } };
    const v = validateTopicInput(input);
    if (!v.ok) return v;
    const position = getTopicsForCourse(courseId).length;
    const topic: Topic = {
      id: newId("topic"),
      courseId,
      ...v.value,
      position,
      knowledgeTopicId: null,
      masterySelfAssessed: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    setGraph((g) => ({ ...g, topics: [...g.topics, topic] }));
    await persist(() => repoRef.current.topicUpsert(topic));
    return { ok: true, id: topic.id };
  };

  const updateTopic = async (id: string, input: TopicInput): Promise<MutResult> => {
    const existing = graph.topics.find((t) => t.id === id);
    if (!existing) return { ok: false, errors: { _: "Topic not found." } };
    const v = validateTopicInput(input);
    if (!v.ok) return v;
    const topic: Topic = { ...existing, ...v.value, updatedAt: nowIso() };
    setGraph((g) => ({ ...g, topics: g.topics.map((t) => (t.id === id ? topic : t)) }));
    await persist(() => repoRef.current.topicUpsert(topic));
    return { ok: true, id };
  };

  const deleteTopic = async (id: string) => {
    setGraph((g) => ({ ...g, topics: g.topics.filter((t) => t.id !== id) }));
    await persist(() => repoRef.current.topicDelete(id));
  };

  const setProfessorCoverage = async (
    id: string,
    coverage: CoverageStatus,
  ): Promise<MutResult> => {
    const existing = graph.topics.find((t) => t.id === id);
    if (!existing) return { ok: false, errors: { _: "Topic not found." } };
    // Deliberately independent — does NOT touch personalStudyPercent or any mastery.
    const topic: Topic = { ...existing, professorCoverage: coverage, updatedAt: nowIso() };
    setGraph((g) => ({ ...g, topics: g.topics.map((t) => (t.id === id ? topic : t)) }));
    await persist(() => repoRef.current.topicUpsert(topic));
    return { ok: true, id };
  };

  const setPersonalStudyCoverage = async (id: string, percent: number): Promise<MutResult> => {
    const existing = graph.topics.find((t) => t.id === id);
    if (!existing) return { ok: false, errors: { _: "Topic not found." } };
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
      return { ok: false, errors: { personalStudyPercent: "Must be between 0 and 100." } };
    }
    // Deliberately independent — does NOT touch professorCoverage or any mastery.
    const topic: Topic = {
      ...existing,
      personalStudyPercent: Math.round(percent),
      updatedAt: nowIso(),
    };
    setGraph((g) => ({ ...g, topics: g.topics.map((t) => (t.id === id ? topic : t)) }));
    await persist(() => repoRef.current.topicUpsert(topic));
    return { ok: true, id };
  };

  const linkTopicToKnowledge = async (
    topicId: string,
    knowledgeTopicId: string,
  ): Promise<MutResult> => {
    const existing = graph.topics.find((t) => t.id === topicId);
    if (!existing) return { ok: false, errors: { _: "Topic not found." } };
    setGraph((g) => ({
      ...g,
      topics: g.topics.map((t) =>
        t.id === topicId ? { ...t, knowledgeTopicId, updatedAt: nowIso() } : t,
      ),
    }));
    await persist(() => repoRef.current.topicLinkKnowledge(topicId, knowledgeTopicId));
    return { ok: true, id: topicId };
  };

  const unlinkTopicFromKnowledge = async (topicId: string): Promise<MutResult> => {
    const existing = graph.topics.find((t) => t.id === topicId);
    if (!existing) return { ok: false, errors: { _: "Topic not found." } };
    setGraph((g) => ({
      ...g,
      topics: g.topics.map((t) =>
        t.id === topicId ? { ...t, knowledgeTopicId: null, updatedAt: nowIso() } : t,
      ),
    }));
    await persist(() => repoRef.current.topicLinkKnowledge(topicId, null));
    return { ok: true, id: topicId };
  };

  // --- assessment CRUD ---------------------------------------------
  const createAssessment = async (
    courseId: string,
    input: AssessmentInput,
  ): Promise<MutResult> => {
    if (!getCourse(courseId)) return { ok: false, errors: { _: "Course not found." } };
    const v = validateAssessmentInput(input);
    if (!v.ok) return v;
    const assessment: Assessment = {
      id: newId("assess"),
      courseId,
      ...v.value,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    setGraph((g) => ({ ...g, assessments: [...g.assessments, assessment] }));
    await persist(() => repoRef.current.assessmentUpsert(assessment));
    return { ok: true, id: assessment.id };
  };

  const updateAssessment = async (id: string, input: AssessmentInput): Promise<MutResult> => {
    const existing = graph.assessments.find((a) => a.id === id);
    if (!existing) return { ok: false, errors: { _: "Assessment not found." } };
    const v = validateAssessmentInput(input);
    if (!v.ok) return v;
    const assessment: Assessment = { ...existing, ...v.value, updatedAt: nowIso() };
    setGraph((g) => ({
      ...g,
      assessments: g.assessments.map((a) => (a.id === id ? assessment : a)),
    }));
    await persist(() => repoRef.current.assessmentUpsert(assessment));
    return { ok: true, id };
  };

  const deleteAssessment = async (id: string) => {
    setGraph((g) => ({ ...g, assessments: g.assessments.filter((a) => a.id !== id) }));
    await persist(() => repoRef.current.assessmentDelete(id));
  };

  const setAssessmentMarks = async (
    assessmentId: string,
    obtainedMarks: number | null,
  ): Promise<MutResult> => {
    const existing = graph.assessments.find((a) => a.id === assessmentId);
    if (!existing) return { ok: false, errors: { _: "Assessment not found." } };
    if (obtainedMarks !== null) {
      if (!Number.isFinite(obtainedMarks) || obtainedMarks < 0) {
        return { ok: false, errors: { obtainedMarks: "Marks can't be negative." } };
      }
      if (obtainedMarks > existing.totalMarks) {
        return { ok: false, errors: { obtainedMarks: "Marks can't exceed the total." } };
      }
    }
    const assessment: Assessment = { ...existing, obtainedMarks, updatedAt: nowIso() };
    setGraph((g) => ({
      ...g,
      assessments: g.assessments.map((a) => (a.id === assessmentId ? assessment : a)),
    }));
    await persist(() => repoRef.current.assessmentUpsert(assessment));
    return { ok: true, id: assessmentId };
  };

  // --- attempts -------------------------------------------------
  const upsertAttempt = async (
    courseId: string,
    input: AttemptInput,
    id?: string,
  ): Promise<MutResult> => {
    if (!getCourse(courseId)) return { ok: false, errors: { _: "Course not found." } };
    const v = validateAttemptInput(input);
    if (!v.ok) return v;
    const existing = id ? graph.attempts.find((a) => a.id === id) : undefined;
    const attempt: CourseAttempt = {
      id: existing?.id ?? id ?? newId("attempt"),
      courseId,
      ...v.value,
      createdAt: existing?.createdAt ?? nowIso(),
      updatedAt: nowIso(),
    };
    setGraph((g) => ({
      ...g,
      attempts: existing
        ? g.attempts.map((a) => (a.id === attempt.id ? attempt : a))
        : [...g.attempts, attempt],
    }));
    await persist(() => repoRef.current.attemptUpsert(attempt));
    return { ok: true, id: attempt.id };
  };

  const deleteAttempt = async (id: string) => {
    setGraph((g) => ({ ...g, attempts: g.attempts.filter((a) => a.id !== id) }));
    await persist(() => repoRef.current.attemptDelete(id));
  };

  // --- semesters ----------------------------------------------
  const createSemester = async (label: string, makeCurrent = true): Promise<MutResult> => {
    const clean = label.replace(/\s+/g, " ").trim();
    if (clean.length === 0) return { ok: false, errors: { label: "Give the semester a label." } };
    const sem: Semester = {
      id: newId("sem"),
      label: clean,
      position: graph.semesters.length,
      isCurrent: makeCurrent,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    setGraph((g) => ({
      ...g,
      semesters: [
        ...(makeCurrent ? g.semesters.map((s) => ({ ...s, isCurrent: false })) : g.semesters),
        sem,
      ],
    }));
    await persist(async () => {
      if (makeCurrent) {
        for (const s of graph.semesters.filter((x) => x.isCurrent)) {
          await repoRef.current.semesterUpsert({ ...s, isCurrent: false });
        }
      }
      await repoRef.current.semesterUpsert(sem);
    });
    return { ok: true, id: sem.id };
  };

  const value = useMemo<AcademicContextValue>(
    () => ({
      loaded,
      loadError,
      saveState,
      assessmentsSaveState: saveState,
      saveError,
      backend: repoRef.current.kind,
      legacyImport,
      semesters: graph.semesters,
      courses: graph.courses,
      topics: graph.topics,
      assessments: graph.assessments,
      attempts: graph.attempts,
      semester,
      attemptsByCourseId,
      cgpa,
      projectedSGPA,
      getCourse,
      getTopicsForCourse,
      getAssessmentsForCourse,
      getAttemptsForCourse,
      getCourseWeightedScore,
      getCourseWeighting,
      createCourse,
      updateCourse,
      archiveCourse,
      deleteCourse,
      createTopic,
      updateTopic,
      deleteTopic,
      setProfessorCoverage,
      setPersonalStudyCoverage,
      linkTopicToKnowledge,
      unlinkTopicFromKnowledge,
      createAssessment,
      updateAssessment,
      deleteAssessment,
      setAssessmentMarks,
      upsertAttempt,
      deleteAttempt,
      createSemester,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [graph, loaded, loadError, saveState, saveError, legacyImport],
  );

  return <AcademicContext.Provider value={value}>{children}</AcademicContext.Provider>;
}

export function useAcademic() {
  const ctx = useContext(AcademicContext);
  if (!ctx) throw new Error("useAcademic must be used within AcademicProvider");
  return ctx;
}
