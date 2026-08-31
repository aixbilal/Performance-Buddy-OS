/**
 * Obsidian vault store — the ONE place vault config / index / note links live.
 *
 * PBOS holds metadata + governed references only; Obsidian owns note bodies.
 * The index is disposable (rebuilt by `refresh`). A note link is keyed by the
 * stable relative path so it survives a rescan and a missing file — a Knowledge
 * Topic is NEVER mutated because a file moved.
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
import type { SaveState } from "../resilience/types";
import { matchNoteByReference, resolveLink, searchNotes } from "./engine";
import { makeObsidianRepo, type ObsidianRepo } from "./repo";
import type {
  HubState,
  LinkResolution,
  NoteLink,
  NotePreview,
  ObsidianConfig,
  ObsidianGraph,
  ObsidianNote,
  ScanReport,
} from "./types";

type OpResult = { ok: true } | { ok: false; error: string };

type ObsidianContextValue = {
  loaded: boolean;
  loadError: string | null;
  saveState: SaveState;
  actionError: string | null;
  backend: "sqlite" | "adapter";

  config: ObsidianConfig | null;
  notes: ObsidianNote[];
  links: NoteLink[];
  hubState: HubState;
  lastScan: ScanReport | null;

  connect: (path: string) => Promise<OpResult>;
  disconnect: () => Promise<void>;
  refresh: () => Promise<OpResult>;
  linkNote: (topicId: string, relativePath: string) => Promise<OpResult>;
  unlinkNote: (id: string) => Promise<void>;
  openNote: (relativePath: string) => Promise<OpResult>;
  revealNote: (relativePath: string) => Promise<OpResult>;
  readNote: (relativePath: string) => Promise<NotePreview | null>;
  /** Dev-adapter only (browser). Undefined under the native backend. */
  simulateExternalRemoval?: (relativePaths: string[]) => Promise<void>;

  // reads
  search: (query: string) => ObsidianNote[];
  linksForTopic: (topicId: string) => NoteLink[];
  resolveLinkState: (link: NoteLink) => LinkResolution;
  findNoteByReference: (reference: string) => ObsidianNote | undefined;
};

const ObsidianContext = createContext<ObsidianContextValue | null>(null);
const EMPTY: ObsidianGraph = { config: null, notes: [], links: [] };

export function ObsidianProvider({ children }: { children: ReactNode }) {
  const repoRef = useRef<ObsidianRepo>(makeObsidianRepo());
  const [graph, setGraph] = useState<ObsidianGraph>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [actionError, setActionError] = useState<string | null>(null);
  const [lastScan, setLastScan] = useState<ScanReport | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const g = await repoRef.current.load();
        if (!cancelled) setGraph(g);
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function reload() {
    const g = await repoRef.current.load();
    setGraph(g);
  }

  async function op(fn: () => Promise<void>): Promise<OpResult> {
    setSaveState("saving");
    setActionError(null);
    try {
      await fn();
      await reload();
      setSaveState("saved");
      return { ok: true };
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      setSaveState("failed");
      setActionError(error);
      return { ok: false, error };
    }
  }

  const connect = (path: string) => op(() => repoRef.current.connect(path).then(() => undefined));
  const disconnect = async () => {
    await op(() => repoRef.current.disconnect());
  };
  const refresh = async () =>
    op(async () => {
      const report = await repoRef.current.scan();
      setLastScan(report);
    });
  const linkNote = (topicId: string, relativePath: string) =>
    op(() => repoRef.current.linkNote(topicId, relativePath));
  const unlinkNote = async (id: string) => {
    await op(() => repoRef.current.unlinkNote(id));
  };
  const openNote = (relativePath: string) => op(() => repoRef.current.openNote(relativePath));
  const revealNote = (relativePath: string) => op(() => repoRef.current.revealNote(relativePath));
  const readNote = async (relativePath: string): Promise<NotePreview | null> => {
    try {
      return await repoRef.current.readNote(relativePath);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
      return null;
    }
  };

  const simulateExternalRemoval = repoRef.current.simulateExternalRemoval
    ? async (relativePaths: string[]) => {
        await repoRef.current.simulateExternalRemoval!(relativePaths);
        await reload();
      }
    : undefined;

  const hubState: HubState = useMemo(() => {
    if (!loaded) return "loading";
    if (loadError) return "error";
    const c = graph.config;
    if (!c || c.status === "disconnected") return "not-connected";
    if (c.status === "missing") return "missing";
    return graph.notes.length === 0 ? "empty" : "indexed";
  }, [loaded, loadError, graph.config, graph.notes.length]);

  const search = (query: string) => searchNotes(graph.notes, query);
  const linksForTopic = (topicId: string) => graph.links.filter((l) => l.topicId === topicId);
  const resolveLinkState = (link: NoteLink) => resolveLink(link, graph.notes);
  const findNoteByReference = (reference: string) =>
    matchNoteByReference(graph.notes, reference);

  const value = useMemo<ObsidianContextValue>(
    () => ({
      loaded,
      loadError,
      saveState,
      actionError,
      backend: repoRef.current.kind,
      config: graph.config,
      notes: graph.notes,
      links: graph.links,
      hubState,
      lastScan,
      connect,
      disconnect,
      refresh,
      linkNote,
      unlinkNote,
      openNote,
      revealNote,
      readNote,
      simulateExternalRemoval,
      search,
      linksForTopic,
      resolveLinkState,
      findNoteByReference,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [graph, loaded, loadError, saveState, actionError, hubState, lastScan],
  );

  return <ObsidianContext.Provider value={value}>{children}</ObsidianContext.Provider>;
}

export function useObsidian() {
  const ctx = useContext(ObsidianContext);
  if (!ctx) throw new Error("useObsidian must be used within ObsidianProvider");
  return ctx;
}
