// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => false, invoke: vi.fn() }));

import { LocalRepo, makeAcademicRepo } from "./repo";
import type { Assessment, Course, CourseAttempt, Semester, Topic } from "./types";

const TS = "2026-01-01T00:00:00.000Z";
const course = (id: string, semesterId: string | null = null): Course => ({
  id,
  semesterId,
  code: "CSE 201",
  title: `Course ${id}`,
  creditHours: 4,
  professorName: "Prof",
  status: "on-track",
  targetGrade: "A",
  projectedGrade: null,
  archived: false,
  createdAt: TS,
  updatedAt: TS,
});
const topic = (id: string, courseId: string, knowledgeTopicId: string | null = null): Topic => ({
  id,
  courseId,
  title: `Topic ${id}`,
  position: 0,
  professorCoverage: "taught",
  personalStudyPercent: 40,
  knowledgeTopicId,
  masterySelfAssessed: null,
  createdAt: TS,
  updatedAt: TS,
});
const assessment = (id: string, courseId: string): Assessment => ({
  id,
  courseId,
  category: "quiz",
  title: `A ${id}`,
  obtainedMarks: 18,
  totalMarks: 20,
  weightPercent: 100,
  date: "2026-04-10",
  createdAt: TS,
  updatedAt: TS,
});
const attempt = (id: string, courseId: string): CourseAttempt => ({
  id,
  courseId,
  attemptNumber: 1,
  term: "Fall 2026",
  finalGrade: null,
  createdAt: TS,
  updatedAt: TS,
});
const semester = (id: string): Semester => ({
  id,
  label: `Sem ${id}`,
  position: 0,
  isCurrent: true,
  createdAt: TS,
  updatedAt: TS,
});

beforeEach(() => window.localStorage.clear());

describe("makeAcademicRepo", () => {
  it("falls back to LocalRepo when not under Tauri", () => {
    expect(makeAcademicRepo()).toBeInstanceOf(LocalRepo);
  });
});

describe("LocalRepo — CRUD + relationships + restart persistence", () => {
  it("round-trips the graph and survives a fresh instance", async () => {
    const repo = new LocalRepo();
    await repo.semesterUpsert(semester("s1"));
    await repo.courseUpsert(course("dsa", "s1"));
    await repo.topicUpsert(topic("t1", "dsa"));
    await repo.assessmentUpsert(assessment("a1", "dsa"));
    await repo.attemptUpsert(attempt("at1", "dsa"));

    const g = await new LocalRepo().load();
    expect(g.courses).toHaveLength(1);
    expect(g.topics).toHaveLength(1);
    expect(g.assessments).toHaveLength(1);
    expect(g.attempts).toHaveLength(1);
  });

  it("preserves createdAt on update (upsert-by-id)", async () => {
    const repo = new LocalRepo();
    await repo.courseUpsert(course("dsa"));
    await repo.courseUpsert({ ...course("dsa"), title: "renamed", createdAt: "2099-01-01" });
    const g = await repo.load();
    expect(g.courses[0].title).toBe("renamed");
    expect(g.courses[0].createdAt).toBe(TS);
  });

  it("deleting a course cascades its topics, assessments and attempts", async () => {
    const repo = new LocalRepo();
    await repo.courseUpsert(course("dsa"));
    await repo.topicUpsert(topic("t1", "dsa"));
    await repo.assessmentUpsert(assessment("a1", "dsa"));
    await repo.attemptUpsert(attempt("at1", "dsa"));

    await repo.courseDelete("dsa");
    const g = await repo.load();
    expect(g.courses).toHaveLength(0);
    expect(g.topics).toHaveLength(0);
    expect(g.assessments).toHaveLength(0);
    expect(g.attempts).toHaveLength(0);
  });

  it("deleting a semester unassigns its courses (SET NULL), never deletes them", async () => {
    const repo = new LocalRepo();
    await repo.semesterUpsert(semester("s1"));
    await repo.courseUpsert(course("dsa", "s1"));
    await repo.semesterDelete("s1");
    const g = await repo.load();
    expect(g.courses).toHaveLength(1);
    expect(g.courses[0].semesterId).toBeNull();
  });

  it("refuses a topic / assessment whose course does not exist (FK)", async () => {
    const repo = new LocalRepo();
    await repo.topicUpsert(topic("t1", "ghost"));
    await repo.assessmentUpsert(assessment("a1", "ghost"));
    const g = await repo.load();
    expect(g.topics).toHaveLength(0);
    expect(g.assessments).toHaveLength(0);
  });

  it("links and unlinks an Academic Topic ↔ Knowledge concept without copying mastery", async () => {
    const repo = new LocalRepo();
    await repo.courseUpsert(course("dsa"));
    await repo.topicUpsert(topic("t1", "dsa"));

    await repo.topicLinkKnowledge("t1", "know-bt");
    let g = await repo.load();
    expect(g.topics[0].knowledgeTopicId).toBe("know-bt");
    expect(g.topics[0].masterySelfAssessed).toBeNull();

    await repo.topicLinkKnowledge("t1", null);
    g = await repo.load();
    expect(g.topics[0].knowledgeTopicId).toBeNull();
  });

  it("importGraph is idempotent, drops orphans, and never overwrites newer records", async () => {
    const repo = new LocalRepo();
    const r1 = await repo.importGraph({
      semesters: [semester("s1")],
      courses: [course("dsa", "s1"), course("orphan", "ghost-sem")],
      topics: [topic("t1", "dsa"), topic("t-ghost", "no-course")],
      assessments: [assessment("a1", "dsa")],
      attempts: [attempt("at1", "dsa")],
    });
    expect(r1.ran).toBe(true);
    expect(r1.coursesImported).toBe(2);
    expect(r1.topicsImported).toBe(1); // orphan topic dropped

    let g = await repo.load();
    expect(g.courses.find((c) => c.id === "orphan")!.semesterId).toBeNull();

    await repo.courseUpsert({ ...course("dsa", "s1"), title: "EDITED" });
    const r2 = await repo.importGraph({
      semesters: [],
      courses: [course("dsa", "s1")],
      topics: [],
      assessments: [],
      attempts: [],
    });
    expect(r2.ran).toBe(false);
    g = await repo.load();
    expect(g.courses.find((c) => c.id === "dsa")!.title).toBe("EDITED");
  });
});
