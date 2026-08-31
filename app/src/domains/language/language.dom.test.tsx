// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { KnowledgeProvider } from "../knowledge/store";
import { ObsidianProvider } from "../obsidian/store";
import { RoutineProvider } from "../routine/store";
import { LanguageProvider } from "./store";
import { ReadingLanguageOverviewPage } from "./ReadingLanguageOverviewPage";
import { PathBuilderPage, BookBuilderPage } from "./LanguageBuilderPages";
import { LanguagePathDetailPage } from "./LanguagePathDetailPage";
import { LearningSessionPage } from "./LearningSessionPage";
import { BookDetailPage } from "./BookDetailPage";

vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => false, invoke: vi.fn() }));

const TS = "2026-01-01T00:00:00.000Z";

function seedKnowledgeTopic() {
  window.localStorage.setItem(
    "pbos:knowledge-v2",
    JSON.stringify({
      topics: [
        {
          id: "kt-de",
          title: "German Vocabulary",
          category: "language",
          context: "",
          lastStudied: null,
          nextReviewDate: null,
          relatedGoalId: null,
          createdAt: TS,
          updatedAt: TS,
        },
      ],
      sources: [],
      evidence: [],
    }),
  );
  window.localStorage.setItem("pbos:knowledge-v2-imported", "1");
}

function seedRoutine() {
  window.localStorage.setItem(
    "pbos:routine-v2",
    JSON.stringify({
      routines: [
        {
          id: "rt-de",
          title: "German Practice",
          category: "Language",
          timeWindow: "evening",
          scheduleType: "daily",
          scheduleDays: [],
          scheduleTarget: null,
          completionType: "duration",
          targetQuantity: null,
          targetUnit: null,
          targetDurationMinutes: 30,
          priority: "important",
          relatedSystemId: null,
          paused: false,
          archived: false,
          createdAt: TS,
          updatedAt: TS,
        },
      ],
      logs: [],
    }),
  );
  window.localStorage.setItem("pbos:routine-v2-imported", "1");
}

function App({ start = "/language" }: { start?: string }) {
  return (
    <KnowledgeProvider>
      <ObsidianProvider>
      <RoutineProvider>
        <LanguageProvider>
          <MemoryRouter initialEntries={[start]}>
            <Routes>
              <Route path="/language" element={<ReadingLanguageOverviewPage />} />
              <Route path="/language/paths/new" element={<PathBuilderPage />} />
              <Route path="/language/paths/:pathId" element={<LanguagePathDetailPage />} />
              <Route path="/language/paths/:pathId/edit" element={<PathBuilderPage />} />
              <Route path="/language/paths/:pathId/session" element={<LearningSessionPage />} />
              <Route path="/language/books/new" element={<BookBuilderPage />} />
              <Route path="/language/books/:bookId" element={<BookDetailPage />} />
              <Route path="/language/books/:bookId/edit" element={<BookBuilderPage />} />
            </Routes>
          </MemoryRouter>
        </LanguageProvider>
      </RoutineProvider>
      </ObsidianProvider>
    </KnowledgeProvider>
  );
}

beforeEach(() => window.localStorage.clear());
afterEach(() => window.localStorage.clear());

async function createPath(user: ReturnType<typeof userEvent.setup>, language: string) {
  await user.click(screen.getAllByRole("button", { name: /new language path/i })[0]);
  await user.type(await screen.findByLabelText(/^language$/i), language);
  await user.type(screen.getByLabelText(/path title/i), `${language} A1`);
  await user.click(screen.getByRole("button", { name: /^create path$/i }));
  await screen.findByRole("heading", { name: new RegExp(`${language} A1`) });
}

