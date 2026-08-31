import type { CapacityConfig, PlanningBlock } from "./types";

/** Weekday labels for the Calendar grid — a UI constant, not seed data. */
export const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const DAY_LABELS_LONG = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

/** minutes-from-midnight -> "H:MM". */
export function timeLabel(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}:${m.toString().padStart(2, "0")}`;
}

/** "yyyy-mm-dd" -> "Mon 25 Aug" (civil, no timezone shift). */
export function shortDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return `${DAY_LABELS[(dt.getDay() + 6) % 7]} ${d} ${MONTHS[m - 1]}`;
}
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * TEST FIXTURES ONLY — never imported by runtime code. A fresh profile has no
 * scheduled blocks (see `store.tsx` / the Batch 3 seed-removal rule). These
 * approximate the approved Conflict & Capacity reference's own example and are
 * consumed only by `*.test.*`.
 */
const TS = "2026-01-01T00:00:00.000Z";
const b = (o: Partial<PlanningBlock> & Pick<PlanningBlock, "id" | "title" | "day" | "startMinute" | "endMinute">): PlanningBlock => ({
  domain: "Academics",
  actionId: null,
  date: null,
  type: "flexible",
  locked: false,
  source: "manual",
  status: "scheduled",
  createdAt: TS,
  updatedAt: TS,
  ...o,
});

export const FIXTURE_BLOCKS: PlanningBlock[] = [
  b({ id: "blk-ds-lecture", title: "DS Lecture", day: 0, startMinute: 9 * 60, endMinute: 10 * 60, type: "fixed", locked: true }),
  b({ id: "blk-oop-lab", title: "OOP Lab", day: 0, startMinute: 11 * 60 + 30, endMinute: 13 * 60, type: "fixed", locked: true }),
  b({ id: "blk-ds-mastery", title: "DS Mastery", day: 5, startMinute: 14 * 60, endMinute: 15 * 60 + 30, actionId: "act-1" }),
  b({ id: "blk-pbos-dev", title: "PBOS Development", domain: "Development", day: 5, startMinute: 14 * 60 + 30, endMinute: 16 * 60 }),
];

export const FIXTURE_CAPACITY: CapacityConfig = {
  dailyCapacityMinutes: 150,
  weeklyCapacityMinutes: 14 * 60,
};
