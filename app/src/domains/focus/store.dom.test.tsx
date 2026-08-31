// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, act, cleanup } from "@testing-library/react";
import { KnowledgeProvider, useKnowledge } from "../knowledge/store";
import { FocusProvider, useFocus } from "./store";

vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => false, invoke: vi.fn() }));

/* eslint-disable react/globals */
let focus: ReturnType<typeof useFocus>;
let know: ReturnType<typeof useKnowledge>;

function Probe() {
  focus = useFocus();
  know = useKnowledge();
  return <div data-testid="ready">{String(focus.historyLoaded && know.loaded)}</div>;
}
function Harness() {
  return (
    <KnowledgeProvider>
      <FocusProvider>
        <Probe />
      </FocusProvider>
    </KnowledgeProvider>
  );
}

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

async function mount() {
  render(<Harness />);
  await waitFor(() => expect(screen.getByTestId("ready")).toHaveTextContent("true"));
}

describe("Focus store — durable history + context, time ≠ mastery", () => {
  it("startWith carries study context; a finished session persists as activity evidence", async () => {
    await mount();
    act(() => {
      focus.startWith({
        title: "Study: Binary Trees",
        method: "university-study",
        targetMinutes: 25,
        linkedAcademicTopicId: "at1",
        linkedCourseId: "c1",
        linkedTopicId: "kt1",
        returnTo: "/academics/study",
      });
    });
    expect(focus.session.status).toBe("active");
    expect(focus.session.linkedAcademicTopicId).toBe("at1");
    expect(focus.session.returnTo).toBe("/academics/study");

    await act(async () => {
      await focus.finish(); // no recall score
    });
    await waitFor(() => expect(focus.history).toHaveLength(1));
    expect(focus.history[0].academicTopicId).toBe("at1");
    expect(focus.history[0].recallScore).toBeNull();
    // written through to the durable layer
    expect(window.localStorage.getItem("pbos:focus-sessions-v2")).toContain("Study: Binary Trees");

    // remount — history reloads
    cleanup();
    await mount();
    await waitFor(() => expect(focus.history.some((r) => r.title === "Study: Binary Trees")).toBe(true));
  });

  it("finishing WITHOUT a recall score never writes Knowledge evidence", async () => {
    await mount();
    await act(async () => {
      know.createTopic({ title: "Binary Trees", category: "academic", context: "DS", relatedGoalId: null });
    });
    const kId = know.topics[0].id;
    act(() => focus.startWith({ title: "T", linkedTopicId: kId }));
    await act(async () => {
      const res = await focus.finish();
      expect(res?.evidenceAdded).toBe(false);
    });
    expect(know.getEvidenceForTopic(kId)).toHaveLength(0);
  });

  it("finishing WITH a recall score and a linked Knowledge topic writes exactly one recall evidence", async () => {
    await mount();
    await act(async () => {
      know.createTopic({ title: "Binary Trees", category: "academic", context: "DS", relatedGoalId: null });
    });
    const kId = know.topics[0].id;
    act(() => focus.startWith({ title: "T", linkedTopicId: kId }));
    await act(async () => {
      const res = await focus.finish({ score: 8, maxScore: 10 });
      expect(res?.evidenceAdded).toBe(true);
    });
    await waitFor(() => expect(know.getEvidenceForTopic(kId)).toHaveLength(1));
    expect(know.getEvidenceForTopic(kId)[0].type).toBe("recall");
    expect(focus.history[0].recallScore).toBe(8);
  });
});
