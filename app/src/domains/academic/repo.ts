/**
 * Canonical relational persistence for the Academic domain.
 *
 *   store.tsx  ->  AcademicRepo  ->  { Tauri commands -> Rust -> SQLite }
 *                               \->  { localStorage JSON }  (browser dev only)
 *
 * The Tauri path is authoritative in the real app. The localStorage path is an
 * explicit dev fallback so `npm run dev` keeps working; it stores the same
 * canonical shape under one key and mirrors the Rust cascade/link semantics.
 */
import { invoke, isTauri } from "@tauri-apps/api/core";
import type {
  AcademicGraph,
  Assessment,
  Course,
  CourseAttempt,
  Semester,
  Topic,
} from "./types";

export type AcademicImportReport = {
  ran: boolean;
  semestersImported: number;
  coursesImported: number;
  topicsImported: number;
  assessmentsImported: number;
  attemptsImported: number;
  topicLinksDropped: number;
};

export interface AcademicRepo {
  readonly kind: "sqlite" | "localStorage";
  load(): Promise<AcademicGraph>;
  semesterUpsert(semester: Semester): Promise<void>;
  semesterDelete(id: string): Promise<void>;
  courseUpsert(course: Course): Promise<void>;
  courseDelete(id: string): Promise<void>;
  topicUpsert(topic: Topic): Promise<void>;
  topicDelete(id: string): Promise<void>;
  assessmentUpsert(assessment: Assessment): Promise<void>;
  assessmentDelete(id: string): Promise<void>;
  attemptUpsert(attempt: CourseAttempt): Promise<void>;
  attemptDelete(id: string): Promise<void>;
  /** Set (or, with `null`, clear) the ONE cross-domain link. No mastery is copied. */
  topicLinkKnowledge(topicId: string, knowledgeTopicId: string | null): Promise<void>;
  importGraph(graph: AcademicGraph): Promise<AcademicImportReport>;
}

const EMPTY: AcademicGraph = {
  semesters: [],
  courses: [],
  topics: [],
  assessments: [],
  attempts: [],
};

function normReport(r: Record<string, unknown>): AcademicImportReport {
  const num = (a: unknown, b: unknown) => Number(a ?? b ?? 0);
  return {
    ran: !!r.ran,
    semestersImported: num(r.semestersImported, r.semesters_imported),
    coursesImported: num(r.coursesImported, r.courses_imported),
    topicsImported: num(r.topicsImported, r.topics_imported),
    assessmentsImported: num(r.assessmentsImported, r.assessments_imported),
    attemptsImported: num(r.attemptsImported, r.attempts_imported),
    topicLinksDropped: num(r.topicLinksDropped, r.topic_links_dropped),
  };
}

// --- Tauri / SQLite --------------------------------------------------------

class SqliteRepo implements AcademicRepo {
  readonly kind = "sqlite" as const;
  async load() {
    return await invoke<AcademicGraph>("acad_load");
  }
  async semesterUpsert(semester: Semester) {
    await invoke("acad_semester_upsert", { semester });
  }
  async semesterDelete(id: string) {
    await invoke("acad_semester_delete", { id });
  }
  async courseUpsert(course: Course) {
    await invoke("acad_course_upsert", { course });
  }
  async courseDelete(id: string) {
    await invoke("acad_course_delete", { id });
  }
  async topicUpsert(topic: Topic) {
    await invoke("acad_topic_upsert", { topic });
  }
  async topicDelete(id: string) {
    await invoke("acad_topic_delete", { id });
  }
  async assessmentUpsert(assessment: Assessment) {
    await invoke("acad_assessment_upsert", { assessment });
  }
  async assessmentDelete(id: string) {
    await invoke("acad_assessment_delete", { id });
  }
  async attemptUpsert(attempt: CourseAttempt) {
    await invoke("acad_attempt_upsert", { attempt });
  }
  async attemptDelete(id: string) {
    await invoke("acad_attempt_delete", { id });
  }
  async topicLinkKnowledge(topicId: string, knowledgeTopicId: string | null) {
    await invoke("acad_topic_link_knowledge", { topicId, knowledgeTopicId });
  }
  async importGraph(graph: AcademicGraph) {
    return normReport(await invoke("acad_import_graph", { import: graph }));
  }
}

// --- localStorage (browser dev fallback) ---------------------------------

const LS_KEY = "pbos:academic-v2";
const LS_IMPORT_MARK = "pbos:academic-v2-imported";

export class LocalRepo implements AcademicRepo {
  readonly kind = "localStorage" as const;

  private read(): AcademicGraph {
    try {
      const raw = window.localStorage.getItem(LS_KEY);
      if (!raw) return { ...EMPTY };
      const g = JSON.parse(raw) as AcademicGraph;
      return {
        semesters: g.semesters ?? [],
        courses: g.courses ?? [],
        topics: g.topics ?? [],
        assessments: g.assessments ?? [],
        attempts: g.attempts ?? [],
      };
    } catch {
      return { ...EMPTY };
    }
  }
  private write(g: AcademicGraph) {
    window.localStorage.setItem(LS_KEY, JSON.stringify(g));
  }
  private upsert<T extends { id: string; createdAt: string }>(arr: T[], row: T): T[] {
    const i = arr.findIndex((x) => x.id === row.id);
    if (i >= 0) {
      const next = [...arr];
      next[i] = { ...row, createdAt: arr[i].createdAt };
      return next;
    }
    return [...arr, row];
  }

