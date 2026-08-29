import { describe, it, expect } from "vitest";
import { transitionFocusSession, deriveFocusCompletionEffects } from "./engine";
import type { FocusSession } from "./types";

function session(overrides: Partial<FocusSession>): FocusSession {
  return {
    id: "f1",
    title: "Binary Trees Review",
    linkedActionId: null,
    linkedTopicId: null,
    status: "idle",
    targetMinutes: 20,
    elapsedSeconds: 0,
    startedAt: null,
    notes: "",
    ...overrides,
  };
}

describe("transitionFocusSession — valid lifecycle", () => {
  it("starts an idle session", () => {
    const result = transitionFocusSession(session({}), "start", "2026-08-29T10:00:00Z");
    expect(result.error).toBeNull();
    expect(result.session.status).toBe("active");
    expect(result.session.startedAt).toBe("2026-08-29T10:00:00Z");
  });

  it("pauses an active session", () => {
    const result = transitionFocusSession(session({ status: "active" }), "pause", "2026-08-29T10:10:00Z");
    expect(result.error).toBeNull();
    expect(result.session.status).toBe("paused");
  });

  it("resumes a paused session", () => {
    const result = transitionFocusSession(session({ status: "paused" }), "resume", "2026-08-29T10:15:00Z");
    expect(result.error).toBeNull();
    expect(result.session.status).toBe("active");
  });

  it("finishes from active", () => {
    const result = transitionFocusSession(session({ status: "active" }), "finish", "2026-08-29T10:20:00Z");
    expect(result.session.status).toBe("completed");
  });

  it("finishes from paused too", () => {
    const result = transitionFocusSession(session({ status: "paused" }), "finish", "2026-08-29T10:20:00Z");
    expect(result.session.status).toBe("completed");
  });
});

describe("transitionFocusSession — rejects invalid transitions instead of silently accepting them", () => {
  it("cannot pause an idle session", () => {
    const result = transitionFocusSession(session({ status: "idle" }), "pause", "2026-08-29T10:00:00Z");
    expect(result.error).not.toBeNull();
    expect(result.session.status).toBe("idle"); // unchanged
  });

  it("cannot start an already-completed session", () => {
    const result = transitionFocusSession(session({ status: "completed" }), "start", "2026-08-29T10:00:00Z");
    expect(result.error).not.toBeNull();
    expect(result.session.status).toBe("completed");
  });

  it("cannot resume an active session (it's already running)", () => {
    const result = transitionFocusSession(session({ status: "active" }), "resume", "2026-08-29T10:00:00Z");
    expect(result.error).not.toBeNull();
  });
});

describe("deriveFocusCompletionEffects — time spent ≠ mastery (core Day 18 rule)", () => {
  it("produces duration but NO mastery evidence when no recall score is given", () => {
    const effects = deriveFocusCompletionEffects(1200); // 20 minutes
    expect(effects.durationMinutes).toBe(20);
    expect(effects.masteryEvidence).toBeNull();
  });

  it("includes mastery evidence only when a real recall score is provided", () => {
    const effects = deriveFocusCompletionEffects(1200, { score: 7, maxScore: 10 });
    expect(effects.masteryEvidence).toEqual({ score: 7, maxScore: 10 });
  });
});