describe("Language — driven through the real UI", () => {
  it("honest empty state → create a path that appears with no fake progress", async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(await screen.findByText(/nothing here yet/i)).toBeInTheDocument();
    await createPath(user, "German");
    expect(screen.getByRole("heading", { name: /German A1/ })).toBeInTheDocument();
    expect(screen.getByText(/No units yet — not 0%\./i)).toBeInTheDocument();
  });

  it("validation failure preserves the other input", async () => {
    const user = userEvent.setup();
    render(<App start="/language/paths/new" />);
    const title = await screen.findByLabelText(/path title/i);
    await user.type(title, "My Path");
    await user.click(screen.getByRole("button", { name: /^create path$/i }));
    expect(await screen.findByText(/name the language/i)).toBeInTheDocument();
    expect((title as HTMLInputElement).value).toBe("My Path");
  });

  it("adds units, reorders them, and derives a real percent — not a mastery number", async () => {
    const user = userEvent.setup();
    render(<App />);
    await createPath(user, "German");

    await user.type(screen.getByLabelText(/unit title/i), "Greetings");
    await user.click(screen.getByRole("button", { name: /^add unit$/i }));
    await screen.findByText("Greetings");
    await user.type(screen.getByLabelText(/unit title/i), "Numbers");
    await user.click(screen.getByRole("button", { name: /^add unit$/i }));
    await screen.findByText("Numbers");

    // 0 of 2 complete → "0%" progress, but it's a curriculum ratio, labelled as such
    expect(screen.getByText(/0 of 2 units\. Curriculum position, not skill evidence\./i)).toBeInTheDocument();

    // complete one → 50%
    await user.click(screen.getByRole("checkbox", { name: /mark greetings complete/i }));
    expect(await screen.findByText(/1 of 2 units/i)).toBeInTheDocument();

    // reorder: move Numbers up
    await user.click(screen.getByRole("button", { name: /move numbers up/i }));
    const rows = screen.getAllByRole("checkbox");
    expect(rows).toHaveLength(2);
  });

  it("links a canonical Routine to the path (reference only) and unlinks", async () => {
    seedRoutine();
    const user = userEvent.setup();
    render(<App />);
    await createPath(user, "German");

    await user.selectOptions(await screen.findByLabelText(/link a routine to german a1/i), "rt-de");
    expect(await screen.findByRole("link", { name: /German Practice/ })).toBeInTheDocument();
    expect(
      screen.getByText(/the routine owns cadence and check-in history, this path owns/i),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^unlink$/i }));
    expect(await screen.findByLabelText(/link a routine to german a1/i)).toBeInTheDocument();
  });

  it("logging a session marks its unit complete but NEVER creates Knowledge mastery automatically", async () => {
    seedKnowledgeTopic();
    const user = userEvent.setup();
    render(<App />);
    await createPath(user, "German");

    // a unit linked to the Knowledge concept
    await user.type(screen.getByLabelText(/unit title/i), "Vocabulary Set 1");
    await user.selectOptions(screen.getByLabelText(/unit knowledge concept/i), "kt-de");
    await user.click(screen.getByRole("button", { name: /^add unit$/i }));
    await screen.findByText("Vocabulary Set 1");

    await user.click(screen.getByRole("button", { name: /start learning session/i }));
    await user.selectOptions(await screen.findByLabelText(/unit \(optional\)/i), (
      await screen.findAllByRole("option", { name: /Vocabulary Set 1/ })
    )[0]);
    // no recall score entered
    await user.click(screen.getByRole("button", { name: /^log session$/i }));

    expect(await screen.findByText(/marked complete/i)).toBeInTheDocument();
    // the explicit evidence button exists, but nothing was written yet
    await user.click(screen.getByRole("button", { name: /record recall as knowledge evidence/i }));
    expect(
      await screen.findByText(/add a recall score first — a session without one proves nothing/i),
    ).toBeInTheDocument();
  });
});

describe("Reading — driven through the real UI", () => {
  async function addBook(user: ReturnType<typeof userEvent.setup>, title: string, total?: string) {
    await user.click(screen.getAllByRole("button", { name: /add book/i })[0]);
    await user.type(await screen.findByLabelText(/^title$/i), title);
    if (total !== undefined) {
      await user.clear(screen.getByLabelText(/total pages/i));
      await user.type(screen.getByLabelText(/total pages/i), total);
    }
    await user.click(screen.getByRole("button", { name: /^add book$/i }));
    await screen.findByRole("heading", { name: new RegExp(title) });
  }

  it("adds a book with a known total → deterministic percent", async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(await screen.findByText(/nothing here yet/i)).toBeInTheDocument();
    await addBook(user, "Atomic Habits", "320");
    // page 0 of 320 = 0% — but shown as a real ratio with the honest caveat
    expect(screen.getByText(/Pages read are\s+activity, not understanding/i)).toBeInTheDocument();

    // set current page → 62/320 ≈ 19%
    await user.type(screen.getByLabelText(/set current page/i), "62");
    await user.click(screen.getByRole("button", { name: /^update$/i }));
    expect(await screen.findByText("19%")).toBeInTheDocument();
  });

  it("a book with UNKNOWN total pages shows an honest non-percent state, not 0%", async () => {
    const user = userEvent.setup();
    render(<App />);
    await addBook(user, "Unknown Length"); // total left blank
    expect(await screen.findByText(/Total pages not tracked/i)).toBeInTheDocument();
    expect(screen.getByText(/This is not 0%/i)).toBeInTheDocument();
  });

  it("logging a reading session advances the page but records no Knowledge mastery", async () => {
    const user = userEvent.setup();
    render(<App />);
    await addBook(user, "Deep Work", "300");

    await user.type(screen.getByLabelText(/reading session from page/i), "0");
    await user.type(screen.getByLabelText(/reading session to page/i), "45");
    await user.click(screen.getByRole("button", { name: /log reading/i }));

    expect(await screen.findByText(/Reading Sessions \(1\)/)).toBeInTheDocument();
    // page advanced to 45 → 15%
    expect(await screen.findByText("15%")).toBeInTheDocument();
    // there is no "mastery" / "knowledge" claim anywhere on the reading surface
    expect(screen.queryByText(/mastered/i)).not.toBeInTheDocument();
  });
});
