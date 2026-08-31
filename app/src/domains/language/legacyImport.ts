/**
 * One-time migration of the pre-Batch-2 Reading & Language KV blobs into the
 * canonical relational graph. Pure and fully testable.
 *
 * Legacy keys + shapes:
 *   pbos:language-units   -> [{ id, languageName, pathTitle, title, order }]   (flat, no path entity)
 *   pbos:language-lessons -> [{ id, unitId, title, order, completed, skillTopicId }]
 *   pbos:language-books   -> [{ id, title, author, status, currentPage, totalPages, currentChapter, skillTopicId }]
 *
 * Mapping: each distinct `languageName` becomes ONE `LanguagePath`; each legacy
 * lesson becomes a `LanguageUnit` (kind "lesson") under its language's path;
 * the legacy "unit" rows are only grouping metadata and are flattened away
 * (reported). No learning sessions or reading sessions ever existed, so none
 * are fabricated.
 *
 * Guarantees: parse safely, preserve IDs, idempotent, non-destructive, drop
 * dangling lessons (missing legacy unit) with a report, keep a Knowledge /
 * Routine reference as-is (the repo layer clears it if the target is gone and
 * reports that), never fabricate progress or mastery.
 */
import { newId } from "./ids";
import { isBookStatus } from "./engine";
import type {
  Book,
  BookStatus,
  LanguageGraph,
  LanguagePath,
  LanguageUnit,
} from "./types";

export type LanguageLegacyReport = {
  parsed: { paths: number; units: number; books: number };
  malformed: string[];
  repairs: string[];
};

export type LanguageLegacyResult = { graph: LanguageGraph; report: LanguageLegacyReport };

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

const intOr = (v: unknown, dflt: number) =>
  Number.isFinite(Number(v)) ? Math.round(Number(v)) : dflt;

function coerceBookStatus(v: unknown): BookStatus {
  return isBookStatus(v) ? (v as BookStatus) : "to-read";
}

export function resolveLegacyLanguage(raw: {
  units: string | null;
  lessons: string | null;
  books: string | null;
}): LanguageLegacyResult {
  const report: LanguageLegacyReport = {
    parsed: { paths: 0, units: 0, books: 0 },
    malformed: [],
    repairs: [],
  };

  const unitsArr = asArray(raw.units);
  const lessonsArr = asArray(raw.lessons);
  const booksArr = asArray(raw.books);
  if (unitsArr.malformed) report.malformed.push("pbos:language-units");
  if (lessonsArr.malformed) report.malformed.push("pbos:language-lessons");
  if (booksArr.malformed) report.malformed.push("pbos:language-books");

  // --- synthesize one LanguagePath per distinct languageName ---
  const paths: LanguagePath[] = [];
  const pathIdByLanguage = new Map<string, string>();
  const legacyUnitToLanguage = new Map<string, string>();
  let flattenedUnits = 0;
  for (const row of unitsArr.items) {
    if (!row || typeof row !== "object") {
      report.malformed.push("a legacy language unit row");
      continue;
    }
    const r = row as Record<string, unknown>;
    const language = typeof r.languageName === "string" && r.languageName ? r.languageName : "Language";
    const pathTitle = typeof r.pathTitle === "string" ? r.pathTitle : "";
    if (typeof r.id === "string" && r.id) legacyUnitToLanguage.set(r.id, language);
    flattenedUnits += 1;
    if (!pathIdByLanguage.has(language)) {
      const id = newId("lpath");
      pathIdByLanguage.set(language, id);
      paths.push({
        id,
        language,
        title: pathTitle ? `${language} · ${pathTitle}` : language,
        targetLevel: pathTitle,
        status: "active",
        relatedRoutineId: null,
        archived: false,
        createdAt: NOW(),
        updatedAt: NOW(),
      });
      report.parsed.paths += 1;
    }
  }
  if (flattenedUnits > 0) {
    report.repairs.push(
      `${flattenedUnits} legacy "unit" row(s) flattened — they were grouping metadata; lessons became the units`,
    );
  }

  // --- legacy lessons -> LanguageUnit under the right path ---
  const units: LanguageUnit[] = [];
  const unitIds = new Set<string>();
  const positionByPath = new Map<string, number>();
  const sortedLessons = [...lessonsArr.items]
    .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
    .sort((a, b) => intOr(a.order, 0) - intOr(b.order, 0));
  for (const r of sortedLessons) {
    const id = typeof r.id === "string" && r.id ? r.id : newId("lunit");
    if (unitIds.has(id)) {
      report.repairs.push(`duplicate lesson id ${id} skipped`);
      continue;
    }
    const legacyUnitId = typeof r.unitId === "string" ? r.unitId : "";
    const language = legacyUnitToLanguage.get(legacyUnitId);
    const pathId = language ? pathIdByLanguage.get(language) : undefined;
    if (!pathId) {
      report.repairs.push(`lesson ${id} → missing legacy unit ${legacyUnitId || "(none)"} — dropped`);
      continue;
    }
    unitIds.add(id);
    const pos = positionByPath.get(pathId) ?? 0;
    positionByPath.set(pathId, pos + 1);
    units.push({
      id,
      pathId,
      title: typeof r.title === "string" ? r.title : "Untitled unit",
      kind: "lesson",
      position: pos,
      completed: r.completed === true,
      knowledgeTopicId:
        typeof r.skillTopicId === "string" && r.skillTopicId ? r.skillTopicId : null,
      createdAt: NOW(),
      updatedAt: NOW(),
    });
    report.parsed.units += 1;
  }

  // --- legacy books ---
  const books: Book[] = [];
  const bookIds = new Set<string>();
  for (const row of booksArr.items) {
    if (!row || typeof row !== "object") {
      report.malformed.push("a legacy book row");
      continue;
    }
    const r = row as Record<string, unknown>;
    const id = typeof r.id === "string" && r.id ? r.id : newId("book");
    if (bookIds.has(id)) {
      report.repairs.push(`duplicate book id ${id} skipped`);
      continue;
    }
    bookIds.add(id);
    const total = intOr(r.totalPages, 0);
    books.push({
      id,
      title: typeof r.title === "string" ? r.title : "Untitled book",
      author: typeof r.author === "string" ? r.author : "",
      status: coerceBookStatus(r.status),
      currentPage: Math.max(0, intOr(r.currentPage, 0)),
      totalPages: total > 0 ? total : null,
      currentChapter: Math.max(0, intOr(r.currentChapter, 0)),
      startedDate: null,
      finishedDate: null,
      knowledgeTopicId:
        typeof r.skillTopicId === "string" && r.skillTopicId ? r.skillTopicId : null,
      noteRef: "",
      archived: false,
      createdAt: NOW(),
      updatedAt: NOW(),
    });
    report.parsed.books += 1;
  }

  return {
    graph: { paths, units, sessions: [], books, readingSessions: [] },
    report,
  };
}
