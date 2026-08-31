/**
 * Reading & Language Learning store — the ONE place Path / Unit / Session /
 * Book / ReadingSession state lives.
 *
 * - Canonical persistence is relational SQLite via `LanguageRepo` (Batch 2).
 * - No seed data. Fresh profile is empty; a returning user's pre-2 KV blobs are
 *   imported once (idempotent, non-destructive).
 * - Path progress and reading progress are DERIVED (engine), never stored.
 *   Completing a session / finishing a book NEVER writes Knowledge mastery —
 *   `logSession` returns the described effects and the caller applies a
 *   Knowledge-evidence record only on an explicit user action.
 * - `relatedRoutineId` / `knowledgeTopicId` are references only.
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
  deriveNextUnit,
  derivePathProgress,
  deriveReadingProgress,
  deriveSessionEffects,
  validateBookInput,
  validatePathInput,
  validateReadingSessionInput,
  validateSessionInput,
  validateUnitInput,
  type PathProgress,
  type ReadingProgress,
  type SessionEffects,
} from "./engine";
import { newId } from "./ids";
import { resolveLegacyLanguage, type LanguageLegacyReport } from "./legacyImport";
import { makeLanguageRepo, type LanguageRepo } from "./repo";
import type {
  Book,
  BookInput,
  BookStatus,
  LanguageGraph,
  LanguagePath,
  LanguagePathStatus,
  LanguageSession,
  LanguageUnit,
  PathInput,
  ReadingSession,
  ReadingSessionInput,
  SessionInput,
  UnitInput,
} from "./types";

type MutResult = { ok: true; id: string } | { ok: false; errors: Record<string, string> };
type SessionResult =
  | { ok: true; id: string; effects: SessionEffects }
  | { ok: false; errors: Record<string, string> };

const nowIso = () => new Date().toISOString();
const todayIso = () => new Date().toISOString().slice(0, 10);
const EMPTY: LanguageGraph = { paths: [], units: [], sessions: [], books: [], readingSessions: [] };

type LanguageContextValue = {
  loaded: boolean;
  loadError: string | null;
  saveState: SaveState;
  saveError: string | null;
  backend: "sqlite" | "localStorage";
  legacyImport: LanguageLegacyReport | null;

  paths: LanguagePath[];
  units: LanguageUnit[];
  sessions: LanguageSession[];
  books: Book[];
  readingSessions: ReadingSession[];

  // language reads
  getPath: (id: string) => LanguagePath | undefined;
  getActivePaths: () => LanguagePath[];
  getUnitsForPath: (pathId: string) => LanguageUnit[];
  getSessionsForPath: (pathId: string) => LanguageSession[];
  getRecentSessions: (limit?: number) => LanguageSession[];
  getPathProgress: (pathId: string) => PathProgress;
  getNextUnit: (pathId: string) => LanguageUnit | null;

  // reading reads
  getBook: (id: string) => Book | undefined;
  getActiveBooks: () => Book[];
  getReadingSessionsForBook: (bookId: string) => ReadingSession[];
  getReadingProgress: (bookOrId: Book | string) => ReadingProgress;

  // path CRUD
  createPath: (input: PathInput) => Promise<MutResult>;
  updatePath: (id: string, input: PathInput) => Promise<MutResult>;
  setPathStatus: (id: string, status: LanguagePathStatus) => Promise<void>;
  archivePath: (id: string, archived?: boolean) => Promise<void>;
  deletePath: (id: string) => Promise<void>;
  linkPathRoutine: (pathId: string, routineId: string) => Promise<void>;
  unlinkPathRoutine: (pathId: string) => Promise<void>;

  // unit CRUD
  createUnit: (pathId: string, input: UnitInput) => Promise<MutResult>;
  updateUnit: (id: string, input: UnitInput) => Promise<MutResult>;
  toggleUnit: (id: string) => Promise<void>;
  deleteUnit: (id: string) => Promise<void>;
  reorderUnits: (pathId: string, orderedIds: string[]) => Promise<void>;

  // learning session
  logSession: (pathId: string, input: SessionInput) => Promise<SessionResult>;
  updateSession: (id: string, input: SessionInput) => Promise<MutResult>;
  deleteSession: (id: string) => Promise<void>;

  // book CRUD
  createBook: (input: BookInput) => Promise<MutResult>;
  updateBook: (id: string, input: BookInput) => Promise<MutResult>;
  setBookStatus: (id: string, status: BookStatus) => Promise<void>;
  archiveBook: (id: string, archived?: boolean) => Promise<void>;
  deleteBook: (id: string) => Promise<void>;
  updateBookProgress: (id: string, currentPage: number, currentChapter?: number) => Promise<void>;
  linkBookTopic: (bookId: string, topicId: string) => Promise<void>;
  unlinkBookTopic: (bookId: string) => Promise<void>;

  // reading session
  logReadingSession: (bookId: string, input: ReadingSessionInput) => Promise<MutResult>;
  deleteReadingSession: (id: string) => Promise<void>;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const repoRef = useRef<LanguageRepo>(makeLanguageRepo());
  const [graph, setGraph] = useState<LanguageGraph>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [legacyImport, setLegacyImport] = useState<LanguageLegacyReport | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const repo = repoRef.current;
        const legacy = resolveLegacyLanguage({
          units: cacheAdapter.getItem("pbos:language-units"),
          lessons: cacheAdapter.getItem("pbos:language-lessons"),
          books: cacheAdapter.getItem("pbos:language-books"),
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

  // --- reads -----------------------------------------------------------
  const getPath = (id: string) => graph.paths.find((p) => p.id === id);
  const getActivePaths = () => graph.paths.filter((p) => !p.archived);
  const getUnitsForPath = (pathId: string) =>
    graph.units.filter((u) => u.pathId === pathId).sort((a, b) => a.position - b.position);
  const getSessionsForPath = (pathId: string) =>
    graph.sessions
      .filter((s) => s.pathId === pathId)
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const getRecentSessions = (limit = 10) =>
    [...graph.sessions]
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
      .slice(0, limit);
  const getPathProgress = (pathId: string) => derivePathProgress(getUnitsForPath(pathId));
  const getNextUnit = (pathId: string) => deriveNextUnit(getUnitsForPath(pathId));

  const getBook = (id: string) => graph.books.find((b) => b.id === id);
  const getActiveBooks = () => graph.books.filter((b) => !b.archived);
  const getReadingSessionsForBook = (bookId: string) =>
    graph.readingSessions
      .filter((s) => s.bookId === bookId)
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const getReadingProgress = (bookOrId: Book | string) => {
    const book = typeof bookOrId === "string" ? getBook(bookOrId) : bookOrId;
    return deriveReadingProgress(book ?? { currentPage: 0, totalPages: null });
  };

  // --- path CRUD ---------------------------------------------------
  const createPath = async (input: PathInput): Promise<MutResult> => {
    const v = validatePathInput(input);
    if (!v.ok) return v;
    const path: LanguagePath = {
      id: newId("lpath"),
      ...v.value,
      archived: false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    setGraph((g) => ({ ...g, paths: [...g.paths, path] }));
    await persist(() => repoRef.current.pathUpsert(path));
    return { ok: true, id: path.id };
  };

  const updatePath = async (id: string, input: PathInput): Promise<MutResult> => {
    const existing = getPath(id);
    if (!existing) return { ok: false, errors: { _: "Path not found." } };
    const v = validatePathInput(input);
    if (!v.ok) return v;
    const path: LanguagePath = { ...existing, ...v.value, updatedAt: nowIso() };
    setGraph((g) => ({ ...g, paths: g.paths.map((p) => (p.id === id ? path : p)) }));
    await persist(() => repoRef.current.pathUpsert(path));
    return { ok: true, id };
  };

  const patchPath = async (id: string, patch: Partial<LanguagePath>) => {
    const existing = getPath(id);
    if (!existing) return;
    const path: LanguagePath = { ...existing, ...patch, updatedAt: nowIso() };
    setGraph((g) => ({ ...g, paths: g.paths.map((p) => (p.id === id ? path : p)) }));
    await persist(() => repoRef.current.pathUpsert(path));
  };
  const setPathStatus = (id: string, status: LanguagePathStatus) => patchPath(id, { status });
  const archivePath = (id: string, archived = true) => patchPath(id, { archived });
  const linkPathRoutine = (pathId: string, routineId: string) =>
    patchPath(pathId, { relatedRoutineId: routineId || null });
  const unlinkPathRoutine = (pathId: string) => patchPath(pathId, { relatedRoutineId: null });

  const deletePath = async (id: string) => {
    setGraph((g) => ({
      ...g,
      paths: g.paths.filter((p) => p.id !== id),
      units: g.units.filter((u) => u.pathId !== id),
      sessions: g.sessions.filter((s) => s.pathId !== id),
    }));
    await persist(() => repoRef.current.pathDelete(id));
  };

  // --- unit CRUD ---------------------------------------------------
  const createUnit = async (pathId: string, input: UnitInput): Promise<MutResult> => {
    if (!getPath(pathId)) return { ok: false, errors: { _: "Path not found." } };
    const v = validateUnitInput(input);
    if (!v.ok) return v;
    const unit: LanguageUnit = {
      id: newId("lunit"),
      pathId,
      ...v.value,
      position: getUnitsForPath(pathId).length,
      completed: false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    setGraph((g) => ({ ...g, units: [...g.units, unit] }));
    await persist(() => repoRef.current.unitUpsert(unit));
    return { ok: true, id: unit.id };
  };

  const updateUnit = async (id: string, input: UnitInput): Promise<MutResult> => {
    const existing = graph.units.find((u) => u.id === id);
    if (!existing) return { ok: false, errors: { _: "Unit not found." } };
    const v = validateUnitInput(input);
    if (!v.ok) return v;
    const unit: LanguageUnit = { ...existing, ...v.value, updatedAt: nowIso() };
    setGraph((g) => ({ ...g, units: g.units.map((u) => (u.id === id ? unit : u)) }));
    await persist(() => repoRef.current.unitUpsert(unit));
    return { ok: true, id };
  };

  const toggleUnit = async (id: string) => {
    const existing = graph.units.find((u) => u.id === id);
    if (!existing) return;
    const unit: LanguageUnit = { ...existing, completed: !existing.completed, updatedAt: nowIso() };
    setGraph((g) => ({ ...g, units: g.units.map((u) => (u.id === id ? unit : u)) }));
    await persist(() => repoRef.current.unitUpsert(unit));
  };

  const deleteUnit = async (id: string) => {
    setGraph((g) => ({
      ...g,
      units: g.units.filter((u) => u.id !== id),
      sessions: g.sessions.map((s) => (s.unitId === id ? { ...s, unitId: null } : s)),
    }));
    await persist(() => repoRef.current.unitDelete(id));
  };

  const reorderUnits = async (pathId: string, orderedIds: string[]) => {
    setGraph((g) => ({
      ...g,
      units: g.units.map((u) => {
        if (u.pathId !== pathId) return u;
        const pos = orderedIds.indexOf(u.id);
        return pos >= 0 ? { ...u, position: pos } : u;
      }),
    }));
    await persist(() => repoRef.current.unitsReorder(pathId, orderedIds));
  };

  // --- learning session ------------------------------------------
  const logSession = async (pathId: string, input: SessionInput): Promise<SessionResult> => {
    if (!getPath(pathId)) return { ok: false, errors: { _: "Path not found." } };
    const v = validateSessionInput(input);
    if (!v.ok) return v;
    const completed = true; // logging a session records a completed practice event
    const session: LanguageSession = {
      id: newId("lsess"),
      pathId,
      ...v.value,
      date: v.value.date || todayIso(),
      completed,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    // Mechanical: a completed session marks its linked unit done. NOTHING here
    // touches Knowledge — the caller applies evidence only on an explicit action.
    const shouldCompleteUnit =
      session.unitId !== null && !graph.units.find((u) => u.id === session.unitId)?.completed;
    setGraph((g) => ({
      ...g,
      sessions: [...g.sessions, session],
      units: shouldCompleteUnit
        ? g.units.map((u) =>
            u.id === session.unitId ? { ...u, completed: true, updatedAt: nowIso() } : u,
          )
        : g.units,
    }));
    await persist(async () => {
      await repoRef.current.sessionUpsert(session);
      if (shouldCompleteUnit && session.unitId) {
        const u = graph.units.find((x) => x.id === session.unitId);
        if (u) await repoRef.current.unitUpsert({ ...u, completed: true, updatedAt: nowIso() });
      }
    });
    return { ok: true, id: session.id, effects: deriveSessionEffects(session) };
  };

  const updateSession = async (id: string, input: SessionInput): Promise<MutResult> => {
    const existing = graph.sessions.find((s) => s.id === id);
    if (!existing) return { ok: false, errors: { _: "Session not found." } };
    const v = validateSessionInput(input);
    if (!v.ok) return v;
    const session: LanguageSession = {
      ...existing,
      ...v.value,
      date: v.value.date || existing.date,
      updatedAt: nowIso(),
    };
    setGraph((g) => ({ ...g, sessions: g.sessions.map((s) => (s.id === id ? session : s)) }));
    await persist(() => repoRef.current.sessionUpsert(session));
    return { ok: true, id };
  };

  const deleteSession = async (id: string) => {
    setGraph((g) => ({ ...g, sessions: g.sessions.filter((s) => s.id !== id) }));
    await persist(() => repoRef.current.sessionDelete(id));
  };

  // --- book CRUD -------------------------------------------------
  const createBook = async (input: BookInput): Promise<MutResult> => {
    const v = validateBookInput(input);
    if (!v.ok) return v;
    const book: Book = {
      id: newId("book"),
      ...v.value,
      startedDate: v.value.status === "reading" ? todayIso() : null,
      finishedDate: v.value.status === "completed" ? todayIso() : null,
      archived: false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    setGraph((g) => ({ ...g, books: [...g.books, book] }));
    await persist(() => repoRef.current.bookUpsert(book));
    return { ok: true, id: book.id };
  };

  const updateBook = async (id: string, input: BookInput): Promise<MutResult> => {
    const existing = getBook(id);
    if (!existing) return { ok: false, errors: { _: "Book not found." } };
    const v = validateBookInput(input);
    if (!v.ok) return v;
    const book: Book = {
      ...existing,
      ...v.value,
      startedDate:
        existing.startedDate ?? (v.value.status === "reading" ? todayIso() : null),
      finishedDate:
        v.value.status === "completed" ? (existing.finishedDate ?? todayIso()) : null,
      updatedAt: nowIso(),
    };
    setGraph((g) => ({ ...g, books: g.books.map((b) => (b.id === id ? book : b)) }));
    await persist(() => repoRef.current.bookUpsert(book));
    return { ok: true, id };
  };

  const patchBook = async (id: string, patch: Partial<Book>) => {
    const existing = getBook(id);
    if (!existing) return;
    const book: Book = { ...existing, ...patch, updatedAt: nowIso() };
    setGraph((g) => ({ ...g, books: g.books.map((b) => (b.id === id ? book : b)) }));
    await persist(() => repoRef.current.bookUpsert(book));
  };
  const setBookStatus = (id: string, status: BookStatus) =>
    patchBook(id, {
      status,
      finishedDate: status === "completed" ? (getBook(id)?.finishedDate ?? todayIso()) : null,
      startedDate: getBook(id)?.startedDate ?? (status === "reading" ? todayIso() : null),
    });
  const archiveBook = (id: string, archived = true) => patchBook(id, { archived });
  const linkBookTopic = (bookId: string, topicId: string) =>
    patchBook(bookId, { knowledgeTopicId: topicId || null });
  const unlinkBookTopic = (bookId: string) => patchBook(bookId, { knowledgeTopicId: null });
  const updateBookProgress = (id: string, currentPage: number, currentChapter?: number) => {
    const b = getBook(id);
    if (!b) return Promise.resolve();
    const cp = Math.max(0, Math.round(currentPage));
    const clamped = b.totalPages ? Math.min(cp, b.totalPages) : cp;
    return patchBook(id, {
      currentPage: clamped,
      currentChapter: currentChapter !== undefined ? Math.max(0, Math.round(currentChapter)) : b.currentChapter,
    });
  };

  const deleteBook = async (id: string) => {
    setGraph((g) => ({
      ...g,
      books: g.books.filter((b) => b.id !== id),
      readingSessions: g.readingSessions.filter((s) => s.bookId !== id),
    }));
    await persist(() => repoRef.current.bookDelete(id));
  };

  // --- reading session -----------------------------------------
  const logReadingSession = async (
    bookId: string,
    input: ReadingSessionInput,
  ): Promise<MutResult> => {
    const book = getBook(bookId);
    if (!book) return { ok: false, errors: { _: "Book not found." } };
    const v = validateReadingSessionInput(input);
    if (!v.ok) return v;
    const session: ReadingSession = {
      id: newId("rsess"),
      bookId,
      ...v.value,
      date: v.value.date || todayIso(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    // Recording where you read to advances the book position — arithmetic only,
    // never a Knowledge/mastery write.
    const advancedPage = Math.max(book.currentPage, session.toPage);
    const clampedPage = book.totalPages ? Math.min(advancedPage, book.totalPages) : advancedPage;
    const nextBook: Book = { ...book, currentPage: clampedPage, updatedAt: nowIso() };
    setGraph((g) => ({
      ...g,
      readingSessions: [...g.readingSessions, session],
      books: g.books.map((b) => (b.id === bookId ? nextBook : b)),
    }));
    await persist(async () => {
      await repoRef.current.readingSessionUpsert(session);
      await repoRef.current.bookUpsert(nextBook);
    });
    return { ok: true, id: session.id };
  };

  const deleteReadingSession = async (id: string) => {
    setGraph((g) => ({ ...g, readingSessions: g.readingSessions.filter((s) => s.id !== id) }));
    await persist(() => repoRef.current.readingSessionDelete(id));
  };

  const value = useMemo<LanguageContextValue>(
    () => ({
      loaded,
      loadError,
      saveState,
      saveError,
      backend: repoRef.current.kind,
      legacyImport,
      paths: graph.paths,
      units: graph.units,
      sessions: graph.sessions,
      books: graph.books,
      readingSessions: graph.readingSessions,
      getPath,
      getActivePaths,
      getUnitsForPath,
      getSessionsForPath,
      getRecentSessions,
      getPathProgress,
      getNextUnit,
      getBook,
      getActiveBooks,
      getReadingSessionsForBook,
      getReadingProgress,
      createPath,
      updatePath,
      setPathStatus,
      archivePath,
      deletePath,
      linkPathRoutine,
      unlinkPathRoutine,
      createUnit,
      updateUnit,
      toggleUnit,
      deleteUnit,
      reorderUnits,
      logSession,
      updateSession,
      deleteSession,
      createBook,
      updateBook,
      setBookStatus,
      archiveBook,
      deleteBook,
      updateBookProgress,
      linkBookTopic,
      unlinkBookTopic,
      logReadingSession,
      deleteReadingSession,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [graph, loaded, loadError, saveState, saveError, legacyImport],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
