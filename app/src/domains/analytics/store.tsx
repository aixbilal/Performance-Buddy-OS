import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  DomainSnapshot,
  MonthlyReview,
  Pattern,
  PeriodComparison,
  WeeklyReview,
} from "./types";
import {
  buildMonthlyReview,
  buildWeeklyReview,
  comparePeriods,
  completionRate,
  deriveDataSufficiency,
  derivePatterns,
  deriveDomainState,
  isoAddDays,
  isoInWindow,
  monthBounds,
  startOfWeekIso,
} from "./engine";
import { makeAnalyticsRepo, type AnalyticsRepo } from "./repo";
import { useAcademic } from "../academic/store";
import { useFitness } from "../fitness-recovery/store";
import { useMoney } from "../money/store";
import { useRoutine } from "../routine/store";

const todayIso = () => new Date().toISOString().slice(0, 10);
const COMPLETED = ["completed", "done"] as const;

type AnalyticsContextValue = {
  loaded: boolean;
  domainSnapshots: DomainSnapshot[];
  patterns: Pattern[];
  /** legacy single-pattern alias kept for any older consumer. */
  sleepFocusPattern: Pattern;
  weeklyReviews: WeeklyReview[];
  monthlyReviews: MonthlyReview[];
  /** the deterministic facts a Weekly Review would capture right now. */
  weeklySnapshot: () => {
    weekStart: string;
    weekEnd: string;
    domainSnapshots: DomainSnapshot[];
    routineCompletion: ReturnType<typeof completionRate>;
    dataSufficiency: ReturnType<typeof deriveDataSufficiency>;
  };
  monthlyComparisons: () => PeriodComparison[];
  logWeeklyReview: (wins: string[], friction: string[]) => Promise<void>;
  logMonthlyReview: (observations: string[]) => Promise<void>;
};

