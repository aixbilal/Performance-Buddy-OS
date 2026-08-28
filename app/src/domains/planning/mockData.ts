import type { CapacityConfig, ScheduleBlock } from "./types";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export { DAY_LABELS };

/** Values approximate the approved Conflict & Capacity reference's own example. */
export const SEED_BLOCKS: ScheduleBlock[] = [
  { id: "blk-ds-lecture", title: "DS Lecture", domain: "Academics", day: 0, startMinute: 9 * 60, endMinute: 10 * 60, type: "fixed", locked: true },
  { id: "blk-oop-lab", title: "OOP Lab", domain: "Academics", day: 0, startMinute: 11 * 60 + 30, endMinute: 13 * 60, type: "fixed", locked: true },
  { id: "blk-ds-mastery", title: "DS Mastery", domain: "Academics", day: 5, startMinute: 14 * 60, endMinute: 15 * 60 + 30, type: "flexible", locked: false },
  { id: "blk-pbos-dev", title: "PBOS Development", domain: "Development", day: 5, startMinute: 14 * 60 + 30, endMinute: 16 * 60, type: "flexible", locked: false },
  { id: "blk-german", title: "German Review", domain: "Language", day: 2, startMinute: 19 * 60, endMinute: 19 * 60 + 30, type: "flexible", locked: false },
  { id: "blk-reading", title: "Reading", domain: "Reading & Language", day: 2, startMinute: 20 * 60, endMinute: 20 * 60 + 30, type: "flexible", locked: false },
];

export const SEED_CAPACITY: CapacityConfig = {
  dailyCapacityMinutes: 150, // 2h30 per day, matching the reference's daily load example
  weeklyCapacityMinutes: 14 * 60, // 14h00 flexible weekly capacity, matching the reference exactly
};
