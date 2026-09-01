// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, act, cleanup } from "@testing-library/react";
import { PerformanceProvider, usePerformance } from "../performance/store";
import { AcademicProvider } from "../academic/store";
import { KnowledgeProvider, useKnowledge } from "../knowledge/store";
import { FitnessProvider } from "../fitness-recovery/store";
import { RoutineProvider } from "../routine/store";
import { MoneyProvider, useMoney } from "../money/store";
import { LanguageProvider } from "../language/store";
import { PlanningProvider, usePlanning } from "../planning/store";
import { AnalyticsProvider } from "../analytics/store";
import { RevisionProvider, useRevision } from "../revision/store";
import { __resetRevisionRecorderForTest } from "../revision/recorder";
import { AICoachProvider, useAICoach } from "./store";

vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => false, invoke: vi.fn() }));

/* eslint-disable react/globals */
let coach: ReturnType<typeof useAICoach>;
let perf: ReturnType<typeof usePerformance>;
let know: ReturnType<typeof useKnowledge>;
let plan: ReturnType<typeof usePlanning>;
let money: ReturnType<typeof useMoney>;
let rev: ReturnType<typeof useRevision>;

function Probe() {
  coach = useAICoach();
  perf = usePerformance();
  know = useKnowledge();
  plan = usePlanning();
  money = useMoney();
  rev = useRevision();
  return (
    <div data-testid="ready">
      {String(coach.loaded && perf.loaded && know.loaded && plan.loaded)}
    </div>
  );
}
function Harness() {
  return (
    <RevisionProvider>
    <PerformanceProvider>
      <AcademicProvider>
        <KnowledgeProvider>
          <FitnessProvider>
            <RoutineProvider>
              <LanguageProvider>
              <MoneyProvider>
                <PlanningProvider>
                  <AnalyticsProvider>
                    <AICoachProvider>
                      <Probe />
                    </AICoachProvider>
                  </AnalyticsProvider>
                </PlanningProvider>
              </MoneyProvider>
              </LanguageProvider>
            </RoutineProvider>
          </FitnessProvider>
        </KnowledgeProvider>
      </AcademicProvider>
    </PerformanceProvider>
    </RevisionProvider>
  );
}

beforeEach(() => {
  window.localStorage.clear();
  __resetRevisionRecorderForTest();
});
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

async function mount() {
  render(<Harness />);
  await waitFor(() => expect(screen.getByTestId("ready")).toHaveTextContent("true"));
}

async function seed() {
  await act(async () => {
    await perf.createSystem({ title: "Deep Work", description: "", domain: "academic", cadence: "", tags: [] });
  });
  await act(async () => {
    know.createTopic({ title: "Binary Trees", category: "academic", context: "DS", relatedGoalId: null });
  });
  // make it review-due so the fake proposes a set-knowledge-review
  await act(async () => {
    const id = know.topics[0].id;
    await know.updateReviewState(id, { lastStudied: null, nextReviewDate: "2020-01-01" });
  });
}

