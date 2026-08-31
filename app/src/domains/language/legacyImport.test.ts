import { describe, it, expect } from "vitest";
import { resolveLegacyLanguage } from "./legacyImport";

describe("resolveLegacyLanguage", () => {
  it("returns an empty graph for empty input", () => {
    const { graph, report } = resolveLegacyLanguage({ units: null, lessons: null, books: null });
    expect(graph).toEqual({ paths: [], units: [], sessions: [], books: [], readingSessions: [] });
    expect(report.parsed).toEqual({ paths: 0, units: 0, books: 0 });
  });

  it("synthesizes one path per language and remaps lessons to units, preserving lesson ids", () => {
    const { graph, report } = resolveLegacyLanguage({
      units: JSON.stringify([
        { id: "u1", languageName: "German", pathTitle: "A1", title: "Intro", order: 1 },
        { id: "u2", languageName: "German", pathTitle: "A1", title: "Daily Life", order: 4 },
      ]),
      lessons: JSON.stringify([
        { id: "lsn-1", unitId: "u1", title: "Greetings", order: 1, completed: true, skillTopicId: "topic-de" },
        { id: "lsn-2", unitId: "u2", title: "Separable Verbs", order: 2, completed: false, skillTopicId: "topic-de" },
      ]),
      books: null,
    });
    expect(graph.paths).toHaveLength(1);
    expect(graph.paths[0].language).toBe("German");
    expect(graph.units).toHaveLength(2);
    expect(graph.units.map((u) => u.id)).toEqual(["lsn-1", "lsn-2"]);
    expect(graph.units[0].completed).toBe(true);
    expect(graph.units[0].knowledgeTopicId).toBe("topic-de"); // kept as-is; repo clears if dangling
    expect(graph.units.every((u) => u.pathId === graph.paths[0].id)).toBe(true);
    expect(graph.sessions).toEqual([]); // no legacy sessions — nothing fabricated
    expect(report.repairs.some((r) => r.includes("flattened"))).toBe(true);
  });

  it("drops a lesson whose legacy unit is missing, and reports it", () => {
    const { graph, report } = resolveLegacyLanguage({
      units: JSON.stringify([{ id: "u1", languageName: "German", pathTitle: "A1", title: "Intro", order: 1 }]),
      lessons: JSON.stringify([
        { id: "lsn-1", unitId: "u1", title: "Greetings", order: 1 },
        { id: "lsn-x", unitId: "ghost", title: "Orphan", order: 2 },
      ]),
      books: null,
    });
    expect(graph.units).toHaveLength(1);
    expect(report.repairs.some((r) => r.includes("missing legacy unit"))).toBe(true);
  });

  it("migrates books, coercing an unknown status and a zero total to null", () => {
    const { graph } = resolveLegacyLanguage({
      units: null,
      lessons: null,
      books: JSON.stringify([
        { id: "b1", title: "Atomic Habits", author: "James Clear", status: "reading", currentPage: 124, totalPages: 320, currentChapter: 6, skillTopicId: "topic-x" },
        { id: "b2", title: "Mystery", status: "weird", currentPage: 3, totalPages: 0 },
      ]),
    });
    expect(graph.books).toHaveLength(2);
    expect(graph.books[0].id).toBe("b1");
    expect(graph.books[0].knowledgeTopicId).toBe("topic-x");
    expect(graph.books[1].status).toBe("to-read"); // "weird" coerced
    expect(graph.books[1].totalPages).toBeNull(); // 0 → unknown
  });

  it("reports malformed blobs without throwing", () => {
    const { graph, report } = resolveLegacyLanguage({
      units: "{not json",
      lessons: "also bad",
      books: "nope",
    });
    expect(graph.paths).toEqual([]);
    expect(report.malformed).toEqual(
      expect.arrayContaining(["pbos:language-units", "pbos:language-lessons", "pbos:language-books"]),
    );
  });
});
