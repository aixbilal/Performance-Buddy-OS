/**
 * Canonical relational persistence for the Reading & Language Learning domain.
 *
 *   store.tsx  ->  LanguageRepo  ->  { Tauri commands -> Rust -> SQLite }
 *                               \->  { localStorage JSON }  (browser dev only)
 */
import { invoke, isTauri } from "@tauri-apps/api/core";
import type {
  Book,
  LanguageGraph,
  LanguagePath,
  LanguageSession,
  LanguageUnit,
  ReadingSession,
} from "./types";

export type LanguageImportReport = {
  ran: boolean;
  pathsImported: number;
  unitsImported: number;
  sessionsImported: number;
  booksImported: number;
  readingSessionsImported: number;
  routineLinksCleared: number;
  knowledgeLinksCleared: number;
};

export interface LanguageRepo {
  readonly kind: "sqlite" | "localStorage";
  load(): Promise<LanguageGraph>;
  pathUpsert(path: LanguagePath): Promise<void>;
  pathDelete(id: string): Promise<void>;
  unitUpsert(unit: LanguageUnit): Promise<void>;
  unitDelete(id: string): Promise<void>;
  unitsReorder(pathId: string, orderedIds: string[]): Promise<void>;
  sessionUpsert(session: LanguageSession): Promise<void>;
  sessionDelete(id: string): Promise<void>;
  bookUpsert(book: Book): Promise<void>;
  bookDelete(id: string): Promise<void>;
  readingSessionUpsert(session: ReadingSession): Promise<void>;
  readingSessionDelete(id: string): Promise<void>;
  importGraph(graph: LanguageGraph): Promise<LanguageImportReport>;
}

const EMPTY: LanguageGraph = { paths: [], units: [], sessions: [], books: [], readingSessions: [] };

function normReport(r: Record<string, unknown>): LanguageImportReport {
  const num = (a: unknown, b: unknown) => Number(a ?? b ?? 0);
  return {
    ran: !!r.ran,
    pathsImported: num(r.pathsImported, r.paths_imported),
    unitsImported: num(r.unitsImported, r.units_imported),
    sessionsImported: num(r.sessionsImported, r.sessions_imported),
    booksImported: num(r.booksImported, r.books_imported),
    readingSessionsImported: num(r.readingSessionsImported, r.reading_sessions_imported),
    routineLinksCleared: num(r.routineLinksCleared, r.routine_links_cleared),
    knowledgeLinksCleared: num(r.knowledgeLinksCleared, r.knowledge_links_cleared),
  };
}

// --- Tauri / SQLite --------------------------------------------------------

class SqliteRepo implements LanguageRepo {
  readonly kind = "sqlite" as const;
  async load() {
    return await invoke<LanguageGraph>("lang_load");
  }
  async pathUpsert(path: LanguagePath) {
    await invoke("lang_path_upsert", { path });
  }
  async pathDelete(id: string) {
    await invoke("lang_path_delete", { id });
  }
  async unitUpsert(unit: LanguageUnit) {
    await invoke("lang_unit_upsert", { unit });
  }
  async unitDelete(id: string) {
    await invoke("lang_unit_delete", { id });
  }
  async unitsReorder(pathId: string, orderedIds: string[]) {
    await invoke("lang_units_reorder", { pathId, orderedIds });
  }
  async sessionUpsert(session: LanguageSession) {
    await invoke("lang_session_upsert", { session });
  }
  async sessionDelete(id: string) {
    await invoke("lang_session_delete", { id });
  }
  async bookUpsert(book: Book) {
    await invoke("lang_book_upsert", { book });
  }
  async bookDelete(id: string) {
    await invoke("lang_book_delete", { id });
  }
  async readingSessionUpsert(session: ReadingSession) {
    await invoke("lang_reading_session_upsert", { session });
  }
  async readingSessionDelete(id: string) {
    await invoke("lang_reading_session_delete", { id });
  }
  async importGraph(graph: LanguageGraph) {
    return normReport(await invoke("lang_import_graph", { import: graph }));
  }
}

// --- localStorage (browser dev fallback) ---------------------------------

const LS_KEY = "pbos:language-v2";
const LS_IMPORT_MARK = "pbos:language-v2-imported";

export class LocalRepo implements LanguageRepo {
  readonly kind = "localStorage" as const;