describe("AI decision loop — generate → decide → validate → canonical Apply", () => {
  it("Accept + Apply a schedule-block makes a real Planning block; history is append-only and persists", async () => {
    await mount();
    await seed();
    expect(plan.blocks).toHaveLength(0);

    let gen!: Awaited<ReturnType<typeof coach.generate>>;
    await act(async () => {
      gen = await coach.generate("weekly-review", ["Knowledge", "Planning", "Today"]);
    });
    expect(gen.ok).toBe(true);
    const block = coach.recommendations.find((r) => r.kind === "schedule-block")!;
    expect(block).toBeTruthy();
    expect(block.status).toBe("proposed");

    await act(async () => {
      await coach.decide(block.id, "accepted");
    });
    let applyRes!: Awaited<ReturnType<typeof coach.apply>>;
    await act(async () => {
      applyRes = await coach.apply(block.id);
    });
    expect(applyRes.ok).toBe(true);
    expect(applyRes.triggersReplan).toBe(true);
    await waitFor(() => expect(plan.blocks).toHaveLength(1)); // ONE canonical mutation
    expect(plan.blocks[0].source).toBe("generated");

    const applied = coach.recommendations.find((r) => r.id === block.id)!;
    expect(applied.status).toBe("applied");
    expect(coach.eventsFor(block.id).map((e) => e.event)).toEqual(["proposed", "accepted", "applied"]);

    // persistence — remount, LocalRepo reload
    cleanup();
    await mount();
    await waitFor(() =>
      expect(coach.recommendations.find((r) => r.id === block.id)?.status).toBe("applied"),
    );
    expect(coach.eventsFor(block.id).length).toBe(3);
  });

  it("an AI-applied canonical mutation also appends a general revision event with source 'ai-applied' — and the AI decision trail stays separate", async () => {
    await mount();
    await seed();

    let gen!: Awaited<ReturnType<typeof coach.generate>>;
    await act(async () => {
      gen = await coach.generate("weekly-review", ["Knowledge", "Planning", "Today"]);
    });
    expect(gen.ok).toBe(true);
    const block = coach.recommendations.find((r) => r.kind === "schedule-block")!;
    await act(async () => {
      await coach.decide(block.id, "accepted");
    });
    await act(async () => {
      await coach.apply(block.id);
    });

    // The general cross-domain revision log has ONE ai-applied entry for this.
    await waitFor(() => {
      const aiApplied = rev.events.filter((e) => e.source === "ai-applied");
      expect(aiApplied).toHaveLength(1);
      expect(aiApplied[0].domain).toBe("planning");
      expect(aiApplied[0].operation).toBe("apply");
      expect(JSON.stringify(aiApplied[0].metadata)).toContain(block.id);
    });

    // The AI's own decision trail (ai_decision_events) is untouched by this —
    // the two records are NOT merged.
    expect(coach.eventsFor(block.id).map((e) => e.event)).toEqual(["proposed", "accepted", "applied"]);
    // ...and no ai-applied row leaked into the AI decision trail.
    expect(coach.eventsFor(block.id).some((e) => (e.event as string) === "apply")).toBe(false);
  });

  it("Reject causes zero canonical mutation; the recommendation stays in history as rejected", async () => {
    await mount();
    await seed();
    await act(async () => {
      await coach.generate("weekly-review", ["Knowledge", "Planning", "Today"]);
    });
    const rec = coach.recommendations.find((r) => r.kind === "set-knowledge-review")!;
    const topicBefore = know.topics[0].nextReviewDate;

    await act(async () => {
      await coach.decide(rec.id, "rejected");
    });
    expect(coach.recommendations.find((r) => r.id === rec.id)?.status).toBe("rejected");
    expect(know.topics[0].nextReviewDate).toBe(topicBefore); // untouched
    expect(coach.decisionHistory.some((r) => r.id === rec.id)).toBe(true);
  });

  it("Modify changes the applied value — validation + apply use the edited param, not the AI's", async () => {
    await mount();
    await seed();
    await act(async () => {
      await coach.generate("weekly-review", ["Knowledge", "Planning", "Today"]);
    });
    const rec = coach.recommendations.find((r) => r.kind === "set-knowledge-review")!;
    expect(rec.proposedParams.inDays).toBe(3);

    await act(async () => {
      await coach.decide(rec.id, "modified", { inDays: 30 });
    });
    await act(async () => {
      await coach.apply(rec.id);
    });
    const applied = coach.recommendations.find((r) => r.id === rec.id)!;
    expect(applied.status).toBe("applied");
    // 30 days out (UTC civil-date math), not 3
    const t = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
    t.setUTCDate(t.getUTCDate() + 30);
    expect(know.topics[0].nextReviewDate).toBe(t.toISOString().slice(0, 10));
    expect(applied.appliedResult).toMatchObject({ topicId: know.topics[0].id });
  });

  it("Invalid Apply is blocked deterministically — no mutation, status apply-failed with a reason code", async () => {
    await mount();
    await seed();
    await act(async () => {
      await coach.generate("weekly-review", ["Knowledge", "Planning", "Today"]);
    });
    const block = coach.recommendations.find((r) => r.kind === "schedule-block")!;
    await act(async () => {
      // an impossible duration overflows the day
      await coach.decide(block.id, "modified", { durationMinutes: 5000 });
    });
    let res!: Awaited<ReturnType<typeof coach.apply>>;
    await act(async () => {
      res = await coach.apply(block.id);
    });
    expect(res.ok).toBe(false);
    expect(res.status).toBe("apply-failed");
    expect(plan.blocks).toHaveLength(0);
    const failed = coach.recommendations.find((r) => r.id === block.id)!;
    expect(failed.validation?.ok).toBe(false);
    expect(failed.validation?.reasonCodes).toContain("INVALID_TIME");
    expect(coach.eventsFor(block.id).map((e) => e.event)).toContain("apply-failed");
  });

  it("Money is No access by default — it is never in the included context, always in excluded", async () => {
    await mount();
    await seed();
    void money;
    const preview = coach.contextPreview(["Money", "Knowledge", "Planning"]);
    expect(preview.excluded).toContain("Money");
    expect(coach.permissions.Money).toBe("no-access");
    // a proposal targeting Money is rejected even if a provider returned one
    let gen!: Awaited<ReturnType<typeof coach.generate>>;
    await act(async () => {
      gen = await coach.generate("workspace", ["Money"]);
    });
    expect(gen.ok).toBe(true);
    expect(coach.recommendations.some((r) => r.domain === "Money")).toBe(false);
  });

  it("Disabling AI: generate fails honestly, deterministic surfaces keep working", async () => {
    await mount();
    await seed();
    await act(async () => {
      coach.setEnabled(false);
    });
    await waitFor(() => expect(coach.aiAvailability).toBe("disabled"));
    let res!: Awaited<ReturnType<typeof coach.generate>>;
    await act(async () => {
      res = await coach.generate("weekly-review", ["Knowledge", "Planning"]);
    });
    expect(res.ok).toBe(false);
    expect(res.failure).toBe("disabled");
    // permissions + context preview are pure logic, still available
    expect(coach.contextPreview(["Knowledge"]).excluded.length).toBeGreaterThan(0);
  });
});
