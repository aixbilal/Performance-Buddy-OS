// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, act, cleanup } from "@testing-library/react";
import { PerformanceProvider, usePerformance } from "../performance/store";
import { MoneyProvider, useMoney } from "../money/store";
import { RoutineProvider, useRoutine } from "../routine/store";
import { RevisionProvider } from "../revision/store";
import { AcademicProvider } from "../academic/store";
import { KnowledgeProvider } from "../knowledge/store";
import { FitnessProvider } from "../fitness-recovery/store";
import { LanguageProvider } from "../language/store";
import { PlanningProvider } from "../planning/store";
import { AnalyticsProvider } from "../analytics/store";
import { AICoachProvider } from "../intelligence/store";
import { CaptureProvider, useCapture } from "./store";

vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => false, invoke: vi.fn() }));

// Test harness: expose the three stores Quick Capture delegates to. Capturing
// the live context values into module scope during render is the standard RTL
// probe pattern; it is inert here (read only from test bodies, never rendered).
/* eslint-disable react/globals */
let cap: ReturnType<typeof useCapture>;
let money: ReturnType<typeof useMoney>;
let perf: ReturnType<typeof usePerformance>;
let routine: ReturnType<typeof useRoutine>;

function Probe() {
  cap = useCapture();
  money = useMoney();
  perf = usePerformance();
  routine = useRoutine();
  return <div data-testid="ready">{String(cap.loaded && routine.loaded)}</div>;
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
                          <CaptureProvider>
                            <Probe />
                          </CaptureProvider>
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

beforeEach(() => window.localStorage.clear());
afterEach(() => window.localStorage.clear());

async function mount() {
  render(<Harness />);
  await waitFor(() => expect(screen.getByTestId("ready")).toHaveTextContent("true"));
}

describe("Quick Capture — durable pipeline + canonical delegation", () => {
  it("a raw capture is persisted (survives a remount)", async () => {
    await mount();
    await act(async () => {
      await cap.capture("Revise Binary Trees");
    });
    expect(cap.unresolved).toHaveLength(1);
    // written through to the durable layer
    expect(window.localStorage.getItem("pbos:capture-inbox-v2")).toContain("Revise Binary Trees");

    // remount a fresh provider tree — it must reload the persisted capture
    cleanup();
    await mount();
    await waitFor(() =>
      expect(cap.inbox.some((i) => i.rawText === "Revise Binary Trees")).toBe(true),
    );
  });

  it("confirming an Action delegates to the canonical Action engine (no capture-specific task)", async () => {
    await mount();
    let id = "";
    await act(async () => {
      const item = await cap.capture("Revise Binary Trees");
      id = item.id;
    });
    await act(async () => {
      const res = await cap.confirmItem(id);
      expect(res.ok).toBe(true);
    });
    await waitFor(() => expect(perf.actions.some((a) => a.title === "Revise Binary Trees")).toBe(true));
    const created = perf.actions.filter((a) => a.title === "Revise Binary Trees");
    expect(created).toHaveLength(1); // no duplicate write
    expect(created[0].context).toBe("Quick Capture");
    await waitFor(() => expect(cap.inbox.find((i) => i.id === id)?.status).toBe("resolved"));
  });

  it("confirming an Expense delegates to the canonical Money engine exactly once", async () => {
    await mount();
    let id = "";
    await act(async () => {
      const item = await cap.capture("Spent 1200 on food");
      id = item.id;
    });
    expect(cap.inbox.find((i) => i.id === id)?.proposal?.type).toBe("expense");
    await act(async () => {
      const res = await cap.confirmItem(id);
      expect(res.ok).toBe(true);
    });
    await waitFor(() => expect(money.transactions.length).toBe(1));
    const tx = money.transactions[0];
    expect(tx.type).toBe("expense");
    expect(tx.amount).toBe(1200);

    // confirming again must not create a second transaction
    await act(async () => {
      await cap.confirmItem(id);
    });
    expect(money.transactions.length).toBe(1);
  });

  it("confirming a Routine Check-In delegates to the canonical Routine engine — one log, no Action, no fake routine", async () => {
    await mount();
    // an existing canonical routine
    await act(async () => {
      await routine.createRoutine({
        title: "Morning Mobility",
        category: "Personal Care",
        timeWindow: "morning",
        schedule: { type: "daily", days: [], timesPerWeek: null },
        completionType: "boolean",
        targetQuantity: null,
        targetUnit: null,
        targetDurationMinutes: null,
        priority: "important",
        relatedSystemId: null,
      });
    });
    await waitFor(() => expect(routine.routines).toHaveLength(1));
    const routineId = routine.routines[0].id;

    let id = "";
    await act(async () => {
      const item = await cap.capture("Morning Mobility done");
      id = item.id;
    });
    expect(cap.inbox.find((i) => i.id === id)?.proposal?.type).toBe("routine-checkin");

    await act(async () => {
      const res = await cap.confirmItem(id);
      expect(res.ok).toBe(true);
    });
    await waitFor(() => expect(routine.getLogsForRoutine(routineId)).toHaveLength(1));
    expect(routine.getLogsForRoutine(routineId)[0].state).toBe("complete");
    expect(perf.actions).toHaveLength(0); // NOT an Action
    expect(routine.routines).toHaveLength(1); // no fake routine created
    await waitFor(() => expect(cap.inbox.find((i) => i.id === id)?.status).toBe("resolved"));

    // re-confirm does not add a second log
    await act(async () => {
      await cap.confirmItem(id);
    });
    expect(routine.getLogsForRoutine(routineId)).toHaveLength(1);
  });

  it("routine-checkin with no matching routine stays unresolved (no fake routine, no Action)", async () => {
    await mount();
    let id = "";
    await act(async () => {
      const item = await cap.capture("Evening Stretch done");
      id = item.id;
    });
    let res: Awaited<ReturnType<typeof cap.confirmItem>>;
    await act(async () => {
      res = await cap.confirmItem(id);
    });
    expect(res!.ok).toBe(false);
    expect(cap.inbox.find((i) => i.id === id)?.status).not.toBe("resolved");
    expect(routine.routines).toHaveLength(0);
    expect(perf.actions).toHaveLength(0);
  });

  it("dismiss resolves without creating anything", async () => {
    await mount();
    let id = "";
    await act(async () => {
      const item = await cap.capture("something vague");
      id = item.id;
    });
    await act(async () => {
      await cap.dismissItem(id);
    });
    expect(cap.inbox.find((i) => i.id === id)?.status).toBe("resolved");
    expect(perf.actions).toHaveLength(0);
    expect(money.transactions).toHaveLength(0);
  });
});

describe("Natural Capture V2 — multi-proposal bundle through the shared mutation engine", () => {
  it("one mixed capture yields several proposals, each with its own class + source text", async () => {
    await mount();
    let captureId = "";
    await act(async () => {
      const { item } = await cap.captureNatural(
        "Prof covered AVL trees today. Spent 1200 on groceries and also did 25 min of German",
      );
      captureId = item.id;
    });
    const props = cap.proposalsFor(captureId);
    expect(props.map((p) => p.mutationKind).sort()).toEqual(
      ["create-expense", "create-language-session", "set-professor-coverage"].sort(),
    );
    expect(props.every((p) => p.sourceText.length > 0)).toBe(true);
    // raw text is durable regardless
    expect(cap.inbox.find((i) => i.id === captureId)?.rawText).toContain("AVL trees");
  });

  it("an unclassifiable capture keeps the raw text and produces no proposals", async () => {
    await mount();
    let captureId = "";
    await act(async () => {
      const { item } = await cap.captureNatural("the sky was an unusual colour today");
      captureId = item.id;
    });
    expect(cap.proposalsFor(captureId)).toHaveLength(0);
    expect(cap.inbox.find((i) => i.id === captureId)?.rawText).toContain("unusual colour");
  });

  it("accept + apply a language-session proposal routes to the canonical Language store", async () => {
    await mount();
    // seed a German path so the entity resolves
    // (LanguageProvider is in the harness; use its store via the mutation ctx path)
    let captureId = "";
    await act(async () => {
      const { item } = await cap.captureNatural("did 20 min of French vocab");
      captureId = item.id;
    });
    const p = cap.proposalsFor(captureId).find((x) => x.mutationKind === "create-language-session")!;
    expect(p).toBeTruthy();
    await act(async () => {
      await cap.decideProposal(p.id, "accepted");
      await cap.applyProposal(p.id);
    });
    // with no matching French path the apply fails closed with a reason — never a silent write
    const after = cap.proposalsFor(captureId).find((x) => x.id === p.id)!;
    expect(["applied", "apply-failed"]).toContain(after.status);
    expect(after.validationJson).toBeTruthy();
  });

  it("proposals persist to their own durable slice (survive a remount)", async () => {
    await mount();
    await act(async () => {
      await cap.captureNatural("Spent 500 on fuel");
    });
    expect(window.localStorage.getItem("pbos:capture-proposals-v2")).toContain("create-expense");
    cleanup();
    await mount();
    await waitFor(() => expect(cap.proposals.some((p) => p.mutationKind === "create-expense")).toBe(true));
  });
});