const AnalyticsContext = createContext<AnalyticsContextValue | null>(null);

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  const repoRef = useRef<AnalyticsRepo>(makeAnalyticsRepo());
  const { cgpa } = useAcademic();
  const { readiness } = useFitness();
  const { balance, expenseTotal } = useMoney();
  const { routines, getLogsForRoutine, getConsistency } = useRoutine();

  const [loaded, setLoaded] = useState(false);
  const [weeklyReviews, setWeeklyReviews] = useState<WeeklyReview[]>([]);
  const [monthlyReviews, setMonthlyReviews] = useState<MonthlyReview[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const g = await repoRef.current.load();
        if (!cancelled) {
          setWeeklyReviews(g.weekly);
          setMonthlyReviews(g.monthly);
        }
      } catch {
        /* honest empty */
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // --- domain snapshots — each reads its OWN domain's numbers, never combined --
  const activeRoutines = routines.filter((r) => !r.archived);
  const routineConsistency =
    activeRoutines.length > 0
      ? Math.round(
          activeRoutines
            .map((r) => getConsistency(r.id).percent ?? 0)
            .reduce((s, v) => s + v, 0) / activeRoutines.length,
        )
      : null;
  const loggedDays = activeRoutines.reduce(
    (s, r) => s + getConsistency(r.id).loggedDays,
    0,
  );

  const domainSnapshots: DomainSnapshot[] = useMemo(
    () => [
      {
        domain: "Academics",
        ...deriveDomainState(cgpa.cgpa ?? 0, null, cgpa.totalCreditsCounted),
        headline:
          cgpa.cgpa !== null
            ? `CGPA ${cgpa.cgpa.toFixed(2)} across ${cgpa.totalCreditsCounted} credits`
            : "No graded courses yet",
        evidenceCount: cgpa.totalCreditsCounted,
      },
      {
        domain: "Fitness",
        state:
          readiness.state === "insufficient-data"
            ? "stable"
            : readiness.state === "push"
              ? "improving"
              : readiness.state === "recovery"
                ? "needs-attention"
                : "stable",
        confidence: readiness.state === "insufficient-data" ? "limited" : "moderate",
        headline: readiness.reason,
        evidenceCount: readiness.score !== null ? 5 : 0,
      },
      {
        domain: "Routines",
        ...deriveDomainState(routineConsistency ?? 0, null, loggedDays),
        headline:
          routineConsistency !== null
            ? `Average consistency ${routineConsistency}% across ${activeRoutines.length} routines (${loggedDays} logged days)`
            : "Not enough logged days yet",
        evidenceCount: loggedDays,
      },
      {
        domain: "Money",
        state: "stable",
        confidence: "moderate",
        headline: `Tracked balance Rs ${balance.toLocaleString()} · Rs ${expenseTotal.toLocaleString()} recorded spending — not a verified bank balance`,
        evidenceCount: 1,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cgpa, readiness, balance, expenseTotal, routineConsistency, loggedDays, activeRoutines.length],
  );

  // --- deterministic patterns from real routine logs -----------------
  const patterns: Pattern[] = useMemo(() => {
    const cutoff = isoAddDays(todayIso(), -28);
    const series = activeRoutines.map((r) => ({
      label: r.title,
      days: getLogsForRoutine(r.id)
        .filter((l) => l.date >= cutoff)
        .map((l) => ({ date: l.date, completed: (COMPLETED as readonly string[]).includes(l.state) })),
    }));
    return derivePatterns(series);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routines]);

  const sleepFocusPattern = patterns[0];

  // --- weekly snapshot (deterministic facts) -------------------------
  const weeklySnapshot = () => {
    const weekStart = startOfWeekIso(todayIso());
    const weekEnd = isoAddDays(weekStart, 6);
    const weekLogs = activeRoutines.flatMap((r) =>
      getLogsForRoutine(r.id).filter((l) => isoInWindow(l.date, weekStart, weekEnd)),
    );
    return {
      weekStart,
      weekEnd,
      domainSnapshots,
      routineCompletion: completionRate(weekLogs, COMPLETED),
      dataSufficiency: deriveDataSufficiency(weekLogs.length),
    };
  };

  const monthlyComparisons = (): PeriodComparison[] => {
    const now = todayIso();
    const cur = monthBounds(now);
    const priorMonthAnchor = isoAddDays(cur.start, -1);
    const prior = monthBounds(priorMonthAnchor);
    const rate = (start: string, end: string) => {
      const logs = activeRoutines.flatMap((r) =>
        getLogsForRoutine(r.id).filter((l) => isoInWindow(l.date, start, end)),
      );
      return completionRate(logs, COMPLETED).rate;
    };
    return [
      comparePeriods(
        "Routine completion rate",
        "%",
        rate(cur.start, cur.end),
        rate(prior.start, prior.end),
      ),
    ];
  };

  // --- durable review logging ---------------------------------------
  const logWeeklyReview = async (wins: string[], friction: string[]) => {
    const snap = weeklySnapshot();
    const review = buildWeeklyReview(
      snap.weekStart,
      snap.weekEnd,
      snap.domainSnapshots,
      wins,
      friction,
    );
    setWeeklyReviews((prev) =>
      prev.some((r) => r.id === review.id) ? prev : [review, ...prev],
    );
    try {
      await repoRef.current.appendWeekly(review);
    } catch {
      /* optimistic */
    }
  };

  const logMonthlyReview = async (observations: string[]) => {
    const b = monthBounds(todayIso());
    const review = buildMonthlyReview(
      b.start,
      b.end,
      domainSnapshots,
      monthlyComparisons(),
      observations,
    );
    setMonthlyReviews((prev) =>
      prev.some((r) => r.id === review.id) ? prev : [review, ...prev],
    );
    try {
      await repoRef.current.appendMonthly(review);
    } catch {
      /* optimistic */
    }
  };

  const value = useMemo<AnalyticsContextValue>(
    () => ({
      loaded,
      domainSnapshots,
      patterns,
      sleepFocusPattern,
      weeklyReviews,
      monthlyReviews,
      weeklySnapshot,
      monthlyComparisons,
      logWeeklyReview,
      logMonthlyReview,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loaded, domainSnapshots, patterns, weeklyReviews, monthlyReviews],
  );

  return <AnalyticsContext.Provider value={value}>{children}</AnalyticsContext.Provider>;
}

export function useAnalytics() {
  const ctx = useContext(AnalyticsContext);
  if (!ctx) throw new Error("useAnalytics must be used within AnalyticsProvider");
  return ctx;
}
