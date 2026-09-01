// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, act, cleanup } from "@testing-library/react";
import { RevisionProvider } from "../revision/store";
import { AcademicProvider, useAcademic } from "./store";

vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => false, invoke: vi.fn() }));

/* eslint-disable react/globals */
let academic: ReturnType<typeof useAcademic>;
function Probe() {
  academic = useAcademic();
  return <div data-testid="ready">{String(academic.loaded)}</div>;
}
function Harness() {
  return (
    <RevisionProvider>
      <AcademicProvider>
        <Probe />
      </AcademicProvider>
    </RevisionProvider>
  );
}

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

async function mount() {
  render(<Harness />);
  await waitFor(() => expect(screen.getByTestId("ready")).toHaveTextContent("true"));
}

async function seedCourseWithTopics() {
  let courseId = "";
  let otherCourseId = "";
  const topics: string[] = [];
  const course = (code: string, title: string) => ({
    code,
    title,
    creditHours: 3,
    professorName: "",
    status: "on-track" as const,
    targetGrade: null,
    projectedGrade: null,
    semesterId: null,
  });
  // Each entity in its own act() so React flushes the graph between calls
  // (createTopic/createAssessment read the course from the flushed graph).
  await act(async () => {
    const c = await academic.createCourse(course("CSE 201", "Data Structures"));
    courseId = c.ok ? c.id : "";
  });
  await act(async () => {
    const o = await academic.createCourse(course("CSE 305", "Operating Systems"));
    otherCourseId = o.ok ? o.id : "";
  });
  for (const title of ["AVL Trees", "Heaps"]) {
    await act(async () => {
      const t = await academic.createTopic(courseId, {
        title,
        professorCoverage: "not-taught",
        personalStudyPercent: 0,
      });
      if (t.ok) topics.push(t.id);
    });
  }
  let assessmentId = "";
  let foreignTopicId = "";
  await act(async () => {
    const a = await academic.createAssessment(courseId, {
      category: "midterm",
      title: "Midterm 1",
      obtainedMarks: null,
      totalMarks: 50,
      weightPercent: 25,
      date: "2026-10-01",
    });
    assessmentId = a.ok ? a.id : "";
  });
  await act(async () => {
    const ft = await academic.createTopic(otherCourseId, {
      title: "Paging",
      professorCoverage: "not-taught",
      personalStudyPercent: 0,
    });
    foreignTopicId = ft.ok ? ft.id : "";
  });
  return { courseId, assessmentId, topics, foreignTopicId };
}

describe("assessment ↔ topic scope (schema v11)", () => {
  it("adds a same-course topic and reflects it; scope starts empty (unknown, not 'none')", async () => {
    await mount();
    const { assessmentId, topics } = await seedCourseWithTopics();
    expect(academic.getAssessmentScopeTopicIds(assessmentId)).toEqual([]);

    await act(async () => {
      const res = await academic.addAssessmentScopeTopic(assessmentId, topics[0]);
      expect(res.ok).toBe(true);
    });
    expect(academic.getAssessmentScopeTopicIds(assessmentId)).toEqual([topics[0]]);
    expect(academic.getAssessmentScopeTopics(assessmentId).map((t) => t.title)).toEqual(["AVL Trees"]);
  });

  it("rejects a topic from a different course", async () => {
    await mount();
    const { assessmentId, foreignTopicId } = await seedCourseWithTopics();
    await act(async () => {
      const res = await academic.addAssessmentScopeTopic(assessmentId, foreignTopicId);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(Object.values(res.errors)[0]).toMatch(/same course|this course/i);
    });
    expect(academic.getAssessmentScopeTopicIds(assessmentId)).toEqual([]);
  });

  it("setAssessmentScope replaces the whole scope and rejects a cross-course batch", async () => {
    await mount();
    const { assessmentId, topics, foreignTopicId } = await seedCourseWithTopics();
    await act(async () => {
      await academic.setAssessmentScope(assessmentId, topics, "user");
    });
    expect(academic.getAssessmentScopeTopicIds(assessmentId).sort()).toEqual([...topics].sort());
    await act(async () => {
      const res = await academic.setAssessmentScope(assessmentId, [topics[0], foreignTopicId], "user");
      expect(res.ok).toBe(false);
    });
    // unchanged
    expect(academic.getAssessmentScopeTopicIds(assessmentId).sort()).toEqual([...topics].sort());
  });

  it("deleting a scoped topic prunes only its link; deleting the assessment clears its scope", async () => {
    await mount();
    const { assessmentId, topics } = await seedCourseWithTopics();
    await act(async () => {
      await academic.setAssessmentScope(assessmentId, topics, "user");
    });
    await act(async () => {
      await academic.deleteTopic(topics[1]);
    });
    expect(academic.getAssessmentScopeTopicIds(assessmentId)).toEqual([topics[0]]);
    await act(async () => {
      await academic.deleteAssessment(assessmentId);
    });
    expect(academic.getAssessmentScopeTopicIds(assessmentId)).toEqual([]);
  });

  it("scope persists across a remount", async () => {
    await mount();
    const { assessmentId, topics } = await seedCourseWithTopics();
    await act(async () => {
      await academic.addAssessmentScopeTopic(assessmentId, topics[0]);
    });
    cleanup();
    await mount();
    await waitFor(() =>
      expect(academic.getAssessmentScopeTopicIds(assessmentId)).toEqual([topics[0]]),
    );
  });
});
