/**
 * Performance Buddy OS — Focus / Study & Mastery domain model.
 *
 * This domain was genuinely missing since the original engineering pass —
 * flagged explicitly in the Day 18 audit, built now.
 *
 * Per Master Handoff §7/§8 and Day 18 §57: Focus is a targeted execution
 * TOOL, not the universal study/timer engine. It may link to an Action or
 * Knowledge Topic, but:
 *   - Completing a Focus session produces execution evidence (duration),
 *     never mastery by itself.
 *   - Mastery still lives in the Knowledge domain's evidence system
 *     (`domains/knowledge`) — Focus does NOT duplicate that engine, it
 *     feeds into it the same way Language sessions do (see
 *     domains/language/engine.ts deriveSessionEffects for the identical
 *     honest pattern: only a real recall/test score produces evidence).
 */

export type FocusSessionStatus = "idle" | "active" | "paused" | "completed";

export type FocusSession = {
  id: string;
  title: string;
  /** Optional link to a canonical Action — never a duplicate task record. */
  linkedActionId: string | null;
  /** Optional link to a canonical Knowledge Topic — mastery still lives there, not here. */
  linkedTopicId: string | null;
  status: FocusSessionStatus;
  targetMinutes: number;
  elapsedSeconds: number;
  startedAt: string | null;
  notes: string;
};

export type FocusTransition = "start" | "pause" | "resume" | "finish";

export type FocusCompletionEffects = {
  durationMinutes: number;
  /** Only set if a real recall/test score was entered — never fabricated from time spent alone. */
  masteryEvidence: { score: number; maxScore: number } | null;
};
