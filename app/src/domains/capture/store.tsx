/**
 * Quick Capture store (Batch 3 — durable).
 *
 * - The inbox is PERSISTED via `CaptureRepo` (SQLite in the app, localStorage
 *   in browser dev). A typed capture survives reload — no input loss.
 * - Confirming a capture DELEGATES to the existing canonical domain store
 *   (`addAction`, `createTransaction`, `checkInRoutine`). Quick Capture never
 *   creates a second Action / Transaction / Routine-log type of its own.
 * - Works without AI: an unclassifiable capture is still saved for manual
 *   classification. No fake AI interpretation.
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
import { classifyCapture, requiresManualReview } from "./engine";
import { newCaptureId } from "./ids";
import { makeCaptureRepo, type CaptureRepo } from "./repo";
import type { CaptureInboxItem, CaptureType } from "./types";
import { usePerformance } from "../performance/store";
import { useMoney } from "../money/store";
import { useRoutine } from "../routine/store";

type ConfirmResult = { ok: true; target: CaptureType; entityId: string | null } | { ok: false; error: string };

type CaptureContextValue = {
  loaded: boolean;
  loadError: string | null;
  saveState: SaveState;
  backend: "sqlite" | "localStorage";

  inbox: CaptureInboxItem[];
  unresolved: CaptureInboxItem[];

  /** Persist raw text through the deterministic classifier. Never lost. */
  capture: (rawText: string) => Promise<CaptureInboxItem>;
  /** Manually (re)classify an unprocessed capture. */
  reclassify: (itemId: string, type: CaptureType) => Promise<void>;
  /** Confirm the proposal → route into the REAL canonical engine. */
  confirmItem: (itemId: string) => Promise<ConfirmResult>;
  /** Mark resolved without creating anything. */
  dismissItem: (itemId: string) => Promise<void>;
  /** Hard-delete a capture row. */
  deleteItem: (itemId: string) => Promise<void>;
};

const CaptureContext = createContext<CaptureContextValue | null>(null);

const nowIso = () => new Date().toISOString();

export function CaptureProvider({ children }: { children: ReactNode }) {
  const repoRef = useRef<CaptureRepo>(makeCaptureRepo());
  const [inbox, setInbox] = useState<CaptureInboxItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  const { addAction } = usePerformance();
  const { createTransaction } = useMoney();
  const { routines, checkInRoutine } = useRoutine();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const repo = repoRef.current;
        await repo.importItems([]); // marks the (empty) legacy import done once
        const items = await repo.load();
        if (!cancelled) {
          setInbox(items);
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
    } catch {
      setSaveState("failed");
    }
  }

  const upsertLocal = (item: CaptureInboxItem) =>
    setInbox((prev) => {
      const i = prev.findIndex((x) => x.id === item.id);
      if (i >= 0) {
        const next = [...prev];
        next[i] = item;
        return next;
      }
      return [item, ...prev];
    });

  const capture = async (rawText: string): Promise<CaptureInboxItem> => {
    const proposal = classifyCapture(rawText);
    const item: CaptureInboxItem = {
      id: newCaptureId(),
      rawText,
      status: requiresManualReview(proposal) ? "unprocessed" : "proposed",
      proposal,
      resolution: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    upsertLocal(item);
    await persist(() => repoRef.current.upsert(item));
    return item;
  };

  const reclassify = async (itemId: string, type: CaptureType) => {
    const item = inbox.find((i) => i.id === itemId);
    if (!item) return;
    const proposal = { type, confidence: "high" as const, fields: item.proposal?.fields ?? { text: item.rawText } };
    const next: CaptureInboxItem = { ...item, proposal, status: "proposed", updatedAt: nowIso() };
    upsertLocal(next);
    await persist(() => repoRef.current.upsert(next));
  };

  const markResolved = async (item: CaptureInboxItem, resolution: CaptureInboxItem["resolution"]) => {
    const next: CaptureInboxItem = { ...item, status: "resolved", resolution, updatedAt: nowIso() };
    upsertLocal(next);
    await persist(() => repoRef.current.upsert(next));
  };

  const confirmItem = async (itemId: string): Promise<ConfirmResult> => {
    const item = inbox.find((i) => i.id === itemId);
    if (!item || !item.proposal) return { ok: false, error: "Nothing to confirm." };
    if (item.status === "resolved") return { ok: false, error: "This capture is already resolved." };
    const { type, fields } = item.proposal;

    if (type === "action") {
      const action = await addAction({
        systemId: null,
        title: String(fields.title ?? item.rawText),
        context: "Quick Capture",
        estMinutes: 30,
        priority: "medium",
        triggerTiming: "Unscheduled",
      });
      await markResolved(item, { kind: "confirmed", target: "action", entityId: action?.id ?? null });
      return { ok: true, target: "action", entityId: action?.id ?? null };
    }

    if (type === "expense") {
      const res = await createTransaction({
        date: new Date().toISOString().slice(0, 10),
        type: "expense",
        amount: Number(fields.amount) || 0,
        category: "Quick Capture",
        description: String(fields.description ?? item.rawText),
        savingsGoalId: null,
      });
      const entityId = res.ok ? res.id : null;
      if (!res.ok) return { ok: false, error: Object.values(res.errors)[0] ?? "Could not record the expense." };
      await markResolved(item, { kind: "confirmed", target: "expense", entityId });
      return { ok: true, target: "expense", entityId };
    }

    if (type === "routine-checkin") {
      const hint = String(fields.routineHint ?? fields.description ?? item.rawText).toLowerCase();
      const match = routines.find(
        (r) => !r.archived && (hint.includes(r.title.toLowerCase()) || r.title.toLowerCase().includes(hint.trim())),
      );
      if (!match) {
        return {
          ok: false,
          error: "No routine matches this text. Create the routine first, or reclassify this capture.",
        };
      }
      const res = await checkInRoutine(match.id, {
        date: new Date().toISOString().slice(0, 10),
        state: "complete",
        quantityCompleted: null,
        durationCompletedMinutes: null,
      });
      const entityId = res.ok ? res.id : null;
      if (!res.ok) return { ok: false, error: Object.values(res.errors)[0] ?? "Could not check in." };
      await markResolved(item, { kind: "confirmed", target: "routine-checkin", entityId });
      return { ok: true, target: "routine-checkin", entityId };
    }

    // note / unclassified have no canonical V1 destination — they stay as a
    // durable inbox item (a Quick Note is NOT a Knowledge concept; no mastery
    // is invented). The user dismisses or deletes it when done.
    return {
      ok: false,
      error: "This capture has no V1 destination. Keep it here as a note, or dismiss it.",
    };
  };

  const dismissItem = async (itemId: string) => {
    const item = inbox.find((i) => i.id === itemId);
    if (!item) return;
    await markResolved(item, { kind: "dismissed" });
  };

  const deleteItem = async (itemId: string) => {
    setInbox((prev) => prev.filter((i) => i.id !== itemId));
    await persist(() => repoRef.current.remove(itemId));
  };

  const value = useMemo<CaptureContextValue>(
    () => ({
      loaded,
      loadError,
      saveState,
      backend: repoRef.current.kind,
      inbox,
      unresolved: inbox.filter((i) => i.status !== "resolved"),
      capture,
      reclassify,
      confirmItem,
      dismissItem,
      deleteItem,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [inbox, loaded, loadError, saveState],
  );

  return <CaptureContext.Provider value={value}>{children}</CaptureContext.Provider>;
}

export function useCapture() {
  const ctx = useContext(CaptureContext);
  if (!ctx) throw new Error("useCapture must be used within CaptureProvider");
  return ctx;
}
