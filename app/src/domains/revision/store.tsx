/**
 * Revision / audit history store (read side).
 *
 * The WRITE path is the `recordRevision` singleton in `recorder.ts` (called
 * by domain stores). This provider is the READ surface: it loads the durable
 * history once and stays in sync with live events recorded this session.
 *
 * It has NO dependency on any other domain store, so it can sit anywhere in
 * the provider tree.
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
import { recentRevisions, subscribeRevisions } from "./recorder";
import { makeRevisionRepo, type RevisionRepo } from "./repo";
import type { RevisionEvent, RevisionQuery } from "./types";

type RevisionContextValue = {
  loaded: boolean;
  loadError: string | null;
  backend: "sqlite" | "localStorage";
  /** Durable history + anything recorded this session, newest-first, de-duped. */
  events: RevisionEvent[];
  /** Filter helper for entity-scoped history panels. */
  eventsFor: (query: RevisionQuery) => RevisionEvent[];
  /** Force a reload from durable storage. */
  refresh: () => Promise<void>;
};

const RevisionContext = createContext<RevisionContextValue | null>(null);

function mergeNewestFirst(a: RevisionEvent[], b: RevisionEvent[]): RevisionEvent[] {
  const seen = new Set<string>();
  const out: RevisionEvent[] = [];
  for (const e of [...a, ...b]) {
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    out.push(e);
  }
  out.sort((x, y) => (x.createdAt < y.createdAt ? 1 : x.createdAt > y.createdAt ? -1 : 0));
  return out;
}

export function RevisionProvider({ children }: { children: ReactNode }) {
  const repoRef = useRef<RevisionRepo>(makeRevisionRepo());
  const [durable, setDurable] = useState<RevisionEvent[]>([]);
  const [live, setLive] = useState<RevisionEvent[]>(recentRevisions());
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = async () => {
    try {
      const rows = await repoRef.current.load({ limit: 500 });
      setDurable(rows);
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoaded(true);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await load();
      if (cancelled) return;
    })();
    const unsub = subscribeRevisions((events) => setLive(events));
    return () => {
      cancelled = true;
      unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const events = useMemo(() => mergeNewestFirst(live, durable), [live, durable]);

  const value = useMemo<RevisionContextValue>(
    () => ({
      loaded,
      loadError,
      backend: repoRef.current.kind,
      events,
      eventsFor: (q: RevisionQuery) =>
        events.filter(
          (e) =>
            (!q.domain || e.domain === q.domain) &&
            (!q.entityType || e.entityType === q.entityType) &&
            (!q.entityId || e.entityId === q.entityId),
        ),
      refresh: load,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [events, loaded, loadError],
  );

  return <RevisionContext.Provider value={value}>{children}</RevisionContext.Provider>;
}

export function useRevision() {
  const ctx = useContext(RevisionContext);
  if (!ctx) throw new Error("useRevision must be used within RevisionProvider");
  return ctx;
}
