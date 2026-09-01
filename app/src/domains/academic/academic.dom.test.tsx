// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AcademicProvider } from "./store";
import { KnowledgeProvider } from "../knowledge/store";
import { AcademicsOverviewPage } from "./AcademicsOverviewPage";
import { CourseBuilderPage } from "./CourseBuilderPage";
import { CourseDetailPage } from "./CourseDetailPage";
import { KnowledgeOverviewPage } from "../knowledge/KnowledgeOverviewPage";
import { KnowledgeTopicBuilderPage } from "../knowledge/KnowledgeTopicBuilderPage";

vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => false, invoke: vi.fn() }));

function App({ start = "/academics" }: { start?: string }) {
  return (
    <AcademicProvider>
      <KnowledgeProvider>
        <MemoryRouter initialEntries={[start]}>
          <Routes>
            <Route path="/academics" element={<AcademicsOverviewPage />} />
            <Route path="/academics/new" element={<CourseBuilderPage />} />
            <Route path="/academics/:courseId" element={<CourseDetailPage />} />
            <Route path="/academics/:courseId/edit" element={<CourseBuilderPage />} />
            <Route path="/knowledge" element={<KnowledgeOverviewPage />} />
            <Route path="/knowledge/new" element={<KnowledgeTopicBuilderPage />} />
            <Route path="/knowledge/:topicId" element={<div>topic page</div>} />
          </Routes>
        </MemoryRouter>
      </KnowledgeProvider>
    </AcademicProvider>
  );
}

beforeEach(() => window.localStorage.clear());
afterEach(() => window.localStorage.clear());

async function addCourse(user: ReturnType<typeof userEvent.setup>, title: string) {
  await screen.findAllByRole("button", { name: /add (your first course|course)/i }); // wait past LOADING
  const start =
    screen.queryByRole("button", { name: /add your first course/i }) ??
    screen.getByRole("button", { name: "Add Course" });
  await user.click(start);
  await user.type(await screen.findByLabelText(/course name/i), title);
  await user.click(screen.getByRole("button", { name: /^add course$/i }));
  await screen.findByRole("heading", { name: new RegExp(title) });
}

describe("Academic — driven through the real UI", () => {
  it("shows an honest empty state, then creates a course that appears immediately", async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(await screen.findByText(/no courses yet/i)).toBeInTheDocument();

    await addCourse(user, "Data Structures");
    expect(screen.getByRole("heading", { name: /Data Structures/ })).toBeInTheDocument();
    expect(screen.getByText(/weighted score so far/i)).toBeInTheDocument();
  });

  it("validation failure preserves the other input", async () => {
    const user = userEvent.setup();
    render(<App start="/academics/new" />);
    const code = await screen.findByLabelText(/course code/i);
    await user.type(code, "CSE 201");
    await user.click(screen.getByRole("button", { name: /^add course$/i }));
    expect(await screen.findByText(/give the course a title/i)).toBeInTheDocument();
    expect((code as HTMLInputElement).value).toBe("CSE 201");
  });

  it("edits a course and the change shows immediately", async () => {
    const user = userEvent.setup();
    render(<App />);
    await addCourse(user, "Data Structures");
    await user.click(screen.getByRole("button", { name: /edit course/i }));
    const name = await screen.findByLabelText(/course name/i);
    await user.clear(name);
    await user.type(name, "Data Structures & Algorithms");
    await user.click(screen.getByRole("button", { name: /save course/i }));
    expect(await screen.findByRole("heading", { name: /Data Structures & Algorithms/ })).toBeInTheDocument();
  });

  it("adds a topic, then edits Professor Coverage and Personal Study INDEPENDENTLY — neither grants mastery", async () => {
    const user = userEvent.setup();
    render(<App />);
    await addCourse(user, "Data Structures");

    await user.click(screen.getByRole("button", { name: /^add topic$/i }));
    await user.type(await screen.findByLabelText(/topic title/i), "Binary Trees");
    await user.click(screen.getByRole("button", { name: /^add topic$/i }));

    const coverage = await screen.findByLabelText(/professor coverage for binary trees/i);
    const study = screen.getByLabelText(/personal study percent for binary trees/i);

    // set professor coverage → personal study is untouched
    await user.selectOptions(coverage, "taught");
    expect((coverage as HTMLSelectElement).value).toBe("taught");
    expect((study as HTMLInputElement).value).toBe("0");

    // set personal study → professor coverage is untouched
    await user.clear(study);
    await user.type(study, "70");
    await user.tab(); // blur → save
    expect((coverage as HTMLSelectElement).value).toBe("taught");

    // mastery is NOT auto-granted by either
    const row = coverage.closest("div.border-t") as HTMLElement;
    expect(within(row).getByText("Not linked")).toBeInTheDocument();
    expect(within(row).queryByText(/^\d+%$/)).not.toBeInTheDocument();
  });

  it("links an Academic Topic to an existing Knowledge concept (no duplicate mastery)", async () => {
    const user = userEvent.setup();
    render(<App start="/knowledge/new" />);
    // create the Knowledge concept first
    await user.type(await screen.findByLabelText(/topic title/i), "Binary Trees");
    await user.click(screen.getByRole("button", { name: /^add topic$/i }));
    await screen.findByText(/topic page/i);

    // now go to Academics and link
    render(<App start="/academics" />);
    await addCourse(user, "Data Structures");
    await user.click(screen.getByRole("button", { name: /^add topic$/i }));
    await user.type(await screen.findByLabelText(/topic title/i), "Binary Trees");
    await user.click(screen.getByRole("button", { name: /^add topic$/i }));

    const linkSelect = await screen.findByLabelText(/link binary trees to a knowledge concept/i);
    await user.selectOptions(linkSelect, within(linkSelect).getByRole("option", { name: "Binary Trees" }));
    await user.click(screen.getByRole("button", { name: /^link$/i }));

    // the row now offers to unlink, and shows "No evidence yet" (read from Knowledge, not a stored 0)
    expect(await screen.findByRole("button", { name: /unlink knowledge concept/i })).toBeInTheDocument();
    expect(screen.getByText(/no evidence yet/i)).toBeInTheDocument();
  });

  it("adds an assessment, updates marks, and surfaces an under-weight configuration warning", async () => {
    const user = userEvent.setup();
    render(<App />);
    await addCourse(user, "Data Structures");

    await user.click(screen.getByRole("button", { name: /^add assessment$/i }));
    await user.type(await screen.findByLabelText(/assessment title/i), "Quiz 1");
    await user.clear(screen.getByLabelText(/total marks/i));
    await user.type(screen.getByLabelText(/total marks/i), "20");
    await user.clear(screen.getByLabelText(/weight %/i));
    await user.type(screen.getByLabelText(/weight %/i), "10");
    await user.click(screen.getByRole("button", { name: /^add assessment$/i }));

    // weights total 10% → truthful "under" warning, NOT silent rescale
    expect(await screen.findByText(/add up to 10%/i)).toBeInTheDocument();

    // enter marks
    const marks = await screen.findByLabelText(/obtained marks for quiz 1/i);
    await user.clear(marks);
    await user.type(marks, "18");
    await user.tab();
    // 18/20 * 10% = 9.0 weighted points
    expect(await screen.findByText(/9\.0%/)).toBeInTheDocument();
  });
});
