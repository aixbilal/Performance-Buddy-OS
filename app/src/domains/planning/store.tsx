/**
 * Planning & Calendar store — the ONE place PlanningBlock + capacity state
 * lives (the PLAN stage of the operating loop).
 *
 * - Canonical persistence is relational SQLite via `PlanningRepo` (Batch 3).
 * - No seed data. Fresh profile has no scheduled blocks; a returning user's
 *   pre-3 KV blobs are imported once (idempotent, non-destructive).
 * - ACTION ≠ PLANNING BLOCK ≠ COMPLETION. `setBlockStatus` only ever changes
 *   the block's own status; it never touches the linked Action.
 * - Conflict / capacity / fragility are DERIVED every render by the engine —
 *   never stored.
 * - Generate vs Apply: `generateProposal` is pure and mutates nothing;
 *   `applyProposal` then replaces only the GENERATED-and-unlocked blocks —
 *   manual blocks and locked blocks survive regeneration untouched.
 * - Calendar is a VIEW: `blocksForWeek` / `blocksForDate` resolve dated blocks
 *   to their exact date and undated blocks to their recurring weekday. There is
 *   no second CalendarEvent store.
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
  addDaysIso,
  blocksOnDate,
  computePlanFragility,
  detectCapacityViolations,
  detectConflicts,
  isoDateOf,
  mondayIndexOf,
  proposeSchedule,
  startOfWeekIso,
  tryFitBlock,
  weekDates,
  type ScheduleProposal,
} from "./engine";
import { newId } from "./ids";
import { recordRevision } from "../revision/recorder";
import { resolveLegacyPlanning, type PlanningLegacyReport } from "./legacyImport";
import { makePlanningRepo, type PlanningRepo } from "./repo";
import { makeAdaptivePlanningRepo, type AdaptivePlanningRepo } from "../adaptive/repo";
import type {
  OccurrenceState,
  PlanningChangeSet,
  PlanningChangeSetScope,
  PlanningDiffChange,
  PlanningOccurrenceException,
} from "../adaptive/types";
import type { PlanningDiff } from "./adaptiveEngine";
import {
  DEFAULT_CAPACITY,
  type CapacityConfig,
  type PlanningBlock,
  type PlanningBlockInput,
  type PlanningGraph,
  type ScheduleBlock,
} from "./types";

type MutResult = { ok: true; id: string } | { ok: false; errors: Record<string, string> };

const nowIso = () => new Date().toISOString();
const EMPTY: PlanningGraph = { blocks: [], capacity: { ...DEFAULT_CAPACITY } };

function validateBlockInput(input: PlanningBlockInput): { ok: true } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  if (!input.title.trim()) errors.title = "Give the block a title.";
  if (!Number.isInteger(input.day) || input.day < 0 || input.day > 6) errors.day = "Pick a weekday.";
  if (!Number.isFinite(input.startMinute) || input.startMinute < 0 || input.startMinute > 24 * 60)
    errors.startMinute = "Start time is out of range.";
  if (!Number.isFinite(input.endMinute) || input.endMinute <= input.startMinute)
    errors.endMinute = "End time must be after the start time.";
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true };
}

export type CalendarDay = { iso: string; weekdayIndex: number; blocks: PlanningBlock[] };
export type MoveBlockPatch = {
  day?: number;
  date?: string | null;
  startMinute?: number;
  endMinute?: number;
};

type PlanningContextValue = {
  loaded: boolean;
  loadError: string | null;
  saveState: SaveState;
  saveError: string | null;
  backend: "sqlite" | "localStorage";
  legacyImport: PlanningLegacyReport | null;

  blocks: PlanningBlock[];
  capacity: CapacityConfig;

  // derived (never stored)
  conflicts: ReturnType<typeof detectConflicts>;
  violations: ReturnType<typeof detectCapacityViolations>;
  weeklyScheduledMinutes: number;
  fragility: ReturnType<typeof computePlanFragility>;
  checkFit: (candidate: ScheduleBlock) => ReturnType<typeof tryFitBlock>;
  blocksForDate: (isoDate: string, weekdayIndex: number) => PlanningBlock[];
  todaysBlocks: PlanningBlock[];
  todayIso: string;

  // calendar week view
  weekStartIso: string;
  weekDays: CalendarDay[];
  goToWeek: (mondayIso: string) => void;
  shiftWeek: (deltaWeeks: number) => void;
  goToCurrentWeek: () => void;

  // reads
  getBlock: (id: string) => PlanningBlock | undefined;
  getBlocksForAction: (actionId: string) => PlanningBlock[];

  // block CRUD
  createBlock: (input: PlanningBlockInput) => Promise<MutResult>;
  updateBlock: (id: string, input: PlanningBlockInput) => Promise<MutResult>;
  setBlockStatus: (id: string, status: PlanningBlock["status"]) => Promise<void>;
  toggleBlockLock: (id: string) => Promise<void>;
  moveBlock: (id: string, patch: MoveBlockPatch) => Promise<void>;
  deleteBlock: (id: string) => Promise<void>;

  // capacity (Planning is canonical for planning capacity)
  setCapacity: (capacity: CapacityConfig) => Promise<void>;

  // Generate → Review → Apply (deterministic, NOT AI)
  generateProposal: (
    candidates: { actionId: string; title: string; estMinutes: number | null }[],
  ) => ScheduleProposal;
  applyProposal: (proposal: ScheduleProposal) => Promise<void>;

  // --- V2 Adaptive Planning (schema v11) ---------------------------
  occurrenceExceptions: PlanningOccurrenceException[];
  /** The persisted state of ONE date of a recurring block, or null. */
  occurrenceStateFor: (blockId: string, occurrenceDate: string) => OccurrenceState | null;
  /**
   * Resolve one occurrence of a recurring block WITHOUT touching the template.
   * "defer" also creates a concrete date-pinned replacement block and links it.
   */
  resolveOccurrence: (
    blockId: string,
    occurrenceDate: string,
    kind: OccurrenceState,
    toDate?: string,
  ) => Promise<MutResult>;
  changeSets: PlanningChangeSet[];
  /** Apply a reviewed Planning Diff as one unit; persists it + its inverse. */
  applyPlanningDiff: (
    diff: PlanningDiff,
    opts: { scope: PlanningChangeSetScope; targetStartDate?: string; targetEndDate?: string; rationale?: string },
  ) => Promise<{ ok: boolean; changeSetId: string | null; message: string }>;
  /** Practical Undo — replays the stored inverse changes. */
  undoPlanningChangeSet: (changeSetId: string) => Promise<{ ok: boolean; message: string }>;
};

