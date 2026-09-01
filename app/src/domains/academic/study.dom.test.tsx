// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, act, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { SettingsProvider } from "../settings/store";
import { AcademicProvider, useAcademic } from "./store";
import { KnowledgeProvider, useKnowledge } from "../knowledge/store";
import { MasteryProvider, useMastery } from "./masteryStore";
import { FocusProvider, useFocus } from "../focus/store";
import { NormalStudyPage } from "./NormalStudyPage";
import { MasteryCheckPage } from "./MasteryCheckPage";
import { FocusPage } from "../focus/FocusPage";

vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => false, invoke: vi.fn() }));

/* eslint-disable react/globals */
let acad: ReturnType<typeof useAcademic>;
let know: ReturnType<typeof useKnowledge>;
let mastery: ReturnType<typeof useMastery>;
let focus: ReturnType<typeof useFocus>;

function Probe() {
  acad = useAcademic();
  know = useKnowledge();
  mastery = useMastery();
  focus = useFocus();
  return <div data-testid="ready">{String(acad.loaded && know.loaded && mastery.loaded)}</div>;
}

function App({ start = "/academics/study" }: { start?: string }) {
  return (
    <SettingsProvider>
      <AcademicProvider>
        <KnowledgeProvider>
          <MasteryProvider>
            <FocusProvider>
              <MemoryRouter initialEntries={[start]}>
                <Probe />
                <Routes>
                  <Route path="/academics/study" element={<NormalStudyPage />} />
                  <Route path="/academics/mastery/:checkId" element={<MasteryCheckPage />} />
                  <Route path="/focus" element={<FocusPage />} />
                </Routes>
              </MemoryRouter>
            </FocusProvider>
          </MasteryProvider>
        </KnowledgeProvider>
      </AcademicProvider>
    </SettingsProvider>
  );
}

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

async function mount(start?: string) {
  render(<App start={start} />);
  await waitFor(() => expect(screen.getByTestId("ready")).toHaveTextContent("true"));
}

const id = (r: unknown) => (r as { id: string }).id;

// Each store call in its own act() so React flushes between them — otherwise a
// dependent call runs against the previous render's stale closure.
async function makeCourse(title = "Data Structures") {
  let courseId = "";
  await act(async () => {
    courseId = id(
      await acad.createCourse({
        code: "CS201",
        title,
        creditHours: 3,
        professorName: "",
        status: "on-track",
        targetGrade: null,
        projectedGrade: null,
        semesterId: null,
      }),
    );
  });
  return courseId;
}
async function makeTopic(courseId: string, title: string, over: Partial<Parameters<typeof acad.createTopic>[1]> = {}) {
  let topicId = "";
  await act(async () => {
    topicId = id(
      await acad.createTopic(courseId, {
        title,
        professorCoverage: "taught",
        personalStudyPercent: 0,
        ...over,
      }),
    );
  });
  return topicId;
}
async function makeKnowledge(title: string) {
  let kId = "";
  await act(async () => {
    kId = id(await know.createTopic({ title, category: "academic", context: "DS", relatedGoalId: null }));
  });
  return kId;
}

/** Data Structures course + Binary Trees topic + linked Binary Trees Knowledge concept. */
async function seedCourseTopicLinked() {
  const courseId = await makeCourse();
  const topicId = await makeTopic(courseId, "Binary Trees");
  const knowledgeId = await makeKnowledge("Binary Trees");
  await act(async () => {
    await acad.linkTopicToKnowledge(topicId, knowledgeId);
  });
  return { courseId, topicId, knowledgeId };
}

