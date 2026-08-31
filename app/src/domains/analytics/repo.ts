/**
 * Durable persistence for Analytics reviews (Batch 6).
 *
 * A weekly / monthly review is an IMMUTABLE SNAPSHOT (docs 22.04 / 22.05):
 * `analytics_review_append` is INSERT-OR-IGNORE in Rust; the whole review
 * object is serialised into one `snapshot` blob.
 */
import { invoke, isTauri } from "@tauri-apps/api/core";
import type { MonthlyReview, WeeklyReview } from "./types";

export type ReviewGraph = { weekly: WeeklyReview[]; monthly: MonthlyReview[] };

export interface AnalyticsRepo {
  readonly kind: "sqlite" | "localStorage";
  load(): Promise<ReviewGraph>;
  appendWeekly(r: WeeklyReview): Promise<void>;
  appendMonthly(r: MonthlyReview): Promise<void>;
}

type WireReview = {
  id: string;
  kind: string;
  periodStart: string;
  periodEnd: string;
  snapshot: string;
  notes: string;
  createdAt: string;
};

class SqliteRepo implements AnalyticsRepo {
  readonly kind = "sqlite" as const;
  async load(): Promise<ReviewGraph> {
    const g = await invoke<{ reviews: WireReview[] }>("ai_load");
    const weekly: WeeklyReview[] = [];
    const monthly: MonthlyReview[] = [];
    for (const row of g.reviews ?? []) {
      try {
        const obj = JSON.parse(row.snapshot);
        if (row.kind === "weekly") weekly.push(obj as WeeklyReview);
        else if (row.kind === "monthly") monthly.push(obj as MonthlyReview);
      } catch {
        /* skip a corrupt row rather than fail the load */
      }
    }
    return { weekly, monthly };
  }
  private async append(kind: "weekly" | "monthly", id: string, start: string, end: string, obj: unknown) {
    await invoke("analytics_review_append", {
      review: {
        id,
        kind,
        periodStart: start,
        periodEnd: end,
        snapshot: JSON.stringify(obj),
        notes: "",
        createdAt: new Date().toISOString(),
      },
    });
  }
  async appendWeekly(r: WeeklyReview) {
    await this.append("weekly", r.id, r.weekStart, r.weekEnd, r);
  }
  async appendMonthly(r: MonthlyReview) {
    await this.append("monthly", r.id, r.monthStart, r.monthEnd, r);
  }
}

const K = "pbos:analytics-reviews-v1";

export class LocalRepo implements AnalyticsRepo {
  readonly kind = "localStorage" as const;
  private read(): ReviewGraph {
    try {
      const raw = window.localStorage.getItem(K);
      if (!raw) return { weekly: [], monthly: [] };
      const g = JSON.parse(raw) as ReviewGraph;
      return { weekly: g.weekly ?? [], monthly: g.monthly ?? [] };
    } catch {
      return { weekly: [], monthly: [] };
    }
  }
  private write(g: ReviewGraph) {
    window.localStorage.setItem(K, JSON.stringify(g));
  }
  async load() {
    return this.read();
  }
  async appendWeekly(r: WeeklyReview) {
    const g = this.read();
    if (!g.weekly.some((x) => x.id === r.id)) g.weekly = [r, ...g.weekly];
    this.write(g);
  }
  async appendMonthly(r: MonthlyReview) {
    const g = this.read();
    if (!g.monthly.some((x) => x.id === r.id)) g.monthly = [r, ...g.monthly];
    this.write(g);
  }
}

export function makeAnalyticsRepo(): AnalyticsRepo {
  try {
    if (isTauri()) return new SqliteRepo();
  } catch {
    /* fall through */
  }
  return new LocalRepo();
}