  async load() {
    return this.read();
  }
  async semesterUpsert(semester: Semester) {
    const g = this.read();
    g.semesters = this.upsert(g.semesters, semester);
    this.write(g);
  }
  async semesterDelete(id: string) {
    const g = this.read();
    g.semesters = g.semesters.filter((s) => s.id !== id);
    g.courses = g.courses.map((c) => (c.semesterId === id ? { ...c, semesterId: null } : c));
    this.write(g);
  }
  async courseUpsert(course: Course) {
    const g = this.read();
    g.courses = this.upsert(g.courses, course);
    this.write(g);
  }
  async courseDelete(id: string) {
    const g = this.read();
    g.courses = g.courses.filter((c) => c.id !== id);
    g.topics = g.topics.filter((t) => t.courseId !== id);
    g.assessments = g.assessments.filter((a) => a.courseId !== id);
    g.attempts = g.attempts.filter((a) => a.courseId !== id);
    this.write(g);
  }
  async topicUpsert(topic: Topic) {
    const g = this.read();
    if (!g.courses.some((c) => c.id === topic.courseId)) return; // FK
    g.topics = this.upsert(g.topics, topic);
    this.write(g);
  }
  async topicDelete(id: string) {
    const g = this.read();
    g.topics = g.topics.filter((t) => t.id !== id);
    this.write(g);
  }
  async assessmentUpsert(assessment: Assessment) {
    const g = this.read();
    if (!g.courses.some((c) => c.id === assessment.courseId)) return; // FK
    g.assessments = this.upsert(g.assessments, assessment);
    this.write(g);
  }
  async assessmentDelete(id: string) {
    const g = this.read();
    g.assessments = g.assessments.filter((a) => a.id !== id);
    this.write(g);
  }
  async attemptUpsert(attempt: CourseAttempt) {
    const g = this.read();
    if (!g.courses.some((c) => c.id === attempt.courseId)) return; // FK
    g.attempts = this.upsert(g.attempts, attempt);
    this.write(g);
  }
  async attemptDelete(id: string) {
    const g = this.read();
    g.attempts = g.attempts.filter((a) => a.id !== id);
    this.write(g);
  }
  async topicLinkKnowledge(topicId: string, knowledgeTopicId: string | null) {
    const g = this.read();
    g.topics = g.topics.map((t) =>
      t.id === topicId ? { ...t, knowledgeTopicId, updatedAt: new Date().toISOString() } : t,
    );
    this.write(g);
  }
  async importGraph(graph: AcademicGraph): Promise<AcademicImportReport> {
    if (window.localStorage.getItem(LS_IMPORT_MARK)) {
      return {
        ran: false,
        semestersImported: 0,
        coursesImported: 0,
        topicsImported: 0,
        assessmentsImported: 0,
        attemptsImported: 0,
        topicLinksDropped: 0,
      };
    }
    const g = this.read();
    const has = (arr: { id: string }[], id: string) => arr.some((x) => x.id === id);
    const report: AcademicImportReport = {
      ran: true,
      semestersImported: 0,
      coursesImported: 0,
      topicsImported: 0,
      assessmentsImported: 0,
      attemptsImported: 0,
      topicLinksDropped: 0,
    };
    for (const s of graph.semesters) {
      if (!has(g.semesters, s.id)) {
        g.semesters.push(s);
        report.semestersImported++;
      }
    }
    for (const c of graph.courses) {
      if (!has(g.courses, c.id)) {
        const semesterId = c.semesterId && has(g.semesters, c.semesterId) ? c.semesterId : null;
        g.courses.push({ ...c, semesterId });
        report.coursesImported++;
      }
    }
    for (const t of graph.topics) {
      if (has(g.topics, t.id)) continue;
      if (!has(g.courses, t.courseId)) continue;
      report.topicsImported++;
      g.topics.push(t);
    }
    for (const a of graph.assessments) {
      if (has(g.assessments, a.id)) continue;
      if (!has(g.courses, a.courseId)) continue;
      report.assessmentsImported++;
      g.assessments.push(a);
    }
    for (const a of graph.attempts) {
      if (has(g.attempts, a.id)) continue;
      if (!has(g.courses, a.courseId)) continue;
      report.attemptsImported++;
      g.attempts.push(a);
    }
    this.write(g);
    window.localStorage.setItem(LS_IMPORT_MARK, new Date().toISOString());
    return report;
  }
}

export function makeAcademicRepo(): AcademicRepo {
  try {
    if (isTauri()) return new SqliteRepo();
  } catch {
    /* fall through */
  }
  return new LocalRepo();
}