describe("Normal Study — honest states + target selection + Study→Focus", () => {
  it("shows an honest empty state when there are no courses", async () => {
    await mount();
    expect(await screen.findByText(/no courses yet/i)).toBeInTheDocument();
  });

  it("lists a topic with explainable reasons and no invented Knowledge state", async () => {
    await mount();
    await seedCourseTopicLinked();
    await waitFor(() => expect(acad.topics).toHaveLength(1));
    // professor covered + not personally studied + no evidence yet
    expect(await screen.findByText(/Professor covered · not personally completed/i)).toBeInTheDocument();
    expect(screen.getByText(/No mastery evidence yet/i)).toBeInTheDocument();
  });

  it("V2 contextual insight: selecting a topic surfaces a deterministic 'why' with a Plan-this action; nothing selected shows no AI surface", async () => {
    const user = userEvent.setup();
    await mount();
    await seedCourseTopicLinked();
    // nothing selected → no contextual insight
    expect(screen.queryByRole("button", { name: /why this/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /plan this/i })).not.toBeInTheDocument();

    await user.click(await screen.findByRole("button", { name: /Study Binary Trees/i }));
    // a compact insight appears headlined "Why Binary Trees…" with subordinate actions
    expect(await screen.findByText(/Why Binary Trees/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /explore in ai coach/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /plan this/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^why this\?$/i }));
    // it is deterministic reason text, not a fabricated number
    expect(screen.queryByText(/\d+% likely|confidence: \d/i)).not.toBeInTheDocument();
  });

  it("'Start Focus' launches a canonical Focus session with academic context; finishing it (no recall) adds NO mastery", async () => {
    const user = userEvent.setup();
    await mount();
    let ids: Awaited<ReturnType<typeof seedCourseTopicLinked>>;
    ids = await seedCourseTopicLinked();
    await user.click(await screen.findByRole("button", { name: /Study Binary Trees/i }));
    await user.click(screen.getByRole("button", { name: /start focus/i }));

    // canonical Focus session, carrying the academic + knowledge context
    await waitFor(() => expect(focus.session.status).toBe("active"));
    expect(focus.session.linkedAcademicTopicId).toBe(ids!.topicId);
    expect(focus.session.linkedTopicId).toBe(ids!.knowledgeId);

    // finish WITHOUT a recall score
    await act(async () => {
      await focus.finish();
    });
    await waitFor(() => expect(focus.history.length).toBe(1));
    expect(focus.history[0].recallScore).toBeNull();
    // Focus time did not create Knowledge evidence
    expect(know.getEvidenceForTopic(ids!.knowledgeId)).toHaveLength(0);
    expect(know.getTopic(ids!.knowledgeId)?.hasEvidence).toBe(false);
  });

  it("'Mark studied' updates Personal Study ONLY — professor coverage and mastery untouched", async () => {
    const user = userEvent.setup();
    await mount();
    let ids: Awaited<ReturnType<typeof seedCourseTopicLinked>>;
    ids = await seedCourseTopicLinked();
    await user.click(await screen.findByRole("button", { name: /Study Binary Trees/i }));
    await user.click(screen.getByRole("button", { name: "75%" }));
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => expect(acad.topics.find((t) => t.id === ids!.topicId)?.personalStudyPercent).toBe(75));
    expect(acad.topics.find((t) => t.id === ids!.topicId)?.professorCoverage).toBe("taught"); // unchanged
    expect(know.getEvidenceForTopic(ids!.knowledgeId)).toHaveLength(0); // mastery untouched
  });

  it("switching study mode changes ordering only — no academic data mutates", async () => {
    const user = userEvent.setup();
    await mount();
    await seedCourseTopicLinked();
    await screen.findByRole("button", { name: /Study Binary Trees/i });
    const before = JSON.stringify(acad.topics);
    await user.click(screen.getByRole("button", { name: "Exam" }));
    await user.click(screen.getByRole("button", { name: "Recovery" }));
    await user.click(screen.getByRole("button", { name: "Normal" }));
    expect(JSON.stringify(acad.topics)).toBe(before);
  });
});

