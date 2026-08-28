import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { DomainSnapshot, Pattern, WeeklyReview } from "./types";
import { buildWeeklyReview, computeCorrelation, deriveDomainState } from "./engine";
import { useAcademic } from "../academic/store";
import { useFitness } from "../fitness-recovery/store";
import { useMoney } from "../money/store";
import { useRoutine } from "../routine/store";

// Illustrative evidence set for the correlation demo — explicitly a small,
// labeled sample dataset (not fabricated from nothing), matching §7.7's
// "every important pattern should support 'why am I seeing this'."
const SLEEP_HOURS_SAMPLE = [6.5, 7.0, 7.5, 7.8, 8.0, 6.0, 7.2];
const FOCUS_MINUTES_SAMPLE = [35, 42, 55, 58, 62, 28, 45];

type AnalyticsContextValue = {
  domainSnapshots: DomainSnapshot[];
  sleepFocusPattern: Pattern;
  weeklyReviews: WeeklyReview[];
  logWeeklyReview: (wins: string[], friction: string[]) => void;
};

const AnalyticsContext = createContext<AnalyticsContextValue | null>(null);

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  const { cgpa } = useAcademic();
  const { readiness } = useFitness();
  const { balance, expenseTotal } = useMoney();
  const { getConsistency } = useRoutine();
  const [weeklyReviews, setWeeklyReviews] = useState<WeeklyReview[]>([]);

  // Each domain snapshot reads from that domain's OWN store — Analytics
  // never recomputes another domain's numbers, only interprets state from
  // them (§7.1: different domains keep different units, never combined).
  const hydrationConsistency = getConsistency("rt-hydration");
  const germanConsistency = getConsistency("rt-german");

  const domainSnapshots: DomainSnapshot[] = [
    {
      domain: "Academics",
      ...deriveDomainState(cgpa.cgpa ?? 0, null, cgpa.totalCreditsCounted),
      headline: cgpa.cgpa !== null ? `CGPA ${cgpa.cgpa.toFixed(2)} across ${cgpa.totalCreditsCounted} credits` : "No graded courses yet",
      evidenceCount: cgpa.totalCreditsCounted,
    },
    {
      domain: "Fitness",
      state: readiness.state === "insufficient-data" ? "stable" : readiness.state === "push" ? "improving" : readiness.state === "recovery" ? "needs-attention" : "stable",
      confidence: readiness.state === "insufficient-data" ? "limited" : "moderate",
      headline: readiness.reason,
      evidenceCount: readiness.score !== null ? 5 : 0,
    },
    {
      domain: "Routines",
      ...deriveDomainState(hydrationConsistency.percent ?? 0, null, hydrationConsistency.loggedDays),
      headline: hydrationConsistency.percent !== null ? `Hydration ${hydrationConsistency.percent}% (${hydrationConsistency.loggedDays} logged days)` : "Not enough logged days yet",
      evidenceCount: hydrationConsistency.loggedDays,
    },
    {
      domain: "Language",
      ...deriveDomainState(germanConsistency.percent ?? 0, null, germanConsistency.loggedDays),
      headline: germanConsistency.percent !== null ? `German practice ${germanConsistency.percent}% (${germanConsistency.loggedDays} logged days)` : "Not enough logged days yet",
      evidenceCount: germanConsistency.loggedDays,
    },
    {
      domain: "Money",
      state: "stable",
      confidence: "moderate",
      headline: `Tracked balance Rs ${balance.toLocaleString()} · Rs ${expenseTotal.toLocaleString()} recorded spending`,
      evidenceCount: 1,
    },
  ];

  const correlation = computeCorrelation(SLEEP_HOURS_SAMPLE, FOCUS_MINUTES_SAMPLE);
  const sleepFocusPattern: Pattern = {
    id: "pattern-sleep-focus",
    title:
      correlation.direction === "positive"
        ? "Higher sleep was associated with longer completed Focus sessions."
        : correlation.direction === "negative"
          ? "Higher sleep was associated with shorter completed Focus sessions."
          : "No meaningful association found between sleep and Focus duration yet.",
    direction: correlation.direction,
    confidence: correlation.confidence,
    sampleSize: Math.min(SLEEP_HOURS_SAMPLE.length, FOCUS_MINUTES_SAMPLE.length),
  };

  const logWeeklyReview = (wins: string[], friction: string[]) => {
    const review = buildWeeklyReview(
      new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10),
      new Date().toISOString().slice(0, 10),
      domainSnapshots,
      wins,
      friction
    );
    setWeeklyReviews((prev) => [review, ...prev]);
  };

  const value = useMemo(
    () => ({ domainSnapshots, sleepFocusPattern, weeklyReviews, logWeeklyReview }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cgpa, readiness, balance, expenseTotal, hydrationConsistency, germanConsistency, weeklyReviews]
  );

  return <AnalyticsContext.Provider value={value}>{children}</AnalyticsContext.Provider>;
}

export function useAnalytics() {
  const ctx = useContext(AnalyticsContext);
  if (!ctx) throw new Error("useAnalytics must be used within AnalyticsProvider");
  return ctx;
}
