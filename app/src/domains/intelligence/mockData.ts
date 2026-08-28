import type { DomainPermissions, Recommendation } from "./types";

/** Default permissions match the approved reference exactly — Money defaults to No Access (sensitive). */
export const DEFAULT_PERMISSIONS: DomainPermissions = {
  Today: "read-recommend",
  Academics: "read-recommend",
  "Goals & Systems": "read-recommend",
  Knowledge: "read-recommend",
  Development: "read-recommend",
  "Fitness & Recovery": "read-recommend",
  Routines: "read-recommend",
  "Reading & Language": "read-recommend",
  Money: "no-access",
};

export const SEED_RECOMMENDATIONS: Recommendation[] = [
  {
    id: "rec-1",
    title: "Add Data Structures Mastery Session",
    domain: "Academics",
    impact: "high",
    status: "pending",
    confidence: "high",
    evidence: ["DS received less study allocation than planned during 5 of the last 8 weeks"],
    generatedFrom: "Weekly Review (Aug 27)",
    impactMinutes: 90,
    decidedAt: null,
  },
  {
    id: "rec-2",
    title: "Reduce Evening Review Duration",
    domain: "Routines",
    impact: "medium",
    status: "pending",
    confidence: "moderate",
    evidence: ["Evening Review completion has been low", "30-day consistency: 57%"],
    generatedFrom: "Analytics · Patterns & Insights",
    impactMinutes: -10,
    decidedAt: null,
  },
  {
    id: "rec-3",
    title: "Categorize Transactions Automatically",
    domain: "Money", // deliberately included — demonstrates permission filtering, matches the approved reference
    impact: "low",
    status: "pending",
    confidence: "high",
    evidence: ["18 uncategorized transactions detected"],
    generatedFrom: "Money System",
    impactMinutes: 0,
    decidedAt: null,
  },
];

export const CURRENT_WEEKLY_LOAD_MINUTES = 1260; // 21h00m
export const WEEKLY_CAPACITY_MINUTES = 1260; // 21h00m — matches the approved reference