describe("Mastery Check — result + explicit, idempotent Knowledge evidence handoff", () => {
  async function startAndCompleteCheck(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByRole("button", { name: /Study Binary Trees/i }));
    await user.click(screen.getByRole("button", { name: /start mastery check/i }));
    // now on /academics/mastery/:checkId — rate every prompt "Confident"
    const groups = await screen.findAllByRole("radiogroup");
    for (const g of groups) {
      const confident = g.querySelector('input[value="confident"]') as HTMLInputElement;
      await user.click(confident);
    }
    await user.click(screen.getByRole("button", { name: /submit check/i }));
    await screen.findByText(/Mastery Result/i);
  }

  it("completing a check and recording evidence creates exactly ONE Knowledge evidence row; re-recording is a no-op", async () => {
    const user = userEvent.setup();
    await mount();
    let ids: Awaited<ReturnType<typeof seedCourseTopicLinked>>;
    ids = await seedCourseTopicLinked();

    await startAndCompleteCheck(user);
    expect(screen.getByText(/4\/4/)).toBeInTheDocument(); // all-confident self-check

    await user.click(screen.getByRole("button", { name: /record as knowledge evidence/i }));
    await waitFor(() => expect(know.getEvidenceForTopic(ids!.knowledgeId)).toHaveLength(1));
    // Knowledge mastery derives from it
    expect(know.getTopic(ids!.knowledgeId)?.hasEvidence).toBe(true);
    expect(know.getTopic(ids!.knowledgeId)?.masteryPercent).toBe(100);

    // the record button is gone; the check remembers it recorded
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: /record as knowledge evidence/i }),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByText(/Re-recording is blocked — no duplicates/i)).toBeInTheDocument();
    const checkId = mastery.checks[0].id;
    // programmatic re-record must not add a second evidence row
    await act(async () => {
      await mastery.recordEvidence(checkId);
    });
    expect(know.getEvidenceForTopic(ids!.knowledgeId)).toHaveLength(1);

    // the Academic Topic still has no mastery field of its own
    const at = acad.topics.find((t) => t.id === ids!.topicId)!;
    expect("masteryPercent" in at).toBe(false);
    expect(at.masterySelfAssessed).toBeNull();
  });

  it("V2 Generate Recall: a `recall` check from generated prompts creates NO evidence until completed + recorded", async () => {
    await mount();
    const ids = await seedCourseTopicLinked();

    // seed a governed recall check straight from prompts (what GenerateRecall does)
    let checkId = "";
    await act(async () => {
      checkId = await mastery.startCheck({
        academicTopicId: null,
        knowledgeTopicId: ids.knowledgeId,
        courseId: null,
        topicTitle: "Binary Trees",
        kind: "recall",
        recallPrompts: ["Explain AVL rotations.", "When does a red-black tree rebalance?"],
      });
    });
    const check = mastery.getCheck(checkId)!;
    expect(check.kind).toBe("recall");
    expect(check.items.map((i) => i.prompt)).toEqual([
      "Explain AVL rotations.",
      "When does a red-black tree rebalance?",
    ]);
    // prompts alone → no evidence, mastery untouched
    expect(know.getEvidenceForTopic(ids.knowledgeId)).toHaveLength(0);
    expect(know.getTopic(ids.knowledgeId)?.hasEvidence).toBe(false);

    // recording before completion is refused
    await act(async () => {
      const r = await mastery.recordEvidence(checkId);
      expect(r.ok).toBe(false);
    });
    expect(know.getEvidenceForTopic(ids.knowledgeId)).toHaveLength(0);

    // complete + evaluate the check, THEN record — now one evidence row exists
    await act(async () => {
      await mastery.submitCheck(
        checkId,
        check.items.map((i) => ({ ...i, rating: "confident" as const })),
      );
    });
    await act(async () => {
      const r = await mastery.recordEvidence(checkId);
      expect(r.ok).toBe(true);
    });
    expect(know.getEvidenceForTopic(ids.knowledgeId)).toHaveLength(1);
  });

  it("a low result records neutral evidence — no grade change, no coverage change, no shame wording", async () => {
    const user = userEvent.setup();
    await mount();
    let ids: Awaited<ReturnType<typeof seedCourseTopicLinked>>;
    ids = await seedCourseTopicLinked();
    await user.click(await screen.findByRole("button", { name: /Study Binary Trees/i }));
    await user.click(screen.getByRole("button", { name: /start mastery check/i }));
    const groups = await screen.findAllByRole("radiogroup");
    for (const g of groups) {
      await user.click(g.querySelector(`input[value="unsure"]`) as HTMLInputElement);
    }
    await user.click(screen.getByRole("button", { name: /submit check/i }));
    expect(await screen.findByText(/Needs reinforcement — revisit the weak points/i)).toBeInTheDocument();
    expect(screen.queryByText(/\bfail(ed|ure)?\b/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /record as knowledge evidence/i }));
    await waitFor(() => expect(know.getEvidenceForTopic(ids!.knowledgeId)).toHaveLength(1));
    expect(know.getTopic(ids!.knowledgeId)?.masteryPercent).toBe(0); // 0/4
    // course grade + professor coverage untouched
    expect(acad.getCourse(ids!.courseId)?.projectedGrade).toBeNull();
    expect(acad.topics.find((t) => t.id === ids!.topicId)?.professorCoverage).toBe("taught");
  });

  it("no linked Knowledge concept → explicit no-link state, no hidden concept created", async () => {
    const user = userEvent.setup();
    await mount();
    // course + topic but NOT linked to a Knowledge concept
    const courseId = await makeCourse();
    await makeTopic(courseId, "Heaps");
    await user.click(await screen.findByRole("button", { name: /Study Heaps/i }));
    await user.click(screen.getByRole("button", { name: /start mastery check/i }));
    const groups = await screen.findAllByRole("radiogroup");
    for (const g of groups) await user.click(g.querySelector(`input[value="partial"]`) as HTMLInputElement);
    await user.click(screen.getByRole("button", { name: /submit check/i }));

    expect(await screen.findByText(/no linked Knowledge concept/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /record as knowledge evidence/i })).not.toBeInTheDocument();
    expect(know.topics).toHaveLength(0); // nothing invented
  });
});