const PlanningContext = createContext<PlanningContextValue | null>(null);

/** Build a durable Planning Diff row (schema v11) from a reviewed diff. */
function makeChangeSet(
  diff: PlanningDiff,
  opts: {
    scope: PlanningChangeSetScope;
    targetStartDate?: string;
    targetEndDate?: string;
    rationale?: string;
  },
  status: PlanningChangeSet["status"],
): PlanningChangeSet {
  const now = new Date().toISOString();
  return {
    id: newId("cs"),
    scope: opts.scope,
    status,
    targetStartDate: opts.targetStartDate ?? null,
    targetEndDate: opts.targetEndDate ?? null,
    rationale: opts.rationale ?? "",
    reasonCodesJson: JSON.stringify(diff.reasonCodes),
    changesJson: JSON.stringify(diff.changes),
    inverseChangesJson: JSON.stringify(diff.inverseChanges),
    source: "adaptive-planning",
    createdAt: now,
    decidedAt: now,
    appliedAt: null,
    undoneAt: null,
  };
}

export function PlanningProvider({ children }: { children: ReactNode }) {
  const repoRef = useRef<PlanningRepo>(makePlanningRepo());
  const adaptiveRepoRef = useRef<AdaptivePlanningRepo>(makeAdaptivePlanningRepo());
  const [graph, setGraph] = useState<PlanningGraph>(EMPTY);
  const [occurrences, setOccurrences] = useState<PlanningOccurrenceException[]>([]);
  const occurrencesRef = useRef<PlanningOccurrenceException[]>([]);
  occurrencesRef.current = occurrences;
  const [changeSets, setChangeSets] = useState<PlanningChangeSet[]>([]);
  const changeSetsRef = useRef<PlanningChangeSet[]>([]);
  changeSetsRef.current = changeSets;
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [legacyImport, setLegacyImport] = useState<PlanningLegacyReport | null>(null);

  const todayIso = isoDateOf(new Date());
  const [weekStartIso, setWeekStartIso] = useState<string>(() => startOfWeekIso(isoDateOf(new Date())));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const repo = repoRef.current;
        const legacy = resolveLegacyPlanning({
          blocks: cacheAdapter.getItem("pbos:planning-blocks"),
          capacity: cacheAdapter.getItem("pbos:planning-capacity"),
        });
        const report = await repo.importGraph(legacy.graph);
        if (report.ran) setLegacyImport(legacy.report);
        const [g, occ, cs] = await Promise.all([
          repo.load(),
          adaptiveRepoRef.current.loadOccurrences().catch(() => [] as PlanningOccurrenceException[]),
          adaptiveRepoRef.current.loadChangeSets().catch(() => [] as PlanningChangeSet[]),
        ]);
        if (!cancelled) {
          setGraph(g);
          occurrencesRef.current = occ;
          setOccurrences(occ);
          changeSetsRef.current = cs;
          setChangeSets(cs);
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

  // --- derived --------------------------------------------------------
  const { blocks, capacity } = graph;
  const conflicts = detectConflicts(blocks);
  const violations = detectCapacityViolations(
    blocks,
    capacity.dailyCapacityMinutes,
    capacity.weeklyCapacityMinutes,
  );
  const weeklyScheduledMinutes = blocks.reduce((s, b) => s + (b.endMinute - b.startMinute), 0);
  const fragility = computePlanFragility(weeklyScheduledMinutes, capacity.weeklyCapacityMinutes);

  const checkFit = (candidate: ScheduleBlock) =>
    tryFitBlock(candidate, blocks, capacity.dailyCapacityMinutes, capacity.weeklyCapacityMinutes);

  const blocksForDate = (isoDate: string, weekdayIndex: number) =>
    blocksOnDate(blocks, isoDate, weekdayIndex);

  const todaysBlocks = blocksForDate(todayIso, mondayIndexOf(todayIso));

  const weekDays: CalendarDay[] = weekDates(weekStartIso).map((iso, i) => ({
    iso,
    weekdayIndex: i,
    blocks: blocksForDate(iso, i),
  }));

  const goToWeek = (mondayIso: string) => setWeekStartIso(startOfWeekIso(mondayIso));
  const shiftWeek = (deltaWeeks: number) => setWeekStartIso((w) => addDaysIso(w, deltaWeeks * 7));
  const goToCurrentWeek = () => setWeekStartIso(startOfWeekIso(isoDateOf(new Date())));

  // --- reads ---------------------------------------------------------
  const getBlock = (id: string) => blocks.find((b) => b.id === id);
  const getBlocksForAction = (actionId: string) => blocks.filter((b) => b.actionId === actionId);

  // --- block CRUD --------------------------------------------------
  const createBlock = async (input: PlanningBlockInput): Promise<MutResult> => {
    const v = validateBlockInput(input);
    if (!v.ok) return v;
    // Keep day + date consistent: if a date is pinned, its weekday wins.
    const day = input.date ? mondayIndexOf(input.date) : input.day;
    const block: PlanningBlock = {
      id: newId("blk"),
      ...input,
      day,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    setGraph((g) => ({ ...g, blocks: [...g.blocks, block] }));
    await persist(() => repoRef.current.blockUpsert(block));
    return { ok: true, id: block.id };
  };

  const updateBlock = async (id: string, input: PlanningBlockInput): Promise<MutResult> => {
    const existing = getBlock(id);
    if (!existing) return { ok: false, errors: { _: "Block not found." } };
    const v = validateBlockInput(input);
    if (!v.ok) return v;
    const day = input.date ? mondayIndexOf(input.date) : input.day;
    const block: PlanningBlock = { ...existing, ...input, day, updatedAt: nowIso() };
    setGraph((g) => ({ ...g, blocks: g.blocks.map((b) => (b.id === id ? block : b)) }));
    await persist(() => repoRef.current.blockUpsert(block));
    return { ok: true, id };
  };

  const patchBlock = async (id: string, patch: Partial<PlanningBlock>) => {
    const existing = getBlock(id);
    if (!existing) return;
    const block: PlanningBlock = { ...existing, ...patch, updatedAt: nowIso() };
    setGraph((g) => ({ ...g, blocks: g.blocks.map((b) => (b.id === id ? block : b)) }));
    await persist(() => repoRef.current.blockUpsert(block));
  };

  // Block-local only — NEVER writes to the linked Action.
  const setBlockStatus = (id: string, status: PlanningBlock["status"]) => patchBlock(id, { status });
  const toggleBlockLock = async (id: string) => {
    const existing = getBlock(id);
    if (existing) await patchBlock(id, { locked: !existing.locked });
  };
  const moveBlock = (id: string, patch: MoveBlockPatch) => {
    const next: Partial<PlanningBlock> = { ...patch };
    if (patch.date !== undefined && patch.date !== null) next.day = mondayIndexOf(patch.date);
    return patchBlock(id, next);
  };

  const deleteBlock = async (id: string) => {
    setGraph((g) => ({ ...g, blocks: g.blocks.filter((b) => b.id !== id) }));
    await persist(() => repoRef.current.blockDelete(id));
  };

  // --- capacity --------------------------------------------------
  const setCapacity = async (next: CapacityConfig) => {
    setGraph((g) => ({ ...g, capacity: next }));
    await persist(() => repoRef.current.capacitySet(next));
  };

  // --- Generate → Review → Apply ---------------------------------
  // Pure: respects only manual + locked blocks; proposes flexible slots for the
  // rest. Mutates nothing until applyProposal.
  const generateProposal = (
    candidates: { actionId: string; title: string; estMinutes: number | null }[],
  ): ScheduleProposal => {
    const respect = graph.blocks.filter((b) => b.locked || b.source === "manual");
    return proposeSchedule(
      candidates,
      respect,
      capacity.dailyCapacityMinutes,
      capacity.weeklyCapacityMinutes,
    );
  };

  const applyProposal = async (proposal: ScheduleProposal) => {
    // Survivors: every manual block, and every locked block (even generated).
    const survivors = graph.blocks.filter((b) => b.source === "manual" || b.locked);
    const replaced = graph.blocks.filter((b) => !(b.source === "manual" || b.locked));
    const generated: PlanningBlock[] = proposal.proposed.map((p) => ({
      id: newId("blk"),
      title: p.title,
      domain: "Planning",
      actionId: p.actionId,
      day: p.day,
      date: null,
      startMinute: p.startMinute,
      endMinute: p.endMinute,
      type: "flexible",
      locked: false,
      source: "generated",
      status: "scheduled",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }));
    const next = [...survivors, ...generated];
    setGraph((g) => ({ ...g, blocks: next }));
    await persist(async () => {
      for (const old of replaced) await repoRef.current.blockDelete(old.id);
      for (const b of generated) await repoRef.current.blockUpsert(b);
    });
    recordRevision({
      domain: "planning",
      entityType: "schedule",
      entityId: "week",
      operation: "reschedule",
      source: "user",
      summary: `Re-planned: ${generated.length} generated block(s), ${survivors.length} manual/locked kept`,
      metadata: { generated: generated.length, kept: survivors.length, replaced: replaced.length },
    });
  };

  // --- V2 Adaptive Planning -------------------------------------------
  const occurrenceStateFor = (blockId: string, occurrenceDate: string): OccurrenceState | null =>
    occurrencesRef.current.find(
      (e) => e.blockId === blockId && e.occurrenceDate === occurrenceDate,
    )?.state ?? null;

  const upsertOccurrenceLocal = (e: PlanningOccurrenceException) => {
    const prev = occurrencesRef.current;
    const i = prev.findIndex(
      (x) => x.blockId === e.blockId && x.occurrenceDate === e.occurrenceDate,
    );
    const next = i >= 0 ? prev.map((x, j) => (j === i ? e : x)) : [...prev, e];
    occurrencesRef.current = next;
    setOccurrences(next);
  };
  const removeOccurrenceLocal = (id: string) => {
    const next = occurrencesRef.current.filter((x) => x.id !== id);
    occurrencesRef.current = next;
    setOccurrences(next);
  };
  const upsertChangeSetLocal = (cs: PlanningChangeSet) => {
    const prev = changeSetsRef.current;
    const i = prev.findIndex((x) => x.id === cs.id);
    const next = i >= 0 ? prev.map((x, j) => (j === i ? cs : x)) : [cs, ...prev];
    changeSetsRef.current = next;
    setChangeSets(next);
  };

  const resolveOccurrence = async (
    blockId: string,
    occurrenceDate: string,
    kind: OccurrenceState,
    toDate?: string,
  ): Promise<MutResult> => {
    const template = graph.blocks.find((b) => b.id === blockId);
    if (!template) return { ok: false, errors: { _: "Block not found." } };
    // Editing ONE occurrence never mutates the recurring template.
    const now = nowIso();
    const existing = occurrencesRef.current.find(
      (e) => e.blockId === blockId && e.occurrenceDate === occurrenceDate,
    );
    let replacementBlockId: string | null = existing?.replacementBlockId ?? null;

    if (kind === "deferred") {
      const target = toDate ?? occurrenceDate;
      const replacement: PlanningBlock = {
        id: newId("blk"),
        title: template.title,
        domain: template.domain,
        actionId: template.actionId,
        day: mondayIndexOf(target),
        date: target,
        startMinute: template.startMinute,
        endMinute: template.endMinute,
        type: template.type,
        locked: false,
        source: "generated",
        status: "scheduled",
        createdAt: now,
        updatedAt: now,
      };
      setGraph((g) => ({ ...g, blocks: [...g.blocks, replacement] }));
      await persist(() => repoRef.current.blockUpsert(replacement));
      replacementBlockId = replacement.id;
    }

    const exception: PlanningOccurrenceException = {
      id: existing?.id ?? newId("occ"),
      blockId,
      occurrenceDate,
      state: kind,
      replacementBlockId,
      source: "user",
      note: existing?.note ?? "",
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    upsertOccurrenceLocal(exception);
    await persist(() => adaptiveRepoRef.current.upsertOccurrence(exception));
    recordRevision({
      domain: "planning",
      entityType: "occurrence-exception",
      entityId: `${blockId}@${occurrenceDate}`,
      operation: "update",
      source: "user",
      summary: `Occurrence ${occurrenceDate} of "${template.title}" → ${kind}`,
      metadata: { blockId, occurrenceDate, state: kind, replacementBlockId },
    });
    return { ok: true, id: exception.id };
  };

  const applyPlanningDiff = async (
    diff: PlanningDiff,
    opts: {
      scope: PlanningChangeSetScope;
      targetStartDate?: string;
      targetEndDate?: string;
      rationale?: string;
    },
  ): Promise<{ ok: boolean; changeSetId: string | null; message: string }> => {
    const createdBlockIds: string[] = [];
    const movedBack: { id: string; startMinute: number; endMinute: number }[] = [];
    const createdOccurrenceIds: string[] = [];
    try {
      for (const change of diff.changes) {
        if (change.kind === "keep") continue;
        if (change.kind === "add") {
          const b = change.block as Record<string, unknown>;
          const res = await createBlock({
            title: String(b.title ?? "Study block"),
            domain: String(b.domain ?? "Planning"),
            actionId: (b.actionId as string | null) ?? null,
            day: Number(b.day ?? 0),
            date: (b.date as string | null) ?? null,
            startMinute: Number(b.startMinute ?? 0),
            endMinute: Number(b.endMinute ?? 0),
            type: "flexible",
            locked: false,
            source: "generated",
            status: "scheduled",
          });
          if (!res.ok) throw new Error(Object.values(res.errors)[0] ?? "add failed");
          createdBlockIds.push(res.id);
        } else if (change.kind === "move") {
          const b = graph.blocks.find((x) => x.id === change.blockId);
          if (!b) continue;
          movedBack.push({ id: b.id, startMinute: b.startMinute, endMinute: b.endMinute });
          const dur = b.endMinute - b.startMinute;
          await moveBlock(b.id, {
            startMinute: change.toStartMinute,
            endMinute: change.toStartMinute + dur,
          });
        } else if (change.kind === "drop-occurrence" && !change.blockId.startsWith("__candidate:")) {
          const r = await resolveOccurrence(change.blockId, change.occurrenceDate, "skipped");
          if (r.ok) createdOccurrenceIds.push(r.id);
        } else if (change.kind === "mark-occurrence-done") {
          const r = await resolveOccurrence(change.blockId, change.occurrenceDate, "done");
          if (r.ok) createdOccurrenceIds.push(r.id);
        } else if (change.kind === "mark-occurrence-skipped") {
          const r = await resolveOccurrence(change.blockId, change.occurrenceDate, "skipped");
          if (r.ok) createdOccurrenceIds.push(r.id);
        } else if (change.kind === "defer") {
          const r = await resolveOccurrence(
            change.blockId,
            change.occurrenceDate,
            "deferred",
            change.toDate ?? undefined,
          );
          if (r.ok) createdOccurrenceIds.push(r.id);
        }
      }
    } catch (e) {
      // Compensating rollback — the diff must never land half-applied.
      for (const id of createdBlockIds) await deleteBlock(id);
      for (const m of movedBack) await moveBlock(m.id, { startMinute: m.startMinute, endMinute: m.endMinute });
      for (const id of createdOccurrenceIds) {
        removeOccurrenceLocal(id);
        await adaptiveRepoRef.current.removeOccurrence(id).catch(() => {});
      }
      const failed: PlanningChangeSet = makeChangeSet(diff, opts, "apply-failed");
      upsertChangeSetLocal(failed);
      await adaptiveRepoRef.current.upsertChangeSet(failed).catch(() => {});
      return {
        ok: false,
        changeSetId: null,
        message: e instanceof Error ? e.message : "Could not apply the plan changes.",
      };
    }

    const applied: PlanningChangeSet = {
      ...makeChangeSet(diff, opts, "applied"),
      appliedAt: nowIso(),
    };
    upsertChangeSetLocal(applied);
    await persist(() => adaptiveRepoRef.current.upsertChangeSet(applied));
    recordRevision({
      domain: "planning",
      entityType: "change-set",
      entityId: applied.id,
      operation: "apply",
      source: "user",
      summary: `Applied a ${opts.scope} planning diff (${diff.changes.length} change(s))`,
      metadata: { scope: opts.scope, changes: diff.changes.length },
    });
    return { ok: true, changeSetId: applied.id, message: "Plan changes applied." };
  };

  const undoPlanningChangeSet = async (
    changeSetId: string,
  ): Promise<{ ok: boolean; message: string }> => {
    const cs = changeSetsRef.current.find((x) => x.id === changeSetId);
    if (!cs) return { ok: false, message: "Change set not found." };
    if (cs.status !== "applied") return { ok: false, message: "Only an applied change set can be undone." };
    let inverse: PlanningDiffChange[];
    try {
      inverse = JSON.parse(cs.inverseChangesJson) as PlanningDiffChange[];
    } catch {
      return { ok: false, message: "The stored inverse changes are unreadable." };
    }
    for (const change of inverse) {
      if (change.kind === "move") {
        const b = graph.blocks.find((x) => x.id === change.blockId);
        if (b) {
          const dur = b.endMinute - b.startMinute;
          await moveBlock(b.id, { startMinute: change.toStartMinute, endMinute: change.toStartMinute + dur });
        }
      } else if (change.kind === "drop-occurrence" && change.blockId.startsWith("__candidate:")) {
        // inverse of an "add": delete the block created for that candidate
        const candidateId = change.blockId.slice("__candidate:".length);
        const created = graph.blocks.find(
          (x) => x.source === "generated" && x.date === change.occurrenceDate && x.title.length > 0 && x.id.includes(candidateId),
        );
        if (created) await deleteBlock(created.id);
      } else if (change.kind === "mark-occurrence-done" || change.kind === "drop-occurrence") {
        const ex = occurrencesRef.current.find(
          (e) => e.blockId === change.blockId && e.occurrenceDate === change.occurrenceDate,
        );
        if (ex) {
          removeOccurrenceLocal(ex.id);
          await adaptiveRepoRef.current.removeOccurrence(ex.id).catch(() => {});
        }
      }
    }
    const undone: PlanningChangeSet = { ...cs, status: "undone", undoneAt: nowIso() };
    upsertChangeSetLocal(undone);
    await persist(() => adaptiveRepoRef.current.upsertChangeSet(undone));
    return { ok: true, message: "Plan changes undone." };
  };

  const value = useMemo<PlanningContextValue>(
    () => ({
      loaded,
      loadError,
      saveState,
      saveError,
      backend: repoRef.current.kind,
      legacyImport,
      blocks,
      capacity,
      conflicts,
      violations,
      weeklyScheduledMinutes,
      fragility,
      checkFit,
      blocksForDate,
      todaysBlocks,
      todayIso,
      weekStartIso,
      weekDays,
      goToWeek,
      shiftWeek,
      goToCurrentWeek,
      getBlock,
      getBlocksForAction,
      createBlock,
      updateBlock,
      setBlockStatus,
      toggleBlockLock,
      moveBlock,
      deleteBlock,
      setCapacity,
      generateProposal,
      applyProposal,
      occurrenceExceptions: occurrences,
      occurrenceStateFor,
      resolveOccurrence,
      changeSets,
      applyPlanningDiff,
      undoPlanningChangeSet,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [graph, occurrences, changeSets, loaded, loadError, saveState, saveError, legacyImport, weekStartIso],
  );

  return <PlanningContext.Provider value={value}>{children}</PlanningContext.Provider>;
}

export function usePlanning() {
  const ctx = useContext(PlanningContext);
  if (!ctx) throw new Error("usePlanning must be used within PlanningProvider");
  return ctx;
}
