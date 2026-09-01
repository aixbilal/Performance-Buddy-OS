/**
 * Module-singleton revision recorder.
 *
 * Domain stores call `recordRevision(...)` fire-and-forget from inside their
 * canonical mutation methods. Using a singleton (not React context) means no
 * provider-tree reordering: `performance` is the outermost provider yet can
 * still record without depending on a Revision provider that wraps it.
 *
 * CONTRACT: recording an audit event must NEVER break or block the user's
 * mutation. Every persistence path here swallows its own errors — a failed
 * audit write is logged in dev and dropped, the domain write is unaffected
 * (`Failed Save ≠ Lost Draft`, and here: `Failed audit ≠ Failed mutation`).
 */
import { newRevisionId } from "./ids";
import { makeRevisionRepo, type RevisionRepo } from "./repo";
import type { RevisionEvent, RevisionInput } from "./types";

type Listener = (events: RevisionEvent[]) => void;

let repo: RevisionRepo | null = null;
const recent: RevisionEvent[] = []; // newest-first, capped — for live UI only
const RECENT_CAP = 100;
const listeners = new Set<Listener>();

function getRepo(): RevisionRepo {
  if (!repo) repo = makeRevisionRepo();
  return repo;
}

function notify() {
  const snapshot = recent.slice();
  for (const l of listeners) {
    try {
      l(snapshot);
    } catch {
      /* a broken subscriber must not stop the others */
    }
  }
}

/**
 * Append one immutable revision event. Fire-and-forget: returns void, never
 * throws, never rejects into the caller.
 */
export function recordRevision(input: RevisionInput): void {
  const event: RevisionEvent = {
    ...input,
    metadata: input.metadata ?? {},
    id: newRevisionId(),
    createdAt: new Date().toISOString(),
  };

  recent.unshift(event);
  if (recent.length > RECENT_CAP) recent.length = RECENT_CAP;
  notify();

  void (async () => {
    try {
      await getRepo().append(event);
    } catch (e) {
      if (import.meta.env?.MODE === "development") {
        // eslint-disable-next-line no-console
        console.warn("[revision] append failed (non-fatal):", e);
      }
    }
  })();
}

/** Live in-memory feed (newest-first) for the current session. */
export function recentRevisions(): RevisionEvent[] {
  return recent.slice();
}

export function subscribeRevisions(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** TEST ONLY — reset the singleton between test files. */
export function __resetRevisionRecorderForTest(nextRepo?: RevisionRepo): void {
  repo = nextRepo ?? null;
  recent.length = 0;
  listeners.clear();
}