  private read(): LanguageGraph {
    try {
      const raw = window.localStorage.getItem(LS_KEY);
      if (!raw) return { ...EMPTY };
      const g = JSON.parse(raw) as LanguageGraph;
      return {
        paths: g.paths ?? [],
        units: g.units ?? [],
        sessions: g.sessions ?? [],
        books: g.books ?? [],
        readingSessions: g.readingSessions ?? [],
      };
    } catch {
      return { ...EMPTY };
    }
  }
  private write(g: LanguageGraph) {
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
  async pathUpsert(path: LanguagePath) {
    const g = this.read();
    g.paths = this.upsert(g.paths, path);
    this.write(g);
  }
  async pathDelete(id: string) {
    const g = this.read();
    g.paths = g.paths.filter((p) => p.id !== id);
    g.units = g.units.filter((u) => u.pathId !== id); // CASCADE
    g.sessions = g.sessions.filter((s) => s.pathId !== id); // CASCADE
    this.write(g);
  }
  async unitUpsert(unit: LanguageUnit) {
    const g = this.read();
    if (!g.paths.some((p) => p.id === unit.pathId)) return; // FK
    g.units = this.upsert(g.units, unit);
    this.write(g);
  }
  async unitDelete(id: string) {
    const g = this.read();
    g.units = g.units.filter((u) => u.id !== id);
    g.sessions = g.sessions.map((s) => (s.unitId === id ? { ...s, unitId: null } : s)); // SET NULL
    this.write(g);
  }
  async unitsReorder(pathId: string, orderedIds: string[]) {
    const g = this.read();
    g.units = g.units.map((u) => {
      if (u.pathId !== pathId) return u;
      const pos = orderedIds.indexOf(u.id);
      return pos >= 0 ? { ...u, position: pos } : u;
    });
    this.write(g);
  }
  async sessionUpsert(session: LanguageSession) {
    const g = this.read();
    if (!g.paths.some((p) => p.id === session.pathId)) return; // FK
    const unitId = session.unitId && g.units.some((u) => u.id === session.unitId) ? session.unitId : null;
    g.sessions = this.upsert(g.sessions, { ...session, unitId });
    this.write(g);
  }
  async sessionDelete(id: string) {
    const g = this.read();
    g.sessions = g.sessions.filter((s) => s.id !== id);
    this.write(g);
  }
  async bookUpsert(book: Book) {
    const g = this.read();
    g.books = this.upsert(g.books, book);
    this.write(g);
  }
  async bookDelete(id: string) {
    const g = this.read();
    g.books = g.books.filter((b) => b.id !== id);
    g.readingSessions = g.readingSessions.filter((s) => s.bookId !== id); // CASCADE
    this.write(g);
  }
  async readingSessionUpsert(session: ReadingSession) {
    const g = this.read();
    if (!g.books.some((b) => b.id === session.bookId)) return; // FK
    g.readingSessions = this.upsert(g.readingSessions, session);
    this.write(g);
  }
  async readingSessionDelete(id: string) {
    const g = this.read();
    g.readingSessions = g.readingSessions.filter((s) => s.id !== id);
    this.write(g);
  }
  async importGraph(graph: LanguageGraph): Promise<LanguageImportReport> {
    if (window.localStorage.getItem(LS_IMPORT_MARK)) {
      return {
        ran: false,
        pathsImported: 0,
        unitsImported: 0,
        sessionsImported: 0,
        booksImported: 0,
        readingSessionsImported: 0,
        routineLinksCleared: 0,
        knowledgeLinksCleared: 0,
      };
    }
    const g = this.read();
    const has = (arr: { id: string }[], id: string) => arr.some((x) => x.id === id);
    const report: LanguageImportReport = {
      ran: true,
      pathsImported: 0,
      unitsImported: 0,
      sessionsImported: 0,
      booksImported: 0,
      readingSessionsImported: 0,
      routineLinksCleared: 0,
      knowledgeLinksCleared: 0,
    };
    for (const p of graph.paths)
      if (!has(g.paths, p.id)) {
        g.paths.push(p);
        report.pathsImported++;
      }
    for (const u of graph.units) {
      if (has(g.units, u.id) || !has(g.paths, u.pathId)) continue;
      g.units.push(u);
      report.unitsImported++;
    }
    for (const s of graph.sessions) {
      if (has(g.sessions, s.id) || !has(g.paths, s.pathId)) continue;
      const unitId = s.unitId && has(g.units, s.unitId) ? s.unitId : null;
      g.sessions.push({ ...s, unitId });
      report.sessionsImported++;
    }
    for (const b of graph.books)
      if (!has(g.books, b.id)) {
        g.books.push(b);
        report.booksImported++;
      }
    for (const s of graph.readingSessions) {
      if (has(g.readingSessions, s.id) || !has(g.books, s.bookId)) continue;
      g.readingSessions.push(s);
      report.readingSessionsImported++;
    }
    this.write(g);
    window.localStorage.setItem(LS_IMPORT_MARK, new Date().toISOString());
    return report;
  }
}

export function makeLanguageRepo(): LanguageRepo {
  try {
    if (isTauri()) return new SqliteRepo();
  } catch {
    /* fall through */
  }
  return new LocalRepo();
}
