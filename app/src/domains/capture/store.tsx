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
import { buildProposals, type CaptureResolvers, type EntityResolution } from "./naturalCapture";
import type { CaptureInboxItem, CaptureType } from "./types";
import { usePerformance } from "../performance/store";
import { useMoney } from "../money/store";
import { useRoutine } from "../routine/store";
import { useAcademic } from "../academic/store";
import { useLanguage } from "../language/store";
import { useAICoach } from "../intelligence/store";
import { useMutationContext } from "../mutations/useMutationContext";
import { getMutation, runMutation } from "../mutations/registry";
import { makeCaptureProposalsRepo, type CaptureProposalsRepo } from "../adaptive/repo";
import type { CaptureProposalRecord } from "../adaptive/types";
import { recordRevision } from "../revision/recorder";
import type { RevisionDomain } from "../revision/types";

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

  // --- Natural Capture V2 ---------------------------------------------
  /** All persisted V2 proposals (across every capture). */
  proposals: CaptureProposalRecord[];
  proposalsFor: (captureId: string) => CaptureProposalRecord[];
  /**
   * Persist raw text FIRST, then run deterministic local segmentation +
   * classification + entity resolution + duplicate detection, and persist a
   * multi-proposal bundle. Raw text is never lost, even with no structure.
   */
  captureNatural: (rawText: string) => Promise<{ item: CaptureInboxItem; proposals: CaptureProposalRecord[] }>;
  /** Accept / modify / reject one proposal (records the decision + edited params). */
  decideProposal: (
    proposalId: string,
    decision: "accepted" | "modified" | "rejected",
    effectiveParams?: Record<string, unknown>,
  ) => Promise<void>;
  /** Validate + apply one accepted/modified proposal through the shared mutation engine. */
  applyProposal: (proposalId: string) => Promise<{ ok: boolean; message: string; reasonCodes: string[] }>;
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
  const academic = useAcademic();
  const language = useLanguage();
  const { permissions } = useAICoach();
  const mutationCtx = useMutationContext();

  const proposalsRepoRef = useRef<CaptureProposalsRepo>(makeCaptureProposalsRepo());
  const [proposals, setProposals] = useState<CaptureProposalRecord[]>([]);
  /** Always-current mirror so chained store calls in one tick see fresh data. */
  const proposalsRef = useRef<CaptureProposalRecord[]>([]);
  proposalsRef.current = proposals;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const repo = repoRef.current;
        await repo.importItems([]); // marks the (empty) legacy import done once
        const [items, props] = await Promise.all([
          repo.load(),
          proposalsRepoRef.current.load().catch(() => [] as CaptureProposalRecord[]),
        ]);
        if (!cancelled) {
          setInbox(items);
          proposalsRef.current = props;
          setProposals(props);
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

  // --- Natural Capture V2 -------------------------------------------------

  const upsertProposalLocal = (p: CaptureProposalRecord) => {
    const prev = proposalsRef.current;
    const i = prev.findIndex((x) => x.id === p.id);
    const next = i >= 0 ? prev.map((x) => (x.id === p.id ? p : x)) : [...prev, p];
    proposalsRef.current = next;
    setProposals(next);
  };

  /** Entity resolvers built from the live canonical stores — existing first. */
  const buildResolvers = (): CaptureResolvers => {
    const dedupe = (
      matches: { id: string; label: string }[],
    ): EntityResolution =>
      matches.length === 0
        ? { status: "none" }
        : matches.length === 1
          ? { status: "resolved", id: matches[0].id, label: matches[0].label }
          : { status: "ambiguous", candidates: matches };
    const norm = (s: string) => s.trim().toLowerCase();
    return {
      resolveAcademicTopic: (title) => {
        const q = norm(title);
        const exact = academic.topics.filter((t) => norm(t.title) === q);
        const pool = exact.length ? exact : academic.topics.filter((t) => norm(t.title).includes(q));
        return dedupe(
          pool.map((t) => ({
            id: t.id,
            label: `${t.title} (${academic.getCourse(t.courseId)?.title ?? "course"})`,
          })),
        );
      },
      resolveAssessment: (title) => {
        const q = norm(title);
        const pool = academic.assessments.filter(
          (a) => norm(a.title) === q || norm(a.title).includes(q),
        );
        return dedupe(pool.map((a) => ({ id: a.id, label: a.title })));
      },
      resolveRoutine: (hint) => {
        const q = norm(hint);
        const pool = routines.filter(
          (r) => !r.archived && (norm(r.title).includes(q) || norm(r.category).includes(q)),
        );
        return dedupe(pool.map((r) => ({ id: r.id, label: r.title })));
      },
      resolveLanguagePath: (lang) => {
        const q = norm(lang);
        const pool = language.paths.filter(
          (p) => norm(p.language) === q || norm(p.language).includes(q),
        );
        return dedupe(pool.map((p) => ({ id: p.id, label: `${p.language} · ${p.title}` })));
      },
    };
  };

  const captureNatural = async (rawText: string) => {
    const now = new Date();
    const nowStr = now.toISOString();
    const item: CaptureInboxItem = {
      id: newCaptureId(),
      rawText,
      status: "unprocessed",
      proposal: null,
      resolution: null,
      createdAt: nowStr,
      updatedAt: nowStr,
    };
    // 1. raw text is persisted FIRST — a later failure cannot lose it.
    upsertLocal(item);
    await persist(() => repoRef.current.upsert(item));

    // 2. deterministic local engine → multi-proposal bundle.
    const { proposals: built } = buildProposals({
      captureId: item.id,
      rawText,
      now,
      permissions,
      resolvers: buildResolvers(),
      newId: () => `cprop_${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`,
    });

    for (const p of built) {
      upsertProposalLocal(p);
      try {
        await proposalsRepoRef.current.upsert(p);
      } catch {
        /* proposal cache is still usable; ret/re-persist on next decision */
      }
    }
    const next: CaptureInboxItem = {
      ...item,
      status: built.length > 0 ? "proposed" : "unprocessed",
      updatedAt: new Date().toISOString(),
    };
    upsertLocal(next);
    await persist(() => repoRef.current.upsert(next));
    return { item: next, proposals: built };
  };

  const proposalsFor = (captureId: string) =>
    proposalsRef.current.filter((p) => p.captureId === captureId);

  const settleCaptureIfDone = async (captureId: string) => {
    const item = inbox.find((i) => i.id === captureId);
    if (!item || item.status === "resolved") return;
    const mine = proposalsRef.current.filter((p) => p.captureId === captureId);
    if (mine.length > 0 && mine.every((p) => p.status === "applied" || p.status === "rejected")) {
      await markResolved(item, { kind: "confirmed", target: "note", entityId: null });
    }
  };

  const decideProposal = async (
    proposalId: string,
    decision: "accepted" | "modified" | "rejected",
    effectiveParams?: Record<string, unknown>,
  ) => {
    const p = proposalsRef.current.find((x) => x.id === proposalId);
    if (!p) return;
    const next: CaptureProposalRecord = {
      ...p,
      status: decision,
      effectiveParamsJson:
        decision === "modified" && effectiveParams
          ? JSON.stringify({ ...JSON.parse(p.effectiveParamsJson || "{}"), ...effectiveParams })
          : p.effectiveParamsJson,
      decidedAt: new Date().toISOString(),
    };
    upsertProposalLocal(next);
    await persist(() => proposalsRepoRef.current.upsert(next));
    if (decision === "rejected") await settleCaptureIfDone(p.captureId);
  };

  const applyProposal = async (proposalId: string) => {
    const p = proposalsRef.current.find((x) => x.id === proposalId);
    if (!p) return { ok: false, message: "Proposal not found.", reasonCodes: ["NOT_FOUND"] };
    if (p.status !== "accepted" && p.status !== "modified") {
      return { ok: false, message: "Accept or modify the proposal before applying it.", reasonCodes: ["NOT_DECIDED"] };
    }
    const descriptor = getMutation(p.mutationKind);
    if (!descriptor) {
      const failed: CaptureProposalRecord = {
        ...p,
        status: "apply-failed",
        validationJson: JSON.stringify({ ok: false, reasonCodes: ["UNKNOWN_KIND"], message: "No such mutation." }),
      };
      upsertProposalLocal(failed);
      await persist(() => proposalsRepoRef.current.upsert(failed));
      return { ok: false, message: "No such mutation.", reasonCodes: ["UNKNOWN_KIND"] };
    }
    const params = JSON.parse(p.effectiveParamsJson || "{}") as Record<string, unknown>;
    const outcome = await runMutation(p.mutationKind, params, mutationCtx);
    const settled: CaptureProposalRecord = {
      ...p,
      status: outcome.ok ? "applied" : "apply-failed",
      validationJson: JSON.stringify({ ok: outcome.ok, reasonCodes: outcome.reasonCodes, message: outcome.message }),
      appliedResultJson: outcome.ok ? JSON.stringify(outcome.result) : null,
      appliedAt: outcome.ok ? new Date().toISOString() : null,
    };
    upsertProposalLocal(settled);
    await persist(() => proposalsRepoRef.current.upsert(settled));
    if (outcome.ok) {
      recordRevision({
        domain: descriptor.revisionDomain as RevisionDomain,
        entityType: descriptor.revisionEntityType ?? descriptor.kind,
        entityId: String((outcome.result as Record<string, unknown>).id ?? p.id),
        operation: "apply",
        source: "user",
        summary: `Natural Capture: ${p.title}`,
        metadata: { captureId: p.captureId, mutationKind: p.mutationKind },
      });
      await settleCaptureIfDone(p.captureId);
    }
    return outcome;
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
      proposals,
      proposalsFor,
      captureNatural,
      decideProposal,
      applyProposal,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [inbox, loaded, loadError, saveState, proposals],
  );

  return <CaptureContext.Provider value={value}>{children}</CaptureContext.Provider>;
}

export function useCapture() {
  const ctx = useContext(CaptureContext);
  if (!ctx) throw new Error("useCapture must be used within CaptureProvider");
  return ctx;
}
