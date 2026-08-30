// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => false, invoke: vi.fn() }));

import { LocalRepo as AcademicRepo } from "./repo";
import { LocalRepo as KnowledgeRepo } from "../knowledge/repo";
import { deriveTopicView } from "../knowledge/engine";
import type { Course, Topic } from "./types";
import type { Evidence, KnowledgeTopic } from "../knowledge/types";

const TS = "2026-01-01T00:00:00.000Z";

beforeEach(() => window.localStorage.clear());

describe("Academic ↔ Knowledge canonical link — one owner, no duplicated mastery", () => {
  it("Data Structures → Binary Trees Academic Topic → Binary Trees Knowledge concept", async () => {
    const academic = new AcademicRepo();
    const knowledge = new KnowledgeRepo();

    // Knowledge owns the concept + its evidence-derived mastery.
    const kTopic: KnowledgeTopic = {
      id: "know-binary-trees",
      title: "Binary Trees",
      category: "academic",
      context: "Data Structures",
      lastStudied: null,
      nextReviewDate: null,
      relatedGoalId: null,
      createdAt: TS,
      updatedAt: TS,
    };
    await knowledge.topicUpsert(kTopic);
    const firstEvidence: Evidence = {
      id: "ev-1",
      topicId: "know-binary-trees",
      type: "recall",
      title: "Inorder traversal drill",
      score: 8,
      maxScore: 10,
      date: "2026-08-13",
      createdAt: TS,
      updatedAt: TS,
    };
    await knowledge.evidenceUpsert(firstEvidence);

    // Academic owns course/syllabus context + coverage — NOT mastery.
    const course: Course = {
      id: "dsa",
      semesterId: null,
      code: "CSE 201",
      title: "Data Structures",
      creditHours: 4,
      professorName: "Prof",
      status: "on-track",
      targetGrade: "A",
      projectedGrade: null,
      archived: false,
      createdAt: TS,
      updatedAt: TS,
    };
    await academic.courseUpsert(course);
    const aTopic: Topic = {
      id: "acad-binary-trees",
      courseId: "dsa",
      title: "Binary Trees",
      position: 0,
      professorCoverage: "not-taught",
      personalStudyPercent: 0,
      knowledgeTopicId: null,
      masterySelfAssessed: null,
      createdAt: TS,
      updatedAt: TS,
    };
    await academic.topicUpsert(aTopic);

    // Link (the ONE cross-domain relation, owned by the Academic row).
    await academic.topicLinkKnowledge("acad-binary-trees", "know-binary-trees");

    const beforeAcademic = await academic.load();
    const linkedTopic = beforeAcademic.topics.find((t) => t.id === "acad-binary-trees")!;
    expect(linkedTopic.knowledgeTopicId).toBe("know-binary-trees");
    // No Academic mastery value exists anywhere on the row.
    expect(linkedTopic.masterySelfAssessed).toBeNull();
    expect("masteryPercent" in linkedTopic).toBe(false);

    // Mastery is READ from Knowledge evidence.
    let kGraph = await knowledge.load();
    const masteryBefore = deriveTopicView(
      kGraph.evidence.filter((e) => e.topicId === "know-binary-trees"),
    );
    expect(masteryBefore).toEqual({ masteryPercent: 80, hasEvidence: true, state: "strong" });

    // Academic coverage changes — Professor + Personal Study — must NOT touch Knowledge.
    await academic.topicUpsert({
      ...linkedTopic,
      professorCoverage: "taught",
      personalStudyPercent: 100,
      updatedAt: "2026-09-01T00:00:00.000Z",
    });

    kGraph = await knowledge.load();
    const masteryAfter = deriveTopicView(
      kGraph.evidence.filter((e) => e.topicId === "know-binary-trees"),
    );
    expect(masteryAfter).toEqual(masteryBefore); // unchanged — evidence is the only mover
    expect(kGraph.evidence).toHaveLength(1); // no evidence invented by coverage edits

    const afterAcademic = await academic.load();
    const t2 = afterAcademic.topics.find((t) => t.id === "acad-binary-trees")!;
    expect(t2.professorCoverage).toBe("taught");
    expect(t2.personalStudyPercent).toBe(100);
    expect(t2.knowledgeTopicId).toBe("know-binary-trees"); // link intact
  });

  it("unlinking clears only the Academic-side pointer; the Knowledge concept is untouched", async () => {
    const academic = new AcademicRepo();
    const knowledge = new KnowledgeRepo();
    await knowledge.topicUpsert({
      id: "know-bt",
      title: "Binary Trees",
      category: "academic",
      context: "DS",
      lastStudied: null,
      nextReviewDate: null,
      relatedGoalId: null,
      createdAt: TS,
      updatedAt: TS,
    });
    await academic.courseUpsert({
      id: "dsa",
      semesterId: null,
      code: "",
      title: "Data Structures",
      creditHours: 3,
      professorName: "",
      status: "on-track",
      targetGrade: null,
      projectedGrade: null,
      archived: false,
      createdAt: TS,
      updatedAt: TS,
    });
    await academic.topicUpsert({
      id: "t1",
      courseId: "dsa",
      title: "Binary Trees",
      position: 0,
      professorCoverage: "taught",
      personalStudyPercent: 50,
      knowledgeTopicId: "know-bt",
      masterySelfAssessed: null,
      createdAt: TS,
      updatedAt: TS,
    });

    await academic.topicLinkKnowledge("t1", null);

    const a = await academic.load();
    const k = await knowledge.load();
    expect(a.topics[0].knowledgeTopicId).toBeNull();
    expect(a.topics[0].title).toBe("Binary Trees"); // academic topic survives
    expect(k.topics).toHaveLength(1); // knowledge concept untouched
  });
});
