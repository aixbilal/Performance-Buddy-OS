/**
 * Performance Buddy OS — Focus / Study & Mastery domain model.
 *
 * Per Master Handoff §7/§8, Day 18 §57 and docs 14.09 / 09.07: Focus is a
 * targeted execution TOOL, not the universal study/timer engine.
 *   - Completing a Focus session produces ACTIVITY evidence (duration + method),
 *     never mastery by itself. "A completed timer cannot mark a topic mastered."
 *   - A genuine recall/test score entered at finish is the ONLY thing that
 *     produces Knowledge evidence — same honest boundary as Language sessions.
 *   - A session may carry OPTIONAL context links (course / academic topic /
 *     knowledge topic / action / planning block). They are references, never a
 *     copy of the linked entity.
 */

export type FocusSessionStatus = "idle" | "active" | "paused" | "completed";

/** Optional links a session carries so study context survives the round-trip. */
export type FocusContext = {
  title?: string;
  method?: string;
  targetMinutes?: number;
  linkedActionId?: string | null;
  linkedTopicId?: string | null;
  linkedCourseId?: string | null;
  linkedAcademicTopicId?: string | null;
  linkedBlockId?: string | null;
  /** Where "Back to study" should return, if launched from a study surface. */
  returnTo?: string | null;
};

export type FocusSession = {
  id: string;
  title: string;
  method: string;
  /** Optional link to a canonical Action — never a duplicate task record. */
  linkedActionId: string | null;
  /** Optional link to a canonical Knowledge Topic — mastery still lives there, not here. */
  linkedTopicId: string | null;
  /** Optional links back into Academic OS — references only. */
  linkedCourseId: string | null;
  linkedAcademicTopicId: string | null;
  /** Optional link to the canonical Planning Block this session executes. */
  linkedBlockId: string | null;
  returnTo: string | null;
  status: FocusSessionStatus;
  targetMinutes: number;
  elapsedSeconds: number;
  startedAt: string | null;
  notes: string;
};

/** A completed, PERSISTED session — the on-page/study history record. */
export type FocusSessionRecord = {
  id: string;
  title: string;
  status: "completed";
  method: string;
  courseId: string | null;
  academicTopicId: string | null;
  knowledgeTopicId: string | null;
  actionId: string | null;
  planningBlockId: string | null;
  targetMinutes: number;
  durationMinutes: number;
  /** Only set when a real recall check was done at finish — never from time alone. */
  recallScore: number | null;
  recallMax: number;
  notes: string;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FocusTransition = "start" | "pause" | "resume" | "finish";

export type FocusCompletionEffects = {
  durationMinutes: number;
  /** Only set if a real recall/test score was entered — never fabricated from time spent alone. */
  masteryEvidence: { score: number; maxScore: number } | null;
};
