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
};

const PlanningContext = createContext<PlanningContextValue | null>(null);

export function PlanningProvider({ children }: { children: ReactNode }) {
  const repoRef = useRef<PlanningRepo>(makePlanningRepo());
  const [graph, setGraph] = useState<PlanningGraph>(EMPTY);
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
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [graph, loaded, loadError, saveState, saveError, legacyImport, weekStartIso],
  );

  return <PlanningContext.Provider value={value}>{children}</PlanningContext.Provider>;
}

export function usePlanning() {
  const ctx = useContext(PlanningContext);
  if (!ctx) throw new Error("usePlanning must be used within PlanningProvider");
  return ctx;
}
